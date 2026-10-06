const { isAdminUser } = require('../utils/admin');

// Gate for admin-only routes. Runs after requireAuth, so req.user is already set.
module.exports = function requireAdmin(req, res, next) {
  if (isAdminUser(req.user)) return next();
  return res.status(403).json({ error: 'Admin access required' });
};
