const express = require('express');
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const { deleteUserCascade } = require('../utils/cascade');
const { isAdmin } = require('../utils/admin');

const router = express.Router();
router.use(requireAdmin);

// Overview stats.
router.get('/stats', async (req, res, next) => {
  try {
    const users = (await db.prepare('SELECT COUNT(*) AS c FROM users').get()).c;
    const projects = (await db.prepare('SELECT COUNT(*) AS c FROM projects').get()).c;
    const findings = (await db.prepare('SELECT COUNT(*) AS c FROM findings').get()).c;
    res.json({ users, projects, findings });
  } catch (e) { next(e); }
});

// All users with their project + finding counts.
router.get('/users', async (req, res, next) => {
  try {
    const rows = await db.prepare(
      `SELECT u.id, u.email, u.name, u.created_at,
         (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS project_count,
         (SELECT COUNT(*) FROM findings f JOIN projects p ON p.id = f.project_id WHERE p.user_id = u.id) AS finding_count
       FROM users u ORDER BY u.created_at DESC`
    ).all();
    res.json(rows.map((r) => ({ ...r, is_admin: isAdmin(r.email) })));
  } catch (e) { next(e); }
});

// Remove a user and all their data. Admins (including yourself) can't be deleted here.
router.delete('/users/:id', async (req, res, next) => {
  try {
    const target = await db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (isAdmin(target.email)) return res.status(400).json({ error: 'Admin accounts cannot be removed here.' });
    await deleteUserCascade(target.id);
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
