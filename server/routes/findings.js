const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { nanoid } = require('nanoid');
const db = require('../db');
const cvss = require('../utils/cvss');
const { riskFromLikelihoodImpact } = require('../utils/riskMatrix');

const router = express.Router();

const screenshotDir = path.join(__dirname, '..', '..', 'uploads', 'screenshots');
const screenshotUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, screenshotDir),
    filename: (req, file, cb) => cb(null, `${nanoid()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Screenshot must be an image (png, jpg, webp, gif)'));
  },
});

function loadFindingFull(id) {
  const finding = db.prepare('SELECT * FROM findings WHERE id = ?').get(id);
  if (!finding) return null;
  finding.affected_urls = db.prepare('SELECT * FROM affected_urls WHERE finding_id = ? ORDER BY sort_order, rowid').all(id);
  finding.poc_steps = db.prepare('SELECT * FROM poc_steps WHERE finding_id = ? ORDER BY sort_order, rowid').all(id);
  finding.references = db.prepare('SELECT * FROM finding_references WHERE finding_id = ? ORDER BY sort_order, rowid').all(id);
  finding.retest_events = db.prepare('SELECT * FROM retest_events WHERE finding_id = ? ORDER BY event_date DESC, rowid DESC').all(id);
  return finding;
}

function getFindingOr404(id, res) {
  const finding = db.prepare('SELECT * FROM findings WHERE id = ?').get(id);
  if (!finding) {
    res.status(404).json({ error: 'Finding not found' });
    return null;
  }
  return finding;
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
router.post('/projects/:projectId/findings', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const { title, category, scope_type, owasp_category, cwe_id, description, remediation, impact, likelihood, cvss_vector } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Finding title is required' });

  const countRow = db.prepare('SELECT COUNT(*) as c FROM findings WHERE project_id = ?').get(project.id);
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
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM findings WHERE project_id = ?').get(project.id).m;

  db.prepare(
    `INSERT INTO findings (id, project_id, identifier, title, category, scope_type, owasp_category, cwe_id, severity, impact, likelihood, risk_rating, cvss_vector, cvss_score, description, remediation, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, project.id, identifier, title.trim(), category || '', scope_type || 'Web Application', owasp_category || '', cwe_id || '', severity, imp, lik, risk, cvssVector, cvssScore, description || '', remediation || '', maxOrder + 1);

  db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(project.id);

  res.status(201).json(loadFindingFull(id));
});

router.get('/findings/:id', (req, res) => {
  const finding = loadFindingFull(req.params.id);
  if (!finding) return res.status(404).json({ error: 'Finding not found' });
  res.json(finding);
});

router.put('/findings/:id', (req, res) => {
  const finding = getFindingOr404(req.params.id, res);
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

  db.prepare(
    `UPDATE findings SET identifier = ?, title = ?, category = ?, scope_type = ?, owasp_category = ?, cwe_id = ?, description = ?, remediation = ?, status = ?,
      impact = ?, likelihood = ?, risk_rating = ?, severity = ?, cvss_vector = ?, cvss_score = ?,
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    identifier, merged.title, merged.category, merged.scope_type, merged.owasp_category, merged.cwe_id, merged.description, merged.remediation, merged.status,
    impact, likelihood, risk, severity, cvssVector, cvssScore, finding.id
  );

  db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(finding.project_id);

  res.json(loadFindingFull(finding.id));
});

router.delete('/findings/:id', (req, res) => {
  const finding = getFindingOr404(req.params.id, res);
  if (!finding) return;
  const steps = db.prepare('SELECT screenshot_path FROM poc_steps WHERE finding_id = ?').all(finding.id);
  for (const s of steps) {
    if (s.screenshot_path) {
      const p = path.join(__dirname, '..', '..', s.screenshot_path);
      fs.existsSync(p) && fs.unlinkSync(p);
    }
  }
  db.prepare('DELETE FROM findings WHERE id = ?').run(finding.id);
  res.status(204).end();
});

router.post('/findings/:id/reorder', (req, res) => {
  const finding = getFindingOr404(req.params.id, res);
  if (!finding) return;
  const direction = req.body.direction === 'up' ? -1 : 1;
  const siblings = db
    .prepare('SELECT id, sort_order FROM findings WHERE project_id = ? ORDER BY sort_order, rowid')
    .all(finding.project_id);
  const idx = siblings.findIndex((s) => s.id === finding.id);
  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= siblings.length) return res.json(loadFindingFull(finding.id));
  const a = siblings[idx];
  const b = siblings[swapIdx];
  db.prepare('UPDATE findings SET sort_order = ? WHERE id = ?').run(b.sort_order, a.id);
  db.prepare('UPDATE findings SET sort_order = ? WHERE id = ?').run(a.sort_order, b.id);
  res.json(loadFindingFull(finding.id));
});

// ---- Retest tracking ----
router.post('/findings/:id/retest', (req, res) => {
  const finding = getFindingOr404(req.params.id, res);
  if (!finding) return;
  const { new_status, notes, event_date } = req.body;
  if (!new_status || !new_status.trim()) return res.status(400).json({ error: 'New status is required' });
  const id = nanoid();
  db.prepare(
    'INSERT INTO retest_events (id, finding_id, event_date, previous_status, new_status, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, finding.id, event_date || new Date().toISOString().slice(0, 10), finding.status, new_status.trim(), notes || '');
  db.prepare("UPDATE findings SET status = ?, updated_at = datetime('now') WHERE id = ?").run(new_status.trim(), finding.id);
  res.status(201).json(loadFindingFull(finding.id));
});

router.delete('/retest/:eventId', (req, res) => {
  const item = db.prepare('SELECT * FROM retest_events WHERE id = ?').get(req.params.eventId);
  if (!item) return res.status(404).json({ error: 'Retest event not found' });
  db.prepare('DELETE FROM retest_events WHERE id = ?').run(item.id);
  res.json(loadFindingFull(item.finding_id));
});

// ---- Affected URLs ----
router.post('/findings/:id/urls', (req, res) => {
  const finding = getFindingOr404(req.params.id, res);
  if (!finding) return;
  const { url } = req.body;
  if (!url || !url.trim()) return res.status(400).json({ error: 'URL is required' });
  const id = nanoid();
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM affected_urls WHERE finding_id = ?').get(finding.id).m;
  db.prepare('INSERT INTO affected_urls (id, finding_id, url, sort_order) VALUES (?, ?, ?, ?)').run(id, finding.id, url.trim(), maxOrder + 1);
  res.status(201).json(loadFindingFull(finding.id));
});

router.delete('/urls/:urlId', (req, res) => {
  const item = db.prepare('SELECT * FROM affected_urls WHERE id = ?').get(req.params.urlId);
  if (!item) return res.status(404).json({ error: 'URL not found' });
  db.prepare('DELETE FROM affected_urls WHERE id = ?').run(item.id);
  res.json(loadFindingFull(item.finding_id));
});

// ---- PoC steps (with optional screenshot) ----
router.post('/findings/:id/poc', screenshotUpload.single('screenshot'), (req, res) => {
  const finding = getFindingOr404(req.params.id, res);
  if (!finding) return;
  const id = nanoid();
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM poc_steps WHERE finding_id = ?').get(finding.id).m;
  const screenshotPath = req.file ? `uploads/screenshots/${req.file.filename}` : '';
  db.prepare('INSERT INTO poc_steps (id, finding_id, step_text, payload, screenshot_path, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, finding.id, req.body.step_text || '', req.body.payload || '', screenshotPath, maxOrder + 1
  );
  res.status(201).json(loadFindingFull(finding.id));
});

router.put('/poc/:stepId', screenshotUpload.single('screenshot'), (req, res) => {
  const step = db.prepare('SELECT * FROM poc_steps WHERE id = ?').get(req.params.stepId);
  if (!step) return res.status(404).json({ error: 'Step not found' });
  let screenshotPath = step.screenshot_path;
  if (req.file) {
    if (screenshotPath) {
      const old = path.join(__dirname, '..', '..', screenshotPath);
      fs.existsSync(old) && fs.unlinkSync(old);
    }
    screenshotPath = `uploads/screenshots/${req.file.filename}`;
  }
  if (req.body.remove_screenshot === 'true' && !req.file) {
    if (screenshotPath) {
      const old = path.join(__dirname, '..', '..', screenshotPath);
      fs.existsSync(old) && fs.unlinkSync(old);
    }
    screenshotPath = '';
  }
  db.prepare('UPDATE poc_steps SET step_text = ?, payload = ?, screenshot_path = ? WHERE id = ?').run(
    req.body.step_text ?? step.step_text, req.body.payload ?? step.payload, screenshotPath, step.id
  );
  res.json(loadFindingFull(step.finding_id));
});

router.delete('/poc/:stepId', (req, res) => {
  const step = db.prepare('SELECT * FROM poc_steps WHERE id = ?').get(req.params.stepId);
  if (!step) return res.status(404).json({ error: 'Step not found' });
  if (step.screenshot_path) {
    const p = path.join(__dirname, '..', '..', step.screenshot_path);
    fs.existsSync(p) && fs.unlinkSync(p);
  }
  db.prepare('DELETE FROM poc_steps WHERE id = ?').run(step.id);
  res.json(loadFindingFull(step.finding_id));
});

// ---- References ----
router.post('/findings/:id/references', (req, res) => {
  const finding = getFindingOr404(req.params.id, res);
  if (!finding) return;
  const { label, url } = req.body;
  if (!url || !url.trim()) return res.status(400).json({ error: 'Reference URL is required' });
  const id = nanoid();
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM finding_references WHERE finding_id = ?').get(finding.id).m;
  db.prepare('INSERT INTO finding_references (id, finding_id, label, url, sort_order) VALUES (?, ?, ?, ?, ?)').run(
    id, finding.id, label || url.trim(), url.trim(), maxOrder + 1
  );
  res.status(201).json(loadFindingFull(finding.id));
});

router.delete('/references/:refId', (req, res) => {
  const item = db.prepare('SELECT * FROM finding_references WHERE id = ?').get(req.params.refId);
  if (!item) return res.status(404).json({ error: 'Reference not found' });
  db.prepare('DELETE FROM finding_references WHERE id = ?').run(item.id);
  res.json(loadFindingFull(item.finding_id));
});

module.exports = router;
