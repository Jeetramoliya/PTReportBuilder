const express = require('express');
const path = require('path');
const multer = require('multer');
const { nanoid } = require('nanoid');
const db = require('../db');
const { saveUpload, getUpload, deleteUpload } = require('../uploads');
const { THEMES, COVER_STYLES, PAGE_BACKGROUNDS, HEADER_FOOTER_STYLES, COVER_ALIGNMENTS, WORDMARK_STYLES } = require('../utils/themes');
const { FONTS } = require('../utils/fonts');
const { extractDominantColor } = require('../utils/logoColor');
const { deleteProjectCascade } = require('../utils/cascade');

const router = express.Router();

router.get('/meta/themes', (req, res) => {
  res.json({
    themes: Object.values(THEMES),
    coverStyles: COVER_STYLES,
    fonts: Object.values(FONTS),
    pageBackgrounds: PAGE_BACKGROUNDS,
    headerFooterStyles: HEADER_FOOTER_STYLES,
    coverAlignments: COVER_ALIGNMENTS,
    wordmarkStyles: WORDMARK_STYLES,
  });
});

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|svg\+xml|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Logo must be an image (png, jpg, svg, webp)'));
  },
});

// Only returns the project if it belongs to the requesting user; otherwise 404.
async function getProjectOr404(id, res, userId) {
  const project = await db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, userId);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
}

router.get('/', async (req, res, next) => {
  try {
    const projects = await db
      .prepare(
        `SELECT p.*,
          (SELECT COUNT(*) FROM findings f WHERE f.project_id = p.id) as finding_count
         FROM projects p WHERE p.user_id = ? ORDER BY p.updated_at DESC`
      )
      .all(req.userId);
    res.json(projects);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, client_name, client_address, client_website, report_title, report_subtitle, iteration_label, assessment_date, tester_name, prepared_by_org, tagline, finding_prefix, theme, cover_style } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Project name is required' });
    const id = nanoid();
    const defaultMethodology = `Security team tested the application in the role of an authenticated user. Application security tests are modeled along the methodologies specified by the Open Web Application Security Project (OWASP), covering:
- Complete review of application architecture and inadequate input sanitization
- Interception of HTTP(S) traffic via a local proxy
- Review of the authentication and session management flow
- Advanced crawling for API endpoint discovery and scanning
- Testing for injection attacks (SQLi, XML injection, etc.) and insufficient input validation (XSS)
- Testing for broken authentication, broken access control, and privilege escalation
- Testing for brute-force and rate-limiting weaknesses
- Review of file upload/download functionality for vulnerabilities`;
    const defaultExecSummary = 'The following table lists the findings from the assessment, along with their risk rating.';

    await db.prepare(
      `INSERT INTO projects (id, user_id, name, client_name, client_address, client_website, report_title, report_subtitle, iteration_label, assessment_date, tester_name, prepared_by_org, tagline, finding_prefix, methodology, executive_summary, theme, cover_style)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.userId,
      name.trim(),
      client_name || '',
      client_address || '',
      client_website || '',
      report_title || `${name.trim()} Penetration Assessment`,
      report_subtitle || '',
      iteration_label || '',
      assessment_date || new Date().toISOString().slice(0, 10),
      tester_name || '',
      prepared_by_org || '',
      tagline || 'Confidential & Proprietary',
      (finding_prefix || 'WEB').toUpperCase(),
      defaultMethodology,
      defaultExecSummary,
      (THEMES[theme] ? theme : 'navy'),
      cover_style || 'classic'
    );
    res.status(201).json(await db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const project = await getProjectOr404(req.params.id, res, req.userId);
    if (!project) return;
    const scope = await db.prepare('SELECT * FROM scope_items WHERE project_id = ? ORDER BY sort_order, rowid').all(project.id);
    const findings = await db
      .prepare('SELECT id, identifier, title, category, severity, risk_rating, cvss_score, status FROM findings WHERE project_id = ? ORDER BY sort_order, rowid')
      .all(project.id);
    res.json({ ...project, scope, findings });
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const project = await getProjectOr404(req.params.id, res, req.userId);
    if (!project) return;
    const fields = [
      'name', 'client_name', 'client_address', 'client_website', 'company_name', 'wordmark_style',
      'wordmark_bold', 'wordmark_italic', 'wordmark_underline', 'wordmark_size', 'wordmark_color', 'wordmark_color2', 'wordmark_split',
      'report_title', 'report_subtitle', 'iteration_label',
      'assessment_date', 'tester_name', 'prepared_by_org', 'tagline', 'executive_summary', 'methodology', 'finding_prefix',
      'theme', 'cover_style', 'font_family', 'custom_brand_color', 'watermark_text',
      'page_background', 'header_footer_style', 'cover_alignment',
    ];
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }
    if (updates.length) {
      updates.push("updated_at = datetime('now')");
      values.push(project.id);
      await db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    // Cover branding is either a logo OR a company name, never both: setting a company
    // name clears any uploaded logo so the two can't fight over the cover.
    if (typeof req.body.company_name === 'string' && req.body.company_name.trim()) {
      const current = await db.prepare('SELECT logo_path FROM projects WHERE id = ?').get(project.id);
      if (current && current.logo_path) {
        await deleteUpload(current.logo_path);
        await db.prepare("UPDATE projects SET logo_path = '' WHERE id = ?").run(project.id);
      }
    }

    res.json(await db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const project = await getProjectOr404(req.params.id, res, req.userId);
    if (!project) return;
    await deleteProjectCascade(project.id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.post('/:id/logo', logoUpload.single('logo'), async (req, res, next) => {
  try {
    const project = await getProjectOr404(req.params.id, res, req.userId);
    if (!project) return;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (project.logo_path) await deleteUpload(project.logo_path);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const relPath = await saveUpload(req.file.buffer, req.file.mimetype, ext);
    // Uploading a logo clears the company-name wordmark: cover branding is one or the other.
    await db.prepare("UPDATE projects SET logo_path = ?, company_name = '', updated_at = datetime('now') WHERE id = ?").run(relPath, project.id);
    res.json(await db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/:id/logo', async (req, res, next) => {
  try {
    const project = await getProjectOr404(req.params.id, res, req.userId);
    if (!project) return;
    if (project.logo_path) await deleteUpload(project.logo_path);
    await db.prepare("UPDATE projects SET logo_path = '', updated_at = datetime('now') WHERE id = ?").run(project.id);
    res.json(await db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id));
  } catch (e) {
    next(e);
  }
});

router.post('/:id/logo-color', async (req, res, next) => {
  try {
    const project = await getProjectOr404(req.params.id, res, req.userId);
    if (!project) return;
    if (!project.logo_path) return res.status(400).json({ error: 'Upload a logo first' });
    const up = await getUpload(project.logo_path);
    if (!up) return res.status(400).json({ error: 'Logo not found' });
    const ext = (up.ext || '').toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
      return res.status(400).json({ error: 'Color extraction only supports PNG or JPEG logos' });
    }
    const color = extractDominantColor(up.data, ext);
    if (!color) return res.status(400).json({ error: 'Could not determine a color from this logo' });
    await db.prepare("UPDATE projects SET theme = 'custom', custom_brand_color = ?, updated_at = datetime('now') WHERE id = ?").run(color, project.id);
    res.json(await db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id));
  } catch (e) {
    res.status(400).json({ error: 'Failed to read logo image: ' + e.message });
  }
});

// ---- Scope items ----

router.post('/:id/scope', async (req, res, next) => {
  try {
    const project = await getProjectOr404(req.params.id, res, req.userId);
    if (!project) return;
    const { group_name, item_type, tenant, url, app_name, app_version, platform } = req.body;
    const type = item_type === 'app' ? 'app' : 'url';
    if (type === 'url' && (!url || !url.trim())) return res.status(400).json({ error: 'URL is required' });
    if (type === 'app' && (!app_name || !app_name.trim())) return res.status(400).json({ error: 'Application name is required' });
    const id = nanoid();
    const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM scope_items WHERE project_id = ?').get(project.id);
    await db.prepare(
      `INSERT INTO scope_items (id, project_id, group_name, item_type, tenant, url, app_name, app_version, platform, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, project.id, group_name || 'Scope', type,
      type === 'url' ? (tenant || 'ALL') : '',
      type === 'url' ? url.trim() : '',
      type === 'app' ? app_name.trim() : '',
      type === 'app' ? (app_version || '') : '',
      type === 'app' ? (platform || '') : '',
      maxRow.m + 1
    );
    res.status(201).json(await db.prepare('SELECT * FROM scope_items WHERE id = ?').get(id));
  } catch (e) {
    next(e);
  }
});

// Fetches a scope item only if its parent project belongs to the user.
function getScopeItemOwned(scopeId, userId) {
  return db.prepare(
    `SELECT s.* FROM scope_items s JOIN projects p ON p.id = s.project_id
     WHERE s.id = ? AND p.user_id = ?`
  ).get(scopeId, userId);
}

router.put('/scope/:scopeId', async (req, res, next) => {
  try {
    const item = await getScopeItemOwned(req.params.scopeId, req.userId);
    if (!item) return res.status(404).json({ error: 'Scope item not found' });
    const merged = { ...item, ...req.body };
    await db.prepare(
      `UPDATE scope_items SET group_name = ?, item_type = ?, tenant = ?, url = ?, app_name = ?, app_version = ?, platform = ? WHERE id = ?`
    ).run(
      merged.group_name, merged.item_type, merged.tenant, merged.url, merged.app_name, merged.app_version, merged.platform, item.id
    );
    res.json(await db.prepare('SELECT * FROM scope_items WHERE id = ?').get(item.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/scope/:scopeId', async (req, res, next) => {
  try {
    const item = await getScopeItemOwned(req.params.scopeId, req.userId);
    if (!item) return res.status(404).json({ error: 'Scope item not found' });
    await db.prepare('DELETE FROM scope_items WHERE id = ?').run(item.id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

module.exports = router;
