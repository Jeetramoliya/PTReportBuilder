const express = require('express');
const auth = require('../utils/userAuth');
const { deleteUserCascade } = require('../utils/cascade');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();

// Brute-force protection on credential endpoints.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });   // 20 / 15 min per IP
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 });  // 10 / hour per IP

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/me', async (req, res, next) => {
  try {
    const cookies = auth.parseCookies(req);
    const user = await auth.userForSession(cookies[auth.SESSION_COOKIE]);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

router.post('/signup', signupLimiter, async (req, res, next) => {
  try {
    const email = auth.normalizeEmail(req.body.email);
    const name = String(req.body.name || '').trim();
    const password = req.body.password || '';
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await auth.findUserByEmail(email)) return res.status(409).json({ error: 'An account with that email already exists' });

    const user = await auth.createUser(email, name, password);
    const token = await auth.createSession(user.id);
    auth.setSessionCookie(res, token);
    res.status(201).json({ user });
  } catch (e) {
    next(e);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = auth.normalizeEmail(req.body.email);
    const password = req.body.password || '';
    const row = await auth.findUserByEmail(email);
    if (!row || !auth.verifyPassword(password, row.password_hash)) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }
    const token = await auth.createSession(row.id);
    auth.setSessionCookie(res, token);
    res.json({ user: { id: row.id, email: row.email, name: row.name } });
  } catch (e) {
    next(e);
  }
});

// Change the signed-in user's password (requires the current one). Self-authenticating.
router.post('/change-password', loginLimiter, async (req, res, next) => {
  try {
    const cookies = auth.parseCookies(req);
    const user = await auth.userForSession(cookies[auth.SESSION_COOKIE]);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    const newPassword = req.body.new_password || '';
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const row = await auth.findUserByEmail(user.email);
    if (!row || !auth.verifyPassword(req.body.current_password || '', row.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    await auth.updatePassword(user.id, newPassword);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Permanently delete the signed-in user and all their data. This router is mounted before
// requireAuth, so it resolves the session itself (like /me).
router.delete('/account', async (req, res, next) => {
  try {
    const cookies = auth.parseCookies(req);
    const user = await auth.userForSession(cookies[auth.SESSION_COOKIE]);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    await deleteUserCascade(user.id);
    auth.clearSessionCookie(res);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const cookies = auth.parseCookies(req);
    await auth.destroySession(cookies[auth.SESSION_COOKIE]);
    auth.clearSessionCookie(res);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
