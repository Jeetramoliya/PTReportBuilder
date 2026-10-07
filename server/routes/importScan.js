const express = require('express');
const multer = require('multer');
const { nanoid } = require('nanoid');
const db = require('../db');
const { detectAndParse } = require('../utils/scanParsers');
const { riskFromLikelihoodImpact } = require('../utils/riskMatrix');
const { projectRole, canWrite } = require('../utils/access');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const SEVERITY_TO_IMPACT_LIKELIHOOD = {
  Critical: { impact: 'High', likelihood: 'High' },
  High: { impact: 'High', likelihood: 'High' },
  Medium: { impact: 'Medium', likelihood: 'Medium' },
  Low: { impact: 'Low', likelihood: 'Low' },
  Info: { impact: 'Low', likelihood: 'Low' },
};

// Parse a scanner export and return a preview list — nothing is saved yet.
router.post('/projects/:id/preview', upload.single('file'), async (req, res, next) => {
  try {
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project || !(await projectRole(project.id, req.userId))) return res.status(404).json({ error: 'Project not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const content = req.file.buffer.toString('utf8');
    const parsed = detectAndParse(req.file.originalname, content);
    if (!parsed.length) return res.status(400).json({ error: 'No findings could be parsed from this file.' });

    const preview = parsed.slice(0, 500).map((f) => ({
      title: f.title,
      severity: f.severity,
      description: f.description,
      remediation: f.remediation,
      url: f.url,
      source: f.source,
    }));

    res.json({ count: parsed.length, findings: preview });
  } catch (e) {
    next(e);
  }
});

// Create findings from a previously-parsed, user-confirmed selection.
router.post('/projects/:id/commit', async (req, res, next) => {
  try {
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    const role = project ? await projectRole(project.id, req.userId) : null;
    if (!project || !role) return res.status(404).json({ error: 'Project not found' });
    if (!canWrite(role)) return res.status(403).json({ error: 'You have read-only access to this project.' });
    const items = Array.isArray(req.body.findings) ? req.body.findings : [];
    if (!items.length) return res.status(400).json({ error: 'No findings selected' });

    let seq = (await db.prepare('SELECT COUNT(*) as c FROM findings WHERE project_id = ?').get(project.id)).c;
    let maxOrder = (await db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM findings WHERE project_id = ?').get(project.id)).m;

    const createdIds = [];
    for (const item of items) {
      seq += 1;
      maxOrder += 1;
      const severity = SEVERITY_TO_IMPACT_LIKELIHOOD[item.severity] ? item.severity : 'Info';
      const { impact, likelihood } = SEVERITY_TO_IMPACT_LIKELIHOOD[severity];
      const risk = riskFromLikelihoodImpact(likelihood, impact);
      const id = nanoid();
      const identifier = `${project.finding_prefix || 'WEB'}-${seq}`;
      await db.prepare(
        `INSERT INTO findings (id, project_id, identifier, title, category, severity, impact, likelihood, risk_rating, description, remediation, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id, project.id, identifier, (item.title || 'Untitled Finding').slice(0, 200), item.source || 'Imported',
        severity, impact, likelihood, risk, item.description || '', item.remediation || '', maxOrder
      );
      if (item.url) {
        await db.prepare('INSERT INTO affected_urls (id, finding_id, url, sort_order) VALUES (?, ?, ?, 0)').run(nanoid(), id, item.url);
      }
      createdIds.push(id);
    }

    await db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(project.id);
    res.status(201).json({ created: createdIds.length });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
