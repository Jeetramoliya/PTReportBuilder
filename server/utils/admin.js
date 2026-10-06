// Admin accounts are designated by the ADMIN_EMAILS env var (comma-separated), so admin
// rights live in config, not in a committed credential. A normal account whose email is in
// that list is an admin.
function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAdmin(email) {
  return !!email && adminEmails().includes(String(email).toLowerCase());
}

module.exports = { adminEmails, isAdmin };
