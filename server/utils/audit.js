const { nanoid } = require('nanoid');
const db = require('../db');

// Records an admin/security action. Best-effort: never throws into the request path.
async function logAudit(actor, action, detail) {
  try {
    await db.prepare('INSERT INTO audit_log (id, actor_id, actor_email, action, detail) VALUES (?, ?, ?, ?, ?)')
      .run(nanoid(), (actor && actor.id) || '', (actor && actor.email) || '', String(action || '').slice(0, 80), String(detail || '').slice(0, 500));
  } catch (e) { /* ignore */ }
}

function recentAudit(limit = 100) {
  return db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC, rowid DESC LIMIT ?').all(Math.min(Number(limit) || 100, 500));
}

module.exports = { logAudit, recentAudit };
