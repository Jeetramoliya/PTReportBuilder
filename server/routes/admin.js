const express = require('express');
const db = require('../db');
const auth = require('../utils/userAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { deleteUserCascade } = require('../utils/cascade');
const { isEnvAdmin } = require('../utils/admin');

const router = express.Router();
router.use(requireAdmin);

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
      `SELECT u.id, u.email, u.name, u.is_admin, u.created_at,
         (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS project_count,
         (SELECT COUNT(*) FROM findings f JOIN projects p ON p.id = f.project_id WHERE p.user_id = u.id) AS finding_count
       FROM users u ORDER BY u.created_at DESC`
    ).all();
    res.json(rows.map((r) => ({
      ...r,
      is_env_admin: isEnvAdmin(r.email),            // owner account — can't be changed/removed
      is_admin: Number(r.is_admin) === 1 || isEnvAdmin(r.email),
    })));
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
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
