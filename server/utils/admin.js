// Admin status has two sources:
//   - Env admins (ADMIN_EMAILS): the un-removable owner accounts, always admin.
//   - DB admins (users.is_admin): granted/revoked at runtime by another admin.
function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// True for the fixed owner accounts configured in the environment. These cannot be demoted
// or deleted through the admin UI.
function isEnvAdmin(email) {
  return !!email && adminEmails().includes(String(email).toLowerCase());
}

// Effective admin check for a user row (env OR the DB flag).
function isAdminUser(user) {
  return !!(user && (Number(user.is_admin) === 1 || isEnvAdmin(user.email)));
}

module.exports = { adminEmails, isEnvAdmin, isAdminUser };
