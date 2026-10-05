const auth = require('../utils/userAuth');

// Pages and assets reachable without a session (so the login page can render and submit).
const PUBLIC_API = ['/api/auth/login', '/api/auth/signup', '/api/auth/me', '/api/auth/logout'];
const PUBLIC_PAGES = ['/login.html'];
const PUBLIC_PREFIXES = ['/css/', '/js/'];

module.exports = async function requireAuth(req, res, next) {
  try {
    if (PUBLIC_API.includes(req.path) || PUBLIC_PAGES.includes(req.path)) return next();
    if (PUBLIC_PREFIXES.some((p) => req.path.startsWith(p))) return next();

    const cookies = auth.parseCookies(req);
    const user = await auth.userForSession(cookies[auth.SESSION_COOKIE]);
    if (user) {
      req.user = user;
      req.userId = user.id;
      return next();
    }

    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Authentication required' });
    return res.redirect('/login.html');
  } catch (e) {
    next(e);
  }
};
