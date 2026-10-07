// Simple plan limits. Free accounts are capped; pro and admins are unlimited.
const FREE_PROJECT_LIMIT = Number(process.env.FREE_PROJECT_LIMIT || 5);

function projectLimit(user, isAdmin) {
  if (isAdmin || (user && user.plan === 'pro')) return Infinity;
  return FREE_PROJECT_LIMIT;
}

module.exports = { FREE_PROJECT_LIMIT, projectLimit };
