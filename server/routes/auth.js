const express = require('express');
const auth = require('../utils/userAuth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/me', (req, res) => {
  const cookies = auth.parseCookies(req);
  const user = auth.userForSession(cookies[auth.SESSION_COOKIE]);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  res.json({ user });
});

router.post('/signup', (req, res) => {
  const email = auth.normalizeEmail(req.body.email);
  const name = String(req.body.name || '').trim();
  const password = req.body.password || '';
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (auth.findUserByEmail(email)) return res.status(409).json({ error: 'An account with that email already exists' });

  const user = auth.createUser(email, name, password);
  const token = auth.createSession(user.id);
  auth.setSessionCookie(res, token);
  res.status(201).json({ user });
});

router.post('/login', (req, res) => {
  const email = auth.normalizeEmail(req.body.email);
  const password = req.body.password || '';
  const row = auth.findUserByEmail(email);
  if (!row || !auth.verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  const token = auth.createSession(row.id);
  auth.setSessionCookie(res, token);
  res.json({ user: { id: row.id, email: row.email, name: row.name } });
});

router.post('/logout', (req, res) => {
  const cookies = auth.parseCookies(req);
  auth.destroySession(cookies[auth.SESSION_COOKIE]);
  auth.clearSessionCookie(res);
  res.json({ ok: true });
});

module.exports = router;
