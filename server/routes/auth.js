const express = require('express');
const authStore = require('../utils/authStore');

const router = express.Router();

router.get('/status', (req, res) => {
  res.json({ enabled: authStore.isAuthEnabled() });
});

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!authStore.isAuthEnabled()) return res.status(400).json({ error: 'Password protection is not enabled' });
  if (!password || !authStore.checkPassword(password)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  const token = authStore.createSession();
  authStore.setSessionCookie(res, token);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  const cookies = authStore.parseCookies(req);
  authStore.destroySession(cookies[authStore.SESSION_COOKIE]);
  authStore.clearSessionCookie(res);
  res.json({ ok: true });
});

// Enable password protection for the first time (no auth required to call this while disabled).
router.post('/enable', (req, res) => {
  if (authStore.isAuthEnabled()) return res.status(400).json({ error: 'Already enabled. Use change-password instead.' });
  const { password } = req.body;
  if (!password || password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  authStore.setPassword(password);
  const token = authStore.createSession();
  authStore.setSessionCookie(res, token);
  res.json({ ok: true });
});

router.post('/change-password', (req, res) => {
  const { current_password, new_password } = req.body;
  if (!authStore.isAuthEnabled()) return res.status(400).json({ error: 'Password protection is not enabled' });
  if (!authStore.checkPassword(current_password)) return res.status(401).json({ error: 'Current password is incorrect' });
  if (!new_password || new_password.length < 4) return res.status(400).json({ error: 'New password must be at least 4 characters' });
  authStore.setPassword(new_password);
  const token = authStore.createSession();
  authStore.setSessionCookie(res, token);
  res.json({ ok: true });
});

router.post('/disable', (req, res) => {
  const { current_password } = req.body;
  if (!authStore.isAuthEnabled()) return res.json({ ok: true });
  if (!authStore.checkPassword(current_password)) return res.status(401).json({ error: 'Current password is incorrect' });
  authStore.clearPassword();
  authStore.clearSessionCookie(res);
  res.json({ ok: true });
});

module.exports = router;
