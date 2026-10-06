const { isAdmin } = require('../utils/admin');

// Gate for admin-only routes. Runs after requireAuth, so req.user is already set.
module.exports = function requireAdmin(req, res, next) {
  if (req.user && isAdmin(req.user.email)) return next();
  return res.status(403).json({ error: 'Admin access required' });
};
