const express = require('express');
const path = require('path');
const multer = require('multer');
const { nanoid } = require('nanoid');
const db = require('../db');
const cvss = require('../utils/cvss');
const { riskFromLikelihoodImpact } = require('../utils/riskMatrix');
const { saveUpload, deleteUpload } = require('../uploads');

const router = express.Router();

const screenshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Screenshot must be an image (png, jpg, webp, gif)'));
  },
});

async function loadFindingFull(id) {
  const finding = await db.prepare('SELECT * FROM findings WHERE id = ?').get(id);
  if (!finding) return null;
  finding.affected_urls = await db.prepare('SELECT * FROM affected_urls WHERE finding_id = ? ORDER BY sort_order, rowid').all(id);
  finding.poc_steps = await db.prepare('SELECT * FROM poc_steps WHERE finding_id = ? ORDER BY sort_order, rowid').all(id);
  finding.references = await db.prepare('SELECT * FROM finding_references WHERE finding_id = ? ORDER BY sort_order, rowid').all(id);
  finding.retest_events = await db.prepare('SELECT * FROM retest_events WHERE finding_id = ? ORDER BY event_date DESC, rowid DESC').all(id);
  return finding;
}

// A finding is only accessible if its project belongs to the requesting user.
async function getFindingOr404(id, res, userId) {
  const finding = await db.prepare(
    `SELECT f.* FROM findings f JOIN projects p ON p.id = f.project_id
     WHERE f.id = ? AND p.user_id = ?`
  ).get(id, userId);
  if (!finding) {
    res.status(404).json({ error: 'Finding not found' });
    return null;
  }
  return finding;
}

// For sub-resources (urls, poc steps, references, retests) keyed by their own id:
// resolve to the owning row only if the whole chain belongs to the user.
function ownedSubRow(table, id, userId) {
  return db.prepare(
    `SELECT t.* FROM ${table} t
       JOIN findings f ON f.id = t.finding_id
       JOIN projects p ON p.id = f.project_id
     WHERE t.id = ? AND p.user_id = ?`
  ).get(id, userId);
}

// ---- CVSS calculator (stateless helper) ----
router.post('/cvss/calculate', (req, res) => {
  try {
    const result = cvss.calculate(req.body.vector || req.body.metrics || req.body);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: 'Invalid CVSS metrics' });
  }
});

// ---- Findings under a project ----
router.post('/projects/:projectId/findings', async (req, res, next) => {
  try {
    const project = await db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.projectId, req.userId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { title, category, scope_type, owasp_category, cwe_id, description, remediation, impact, likelihood, cvss_vector } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Finding title is required' });

    const countRow = await db.prepare('SELECT COUNT(*) as c FROM findings WHERE project_id = ?').get(project.id);
    const seq = countRow.c + 1;
    const identifier = `${project.finding_prefix || 'WEB'}-${seq}`;

    const imp = impact || 'Medium';
    const lik = likelihood || 'Medium';
    const risk = riskFromLikelihoodImpact(lik, imp);

    let cvssScore = 0;
    let cvssVector = cvss_vector || '';
    let severity = risk;
    if (cvssVector) {
      const c = cvss.calculate(cvssVector);
      cvssScore = c.score;
      cvssVector = c.vector;
      severity = c.severity === 'None' ? risk : c.severity;
    }

    const id = nanoid();
    const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM findings WHERE project_id = ?').get(project.id);

    await db.prepare(
      `INSERT INTO findings (id, project_id, identifier, title, category, scope_type, owasp_category, cwe_id, severity, impact, likelihood, risk_rating, cvss_vector, cvss_score, description, remediation, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, project.id, identifier, title.trim(), category || '', scope_type || 'Web Application', owasp_category || '', cwe_id || '', severity, imp, lik, risk, cvssVector, cvssScore, description || '', remediation || '', maxRow.m + 1);

    await db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(project.id);

    res.status(201).json(await loadFindingFull(id));
  } catch (e) {
    next(e);
  }
});

router.get('/findings/:id', async (req, res, next) => {
  try {
    const owned = await getFindingOr404(req.params.id, res, req.userId);
    if (!owned) return;
    res.json(await loadFindingFull(req.params.id));
  } catch (e) {
    next(e);
  }
});

router.put('/findings/:id', async (req, res, next) => {
  try {
    const finding = await getFindingOr404(req.params.id, res, req.userId);
    if (!finding) return;

    const merged = { ...finding, ...req.body };

    const impact = merged.impact || finding.impact;
    const likelihood = merged.likelihood || finding.likelihood;
    const risk = riskFromLikelihoodImpact(likelihood, impact);

    let cvssScore = finding.cvss_score;
    let cvssVector = merged.cvss_vector ?? finding.cvss_vector;
    let severity = merged.severity || risk;

    if (cvssVector) {
      try {
        const c = cvss.calculate(cvssVector);
        cvssScore = c.score;
        cvssVector = c.vector;
        if (!req.body.severity) severity = c.severity === 'None' ? risk : c.severity;
      } catch (e) {
        // keep previous score if vector invalid
      }
    } else {
      cvssScore = 0;
    }

    const identifier = (req.body.identifier && req.body.identifier.trim()) || finding.identifier;

    await db.prepare(
      `UPDATE findings SET identifier = ?, title = ?, category = ?, scope_type = ?, owasp_category = ?, cwe_id = ?, description = ?, remediation = ?, status = ?,
        impact = ?, likelihood = ?, risk_rating = ?, severity = ?, cvss_vector = ?, cvss_score = ?,
        updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      identifier, merged.title, merged.category, merged.scope_type, merged.owasp_category, merged.cwe_id, merged.description, merged.remediation, merged.status,
      impact, likelihood, risk, severity, cvssVector, cvssScore, finding.id
    );

    await db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(finding.project_id);

    res.json(await loadFindingFull(finding.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/findings/:id', async (req, res, next) => {
  try {
    const finding = await getFindingOr404(req.params.id, res, req.userId);
    if (!finding) return;
    const steps = await db.prepare('SELECT screenshot_path FROM poc_steps WHERE finding_id = ?').all(finding.id);
    for (const s of steps) if (s.screenshot_path) await deleteUpload(s.screenshot_path);
    await db.prepare('DELETE FROM affected_urls WHERE finding_id = ?').run(finding.id);
    await db.prepare('DELETE FROM poc_steps WHERE finding_id = ?').run(finding.id);
    await db.prepare('DELETE FROM finding_references WHERE finding_id = ?').run(finding.id);
    await db.prepare('DELETE FROM retest_events WHERE finding_id = ?').run(finding.id);
    await db.prepare('DELETE FROM findings WHERE id = ?').run(finding.id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.post('/findings/:id/reorder', async (req, res, next) => {
  try {
    const finding = await getFindingOr404(req.params.id, res, req.userId);
    if (!finding) return;
    const direction = req.body.direction === 'up' ? -1 : 1;
    const siblings = await db
      .prepare('SELECT id, sort_order FROM findings WHERE project_id = ? ORDER BY sort_order, rowid')
      .all(finding.project_id);
    const idx = siblings.findIndex((s) => s.id === finding.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= siblings.length) return res.json(await loadFindingFull(finding.id));
    const a = siblings[idx];
    const b = siblings[swapIdx];
    await db.prepare('UPDATE findings SET sort_order = ? WHERE id = ?').run(b.sort_order, a.id);
    await db.prepare('UPDATE findings SET sort_order = ? WHERE id = ?').run(a.sort_order, b.id);
    res.json(await loadFindingFull(finding.id));
  } catch (e) {
    next(e);
  }
});

// ---- Retest tracking ----
router.post('/findings/:id/retest', async (req, res, next) => {
  try {
    const finding = await getFindingOr404(req.params.id, res, req.userId);
    if (!finding) return;
    const { new_status, notes, event_date } = req.body;
    if (!new_status || !new_status.trim()) return res.status(400).json({ error: 'New status is required' });
    const id = nanoid();
    await db.prepare(
      'INSERT INTO retest_events (id, finding_id, event_date, previous_status, new_status, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, finding.id, event_date || new Date().toISOString().slice(0, 10), finding.status, new_status.trim(), notes || '');
    await db.prepare("UPDATE findings SET status = ?, updated_at = datetime('now') WHERE id = ?").run(new_status.trim(), finding.id);
    res.status(201).json(await loadFindingFull(finding.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/retest/:eventId', async (req, res, next) => {
  try {
    const item = await ownedSubRow('retest_events', req.params.eventId, req.userId);
    if (!item) return res.status(404).json({ error: 'Retest event not found' });
    await db.prepare('DELETE FROM retest_events WHERE id = ?').run(item.id);
    res.json(await loadFindingFull(item.finding_id));
  } catch (e) {
    next(e);
  }
});

// ---- Affected URLs ----
router.post('/findings/:id/urls', async (req, res, next) => {
  try {
    const finding = await getFindingOr404(req.params.id, res, req.userId);
    if (!finding) return;
    const { url } = req.body;
    if (!url || !url.trim()) return res.status(400).json({ error: 'URL is required' });
    const id = nanoid();
    const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM affected_urls WHERE finding_id = ?').get(finding.id);
    await db.prepare('INSERT INTO affected_urls (id, finding_id, url, sort_order) VALUES (?, ?, ?, ?)').run(id, finding.id, url.trim(), maxRow.m + 1);
    res.status(201).json(await loadFindingFull(finding.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/urls/:urlId', async (req, res, next) => {
  try {
    const item = await ownedSubRow('affected_urls', req.params.urlId, req.userId);
    if (!item) return res.status(404).json({ error: 'URL not found' });
    await db.prepare('DELETE FROM affected_urls WHERE id = ?').run(item.id);
    res.json(await loadFindingFull(item.finding_id));
  } catch (e) {
    next(e);
  }
});

// ---- PoC steps (with optional screenshot) ----
router.post('/findings/:id/poc', screenshotUpload.single('screenshot'), async (req, res, next) => {
  try {
    const finding = await getFindingOr404(req.params.id, res, req.userId);
    if (!finding) return;
    const id = nanoid();
    const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM poc_steps WHERE finding_id = ?').get(finding.id);
    let screenshotPath = '';
    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      screenshotPath = await saveUpload(req.file.buffer, req.file.mimetype, ext);
    }
    await db.prepare('INSERT INTO poc_steps (id, finding_id, step_text, payload, screenshot_path, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(
      id, finding.id, req.body.step_text || '', req.body.payload || '', screenshotPath, maxRow.m + 1
    );
    res.status(201).json(await loadFindingFull(finding.id));
  } catch (e) {
    next(e);
  }
});

router.put('/poc/:stepId', screenshotUpload.single('screenshot'), async (req, res, next) => {
  try {
    const step = await ownedSubRow('poc_steps', req.params.stepId, req.userId);
    if (!step) return res.status(404).json({ error: 'Step not found' });
    let screenshotPath = step.screenshot_path;
    if (req.file) {
      if (screenshotPath) await deleteUpload(screenshotPath);
      const ext = path.extname(req.file.originalname).toLowerCase();
      screenshotPath = await saveUpload(req.file.buffer, req.file.mimetype, ext);
    }
    if (req.body.remove_screenshot === 'true' && !req.file) {
      if (screenshotPath) await deleteUpload(screenshotPath);
      screenshotPath = '';
    }
    await db.prepare('UPDATE poc_steps SET step_text = ?, payload = ?, screenshot_path = ? WHERE id = ?').run(
      req.body.step_text ?? step.step_text, req.body.payload ?? step.payload, screenshotPath, step.id
    );
    res.json(await loadFindingFull(step.finding_id));
  } catch (e) {
    next(e);
  }
});

router.delete('/poc/:stepId', async (req, res, next) => {
  try {
    const step = await ownedSubRow('poc_steps', req.params.stepId, req.userId);
    if (!step) return res.status(404).json({ error: 'Step not found' });
    if (step.screenshot_path) await deleteUpload(step.screenshot_path);
    await db.prepare('DELETE FROM poc_steps WHERE id = ?').run(step.id);
    res.json(await loadFindingFull(step.finding_id));
  } catch (e) {
    next(e);
  }
});

// ---- References ----
router.post('/findings/:id/references', async (req, res, next) => {
  try {
    const finding = await getFindingOr404(req.params.id, res, req.userId);
    if (!finding) return;
    const { label, url } = req.body;
    if (!url || !url.trim()) return res.status(400).json({ error: 'Reference URL is required' });
    const id = nanoid();
    const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM finding_references WHERE finding_id = ?').get(finding.id);
    await db.prepare('INSERT INTO finding_references (id, finding_id, label, url, sort_order) VALUES (?, ?, ?, ?, ?)').run(
      id, finding.id, label || url.trim(), url.trim(), maxRow.m + 1
    );
    res.status(201).json(await loadFindingFull(finding.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/references/:refId', async (req, res, next) => {
  try {
    const item = await ownedSubRow('finding_references', req.params.refId, req.userId);
    if (!item) return res.status(404).json({ error: 'Reference not found' });
    await db.prepare('DELETE FROM finding_references WHERE id = ?').run(item.id);
    res.json(await loadFindingFull(item.finding_id));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
