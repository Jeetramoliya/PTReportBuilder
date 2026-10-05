const authStore = require('../utils/authStore');

const PUBLIC_API_PATHS = ['/api/auth/status', '/api/auth/login'];
const PUBLIC_PAGES = ['/login.html'];
const PUBLIC_PREFIXES = ['/css/', '/js/']; // static assets needed to render the login page itself

module.exports = function requireAuth(req, res, next) {
  if (!authStore.isAuthEnabled()) return next();

  if (PUBLIC_API_PATHS.includes(req.path) || PUBLIC_PAGES.includes(req.path)) return next();
  if (PUBLIC_PREFIXES.some((p) => req.path.startsWith(p))) return next();

  const cookies = authStore.parseCookies(req);
  const token = cookies[authStore.SESSION_COOKIE];
  if (authStore.isValidSession(token)) return next();

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return res.redirect('/login.html');
};
