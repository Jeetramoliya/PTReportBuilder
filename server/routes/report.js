const express = require('express');
const path = require('path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const { PDFParse } = require('pdf-parse');
const { buildReportData } = require('../utils/reportData');
const { buildDocx } = require('../utils/docxBuilder');
const { buildMergedDocument, drawHeaderFooter, remapTocLinks } = require('../utils/pdfMerge');
const db = require('../db');
const { SESSION_COOKIE, parseCookies } = require('../utils/userAuth');

const MARGIN_MM = { top: 20, bottom: 18, left: 10, right: 10 };

const router = express.Router();
const templatePath = path.join(__dirname, '..', 'templates', 'report.ejs');

function ownsProject(id, userId) {
  return !!db.prepare('SELECT 1 FROM projects WHERE id = ? AND user_id = ?').get(id, userId);
}

function normalize(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

// The sections the Table of Contents links to, each with the DOM anchor id used in the
// template and the on-page heading text used to locate its physical page.
function tocSections(data) {
  const sections = [
    { anchor: 'exec-summary', key: '1. Executive Summary' },
    { anchor: 'assessment-scope', key: '2. Assessment Scope' },
    { anchor: 'methodology', key: '3. Methodology' },
    { anchor: 'risk-rating', key: '4. Risk Rating' },
    { anchor: 'vulnerabilities-identified', key: '5. Vulnerabilities Identified' },
  ];
  if (data.findingsWithRetests.length) sections.push({ anchor: 'retest-summary', key: 'Retest Summary' });
  data.findings.forEach((f, i) => sections.push({ anchor: `finding-${i}`, key: `5.${i + 1} ${f.identifier}: ${f.title}` }));
  return sections;
}

// Measures which physical page each section lands on by scanning the rendered text.
// Returns two maps keyed the same way: by heading text (for the printed ToC numbers)
// and by anchor id (for wiring up the clickable links).
async function buildPageNumbers(pdfBuffer, sections) {
  const parser = new PDFParse({ data: pdfBuffer });
  const result = await parser.getText();
  await parser.destroy();
  const normalizedPages = result.pages.map((p) => normalize(p.text));
  const byKey = {};
  const byAnchor = {};
  // Skip the cover (page 1) and ToC (page 2) so a heading isn't matched against its own
  // listing in the Table of Contents.
  const searchStart = Math.min(2, normalizedPages.length - 1);
  for (const s of sections) {
    const nk = normalize(s.key);
    const idx = normalizedPages.findIndex((t, i) => i >= searchStart && t.includes(nk));
    if (idx !== -1) {
      byKey[s.key] = idx + 1;
      byAnchor[s.anchor] = idx + 1;
    }
  }
  return { byKey, byAnchor };
}

router.get('/projects/:id/report/preview', async (req, res, next) => {
  try {
    if (!ownsProject(req.params.id, req.userId)) return res.status(404).send('Project not found');
    const data = buildReportData(req.params.id);
    if (!data) return res.status(404).send('Project not found');
    if (req.query.pn) {
      try {
        data.pageNumbers = JSON.parse(Buffer.from(req.query.pn, 'base64').toString('utf8'));
      } catch (e) {
        // ignore malformed page-number payload, render without it
      }
    }
    if (req.query.mode === 'cover' || req.query.mode === 'rest') {
      data.renderMode = req.query.mode;
    }
    const html = await ejs.renderFile(templatePath, data);
    res.send(html);
  } catch (e) {
    next(e);
  }
});

router.get('/projects/:id/report/pdf', async (req, res, next) => {
  let browser;
  try {
    if (!ownsProject(req.params.id, req.userId)) return res.status(404).json({ error: 'Project not found' });
    const data = buildReportData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Project not found' });

    const sessionToken = parseCookies(req)[SESSION_COOKIE];
    const host = req.get('host');
    const baseUrl = `${req.protocol}://${host}/api/projects/${req.params.id}/report/preview`;
    const contentOptions = {
      format: 'A4',
      printBackground: true,
      margin: { top: `${MARGIN_MM.top}mm`, bottom: `${MARGIN_MM.bottom}mm`, left: `${MARGIN_MM.left}mm`, right: `${MARGIN_MM.right}mm` },
      displayHeaderFooter: false,
    };
    const coverOptions = {
      format: 'A4',
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      displayHeaderFooter: false,
    };

    const sections = tocSections(data);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      // On a container that ships its own Chromium, point at it via env; otherwise
      // Puppeteer uses the browser it downloaded during `npm install`.
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    const page = await browser.newPage();

    // The internal preview URL is behind authentication, so hand Puppeteer the same
    // session cookie the user is making this request with.
    if (sessionToken) {
      const hostname = host.split(':')[0];
      await page.setCookie({ name: SESSION_COOKIE, value: sessionToken, domain: hostname, path: '/', httpOnly: true });
    }

    // Pass 1: render the full document (cover + everything) purely to measure which
    // physical page each ToC-linked section lands on.
    await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    const draftBuffer = await page.pdf(contentOptions);
    const { byKey, byAnchor } = await buildPageNumbers(Buffer.from(draftBuffer), sections);
    const pnParam = `pn=${Buffer.from(JSON.stringify(byKey)).toString('base64')}`;

    // Pass 2a: the cover, on its own, full-bleed with no reserved margin — this is what
    // lets full-bleed cover styles (dark/gradient/band/etc.) paint edge-to-edge instead
    // of sitting inside a white margin frame.
    await page.goto(`${baseUrl}?mode=cover&${pnParam}`, { waitUntil: 'networkidle0', timeout: 60000 });
    const coverBuffer = await page.pdf(coverOptions);

    // Pass 2b: the Table of Contents + the rest of the report, with page margins reserved
    // for the header/footer we draw ourselves. No Chromium header/footer here.
    await page.goto(`${baseUrl}?mode=rest&${pnParam}`, { waitUntil: 'networkidle0', timeout: 60000 });
    const restBuffer = await page.pdf(contentOptions);

    await browser.close();
    browser = null;

    const merged = await buildMergedDocument(coverBuffer, restBuffer);
    // Draw full-bleed header/footer bars on the content pages only: skip the cover
    // (index 0) and the Table of Contents (index 1) so they stay clean, and so the first
    // numbered page is the Executive Summary on physical page 3.
    await drawHeaderFooter(merged, data, 2);
    // Wire each ToC row to jump to its real physical page in the merged PDF.
    remapTocLinks(merged, 1, byAnchor);
    const pdfBuffer = await merged.save();

    const filename = `${(data.project.name || 'report').replace(/[^a-z0-9\-_]+/gi, '_')}_VAPT_Report.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (e) {
    if (browser) await browser.close().catch(() => {});
    next(e);
  }
});

router.get('/projects/:id/report/docx', async (req, res, next) => {
  try {
    if (!ownsProject(req.params.id, req.userId)) return res.status(404).json({ error: 'Project not found' });
    const data = buildReportData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Project not found' });

    const buffer = await buildDocx(data);
    const filename = `${(data.project.name || 'report').replace(/[^a-z0-9\-_]+/gi, '_')}_VAPT_Report.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
