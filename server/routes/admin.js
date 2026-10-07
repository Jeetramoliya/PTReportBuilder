const express = require('express');
const path = require('path');
const ejs = require('ejs');
const db = require('../db');
const auth = require('../utils/userAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { deleteUserCascade } = require('../utils/cascade');
const { isEnvAdmin } = require('../utils/admin');
const { logAudit, recentAudit } = require('../utils/audit');
const { buildReportData } = require('../utils/reportData');

const router = express.Router();
const templatePath = path.join(__dirname, '..', 'templates', 'report.ejs');
router.use(requireAdmin);

// Recent admin/security actions.
router.get('/audit', async (req, res, next) => {
  try { res.json(await recentAudit(150)); } catch (e) { next(e); }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Overview stats.
router.get('/stats', async (req, res, next) => {
  try {
    const users = (await db.prepare('SELECT COUNT(*) AS c FROM users').get()).c;
    const projects = (await db.prepare('SELECT COUNT(*) AS c FROM projects').get()).c;
    const findings = (await db.prepare('SELECT COUNT(*) AS c FROM findings').get()).c;
    res.json({ users, projects, findings });
  } catch (e) { next(e); }
});

// All users with their project + finding counts and admin status.
router.get('/users', async (req, res, next) => {
  try {
    const rows = await db.prepare(
      `SELECT u.id, u.email, u.name, u.is_admin, u.plan, u.created_at,
         (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS project_count,
         (SELECT COUNT(*) FROM findings f JOIN projects p ON p.id = f.project_id WHERE p.user_id = u.id) AS finding_count
       FROM users u ORDER BY u.created_at DESC`
    ).all();
    res.json(rows.map((r) => ({
      ...r,
      plan: r.plan || 'free',
      is_env_admin: isEnvAdmin(r.email),            // owner account — can't be changed/removed
      is_admin: Number(r.is_admin) === 1 || isEnvAdmin(r.email),
    })));
  } catch (e) { next(e); }
});

// Set a user's plan (free/pro).
router.patch('/users/:id/plan', async (req, res, next) => {
  try {
    const plan = req.body.plan === 'pro' ? 'pro' : 'free';
    const target = await db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    await auth.setPlan(target.id, plan);
    logAudit(req.user, 'user.plan', `${target.email} -> ${plan}`);
    res.json({ ok: true, plan });
  } catch (e) { next(e); }
});

// All projects across users (oversight).
router.get('/projects', async (req, res, next) => {
  try {
    const rows = await db.prepare(
      `SELECT p.id, p.name, p.client_name, p.updated_at, u.email AS owner_email,
         (SELECT COUNT(*) FROM findings f WHERE f.project_id = p.id) AS finding_count
       FROM projects p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.updated_at DESC`
    ).all();
    res.json(rows);
  } catch (e) { next(e); }
});

// View any project's report (read-only, images inlined). Oversight / support.
router.get('/projects/:id/report', async (req, res, next) => {
  try {
    const data = await buildReportData(req.params.id, { inline: true });
    if (!data) return res.status(404).send('Project not found');
    logAudit(req.user, 'report.view', `${data.project.name} (${data.project.id})`);
    res.send(await ejs.renderFile(templatePath, data));
  } catch (e) { next(e); }
});

// Signups + new projects per day for the last 30 days.
router.get('/chart', async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const users = await db.prepare("SELECT substr(created_at,1,10) AS day, COUNT(*) AS c FROM users WHERE substr(created_at,1,10) >= ? GROUP BY day").all(since);
    const projects = await db.prepare("SELECT substr(created_at,1,10) AS day, COUNT(*) AS c FROM projects WHERE substr(created_at,1,10) >= ? GROUP BY day").all(since);
    const toMap = (rows) => Object.fromEntries(rows.map((r) => [r.day, r.c]));
    const uMap = toMap(users); const pMap = toMap(projects);
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      days.push({ day: d, users: uMap[d] || 0, projects: pMap[d] || 0 });
    }
    res.json(days);
  } catch (e) { next(e); }
});

// Create a new user (optionally an admin).
router.post('/users', async (req, res, next) => {
  try {
    const email = auth.normalizeEmail(req.body.email);
    const name = String(req.body.name || '').trim();
    const password = req.body.password || '';
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await auth.findUserByEmail(email)) return res.status(409).json({ error: 'An account with that email already exists' });
    const user = await auth.createUser(email, name, password, { isAdmin: !!req.body.is_admin });
    logAudit(req.user, 'user.create', `${email}${req.body.is_admin ? ' (admin)' : ''}`);
    res.status(201).json({ id: user.id, email: user.email });
  } catch (e) { next(e); }
});

// Grant or revoke admin on an existing user. Env (owner) admins and your own account can't
// be changed here (prevents lockout).
router.patch('/users/:id/admin', async (req, res, next) => {
  try {
    const target = await db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (isEnvAdmin(target.email)) return res.status(400).json({ error: 'Owner admin accounts cannot be changed here.' });
    if (target.id === req.user.id) return res.status(400).json({ error: "You can't change your own admin status." });
    await auth.setAdmin(target.id, !!req.body.is_admin);
    logAudit(req.user, req.body.is_admin ? 'user.promote' : 'user.demote', target.email);
    res.json({ ok: true, is_admin: !!req.body.is_admin });
  } catch (e) { next(e); }
});

// Remove a user and all their data. Owner admins and your own account are protected.
router.delete('/users/:id', async (req, res, next) => {
  try {
    const target = await db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (isEnvAdmin(target.email)) return res.status(400).json({ error: 'Owner admin accounts cannot be removed here.' });
    if (target.id === req.user.id) return res.status(400).json({ error: "You can't remove your own account here." });
    await deleteUserCascade(target.id);
    logAudit(req.user, 'user.delete', target.email);
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
