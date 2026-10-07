const db = require('../db');

// A user's access to a project: 'owner' | 'editor' | 'viewer' | null.
async function projectRole(projectId, userId) {
  const p = await db.prepare('SELECT user_id FROM projects WHERE id = ?').get(projectId);
  if (!p) return null;
  if (p.user_id === userId) return 'owner';
  const c = await db.prepare('SELECT role FROM project_collaborators WHERE project_id = ? AND user_id = ?').get(projectId, userId);
  if (!c) return null;
  return c.role === 'viewer' ? 'viewer' : 'editor';
}

function canWrite(role) { return role === 'owner' || role === 'editor'; }

module.exports = { projectRole, canWrite };
