const db = require('../db');
const { getUpload } = require('../uploads');
const { severityRank } = require('./riskMatrix');
const { resolveTheme, resolvePageBackground } = require('./themes');
const { getFont } = require('./fonts');
const { markdownToHtml } = require('./markdown');

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function nl2br(str) {
  return escapeHtml(str).replace(/\n/g, '<br/>');
}

function parseCompliance(s) {
  try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}

const WORDMARK_SIZES = { small: 16, medium: 22, large: 30, xlarge: 40 };

function sanitizeHex(c) {
  return /^#[0-9a-fA-F]{3,6}$/.test(String(c || '')) ? c : '';
}

// Builds the cover company-name wordmark: resolves the typographic controls (bold/italic/
// underline/size/colour) into an inline style, and renders two-tone "half colour" names
// as two coloured spans.
function buildWordmark(project, theme) {
  const name = project.company_name || project.prepared_by_org || '';
  const sizePx = WORDMARK_SIZES[project.wordmark_size] || WORDMARK_SIZES.medium;
  const bold = project.wordmark_bold == null ? true : !!project.wordmark_bold;
  const italic = !!project.wordmark_italic;
  const underline = !!project.wordmark_underline;
  const color1 = sanitizeHex(project.wordmark_color);
  const color2 = sanitizeHex(project.wordmark_color2);

  const parts = [`font-size:${sizePx}px`, `font-weight:${bold ? '800' : '400'}`];
  if (italic) parts.push('font-style:italic');
  parts.push(`text-decoration:${underline ? 'underline' : 'none'}`);
  if (color1 && !color2) parts.push(`color:${color1}`);

  let html;
  if (color2 && name) {
    const n = Number(project.wordmark_split);
    const split = n > 0 && n < name.length ? n : Math.ceil(name.length / 2);
    const c1 = color1 || theme.brand;
    html = `<span style="color:${c1}">${escapeHtml(name.slice(0, split))}</span>`
      + `<span style="color:${color2}">${escapeHtml(name.slice(split))}</span>`;
  } else {
    html = escapeHtml(name);
  }

  return { hasName: !!name, inlineStyle: parts.join(';'), html };
}

function dataUri(up) {
  return up && up.data ? `data:${up.mime || 'image/png'};base64,${Buffer.from(up.data).toString('base64')}` : '';
}

async function buildReportData(projectId, opts = {}) {
  const inline = !!opts.inline; // embed images as data URIs (for the public, auth-free share page)
  const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return null;

  const scopeItems = await db.prepare('SELECT * FROM scope_items WHERE project_id = ? ORDER BY sort_order, rowid').all(projectId);

  const findingRows = await db.prepare('SELECT * FROM findings WHERE project_id = ? ORDER BY sort_order, rowid').all(projectId);
  const findings = [];
  for (const f of findingRows) {
    const poc_steps = await db.prepare('SELECT * FROM poc_steps WHERE finding_id = ? ORDER BY sort_order, rowid').all(f.id);
    // Attach raw screenshot bytes for the DOCX builder (the HTML/PDF path fetches them
    // over HTTP from /uploads instead).
    for (const step of poc_steps) {
      if (step.screenshot_path) {
        const up = await getUpload(step.screenshot_path);
        step.screenshot_bytes = up ? up.data : null;
        step.screenshotDataUri = inline ? dataUri(up) : '';
      }
    }
    findings.push({
      ...f,
      compliance_tags: parseCompliance(f.compliance),
      affected_urls: await db.prepare('SELECT * FROM affected_urls WHERE finding_id = ? ORDER BY sort_order, rowid').all(f.id),
      poc_steps,
      references: await db.prepare('SELECT * FROM finding_references WHERE finding_id = ? ORDER BY sort_order, rowid').all(f.id),
      retest_events: await db.prepare('SELECT * FROM retest_events WHERE finding_id = ? ORDER BY event_date, rowid').all(f.id),
    });
  }

  // Compliance coverage: control label -> finding identifiers that touch it.
  const complianceCoverage = {};
  for (const f of findings) {
    for (const tag of f.compliance_tags) {
      (complianceCoverage[tag] = complianceCoverage[tag] || []).push(f.identifier);
    }
  }

  const findingsSorted = [...findings].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

  const severityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 };
  for (const f of findings) {
    if (severityCounts[f.severity] === undefined) severityCounts[f.severity] = 0;
    severityCounts[f.severity] += 1;
  }

  const totalAlerts = findings.reduce((sum, f) => sum + Math.max(f.affected_urls.length, 1), 0);

  const owaspCounts = {};
  for (const f of findings) {
    if (!f.owasp_category) continue;
    owaspCounts[f.owasp_category] = (owaspCounts[f.owasp_category] || 0) + 1;
  }

  const retestEvents = findingsSorted.filter((f) => f.retest_events.length > 0);

  const theme = resolveTheme(project);

  // Logo bytes for the DOCX builder (HTML/PDF fetch it over HTTP from /uploads).
  let logoBytes = null;
  let logoDataUri = '';
  if (project.logo_path) {
    const up = await getUpload(project.logo_path);
    logoBytes = up ? up.data : null;
    logoDataUri = inline ? dataUri(up) : '';
  }

  return {
    project,
    logoBytes,
    logoDataUri,
    inlineImages: inline,
    theme,
    font: getFont(project.font_family),
    coverStyle: project.cover_style || 'classic',
    coverAlignment: project.cover_alignment || 'left',
    wordmarkStyle: project.wordmark_style || 'underline',
    wordmark: buildWordmark(project, theme),
    pageBackground: resolvePageBackground(project.page_background || 'white', theme),
    headerFooterStyle: project.header_footer_style || 'minimal',
    scopeItems,
    findings: findingsSorted,
    severityCounts,
    owaspCounts,
    complianceCoverage,
    reportLayout: project.report_layout || 'full',
    md: markdownToHtml,
    findingsWithRetests: retestEvents,
    totalFindings: findings.length,
    totalAlerts,
    generatedAt: new Date().toISOString().slice(0, 10),
    nl2br,
    pageNumbers: {},
  };
}

module.exports = { buildReportData };
