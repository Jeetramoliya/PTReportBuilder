const express = require('express');
const { nanoid } = require('nanoid');
const { TEMPLATES } = require('../data/findingTemplates');
const { OWASP_TOP10_2021 } = require('../data/owaspCategories');
const db = require('../db');
const { validateFinding } = require('../utils/validate');

const router = express.Router();

router.get('/finding-templates', (req, res) => {
  res.json(TEMPLATES);
});

router.get('/owasp-categories', (req, res) => {
  res.json(OWASP_TOP10_2021);
});

function safeParse(s) { try { return JSON.parse(s) || {}; } catch (e) { return {}; } }

// A user's own saved finding templates.
router.get('/my-templates', async (req, res, next) => {
  try {
    const rows = await db.prepare('SELECT id, name, data FROM finding_templates WHERE user_id = ? ORDER BY name').all(req.userId);
    res.json(rows.map((r) => ({ id: r.id, name: r.name, ...safeParse(r.data) })));
  } catch (e) { next(e); }
});

router.post('/my-templates', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 120);
    if (!name) return res.status(400).json({ error: 'Template name is required' });
    const v = validateFinding(req.body);
    const data = JSON.stringify({
      title: v.title, category: v.category, scope_type: v.scope_type, owasp_category: v.owasp_category,
      cwe_id: v.cwe_id, impact: v.impact, likelihood: v.likelihood, cvss_vector: v.cvss_vector,
      description: v.description, remediation: v.remediation,
    });
    const id = nanoid();
    await db.prepare('INSERT INTO finding_templates (id, user_id, name, data) VALUES (?, ?, ?, ?)').run(id, req.userId, name, data);
    res.status(201).json({ id, name });
  } catch (e) { next(e); }
});

router.delete('/my-templates/:id', async (req, res, next) => {
  try {
    await db.prepare('DELETE FROM finding_templates WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
