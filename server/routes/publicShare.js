const express = require('express');
const path = require('path');
const ejs = require('ejs');
const db = require('../db');
const { buildReportData } = require('../utils/reportData');

// Public, read-only report view reached via an unguessable share token. Mounted BEFORE the
// auth middleware. Images are inlined as data URIs so nothing here needs the session.
const router = express.Router();
const templatePath = path.join(__dirname, '..', 'templates', 'report.ejs');

router.get('/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token || '');
    if (token.length < 16) return res.status(404).send('Not found');
    const proj = await db.prepare('SELECT id FROM projects WHERE share_token = ?').get(token);
    if (!proj) return res.status(404).send('This share link is invalid or has been revoked.');
    const data = await buildReportData(proj.id, { inline: true });
    if (!data) return res.status(404).send('Not found');
    res.send(await ejs.renderFile(templatePath, data));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
