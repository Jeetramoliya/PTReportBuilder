const db = require('../db');
const { deleteUpload } = require('../uploads');

// Manual cascade deletes (no DB-level foreign keys, so this works on both the node:sqlite
// and Turso backends). Also removes the image blobs stored in the uploads table.

async function deleteProjectCascade(projectId) {
  const findings = await db.prepare('SELECT id FROM findings WHERE project_id = ?').all(projectId);
  for (const f of findings) {
    const steps = await db.prepare('SELECT screenshot_path FROM poc_steps WHERE finding_id = ?').all(f.id);
    for (const s of steps) if (s.screenshot_path) await deleteUpload(s.screenshot_path);
    await db.prepare('DELETE FROM affected_urls WHERE finding_id = ?').run(f.id);
    await db.prepare('DELETE FROM poc_steps WHERE finding_id = ?').run(f.id);
    await db.prepare('DELETE FROM finding_references WHERE finding_id = ?').run(f.id);
    await db.prepare('DELETE FROM retest_events WHERE finding_id = ?').run(f.id);
  }
  await db.prepare('DELETE FROM findings WHERE project_id = ?').run(projectId);
  await db.prepare('DELETE FROM scope_items WHERE project_id = ?').run(projectId);
  const proj = await db.prepare('SELECT logo_path FROM projects WHERE id = ?').get(projectId);
  if (proj && proj.logo_path) await deleteUpload(proj.logo_path);
  await db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
}

async function deleteUserCascade(userId) {
  const projects = await db.prepare('SELECT id FROM projects WHERE user_id = ?').all(userId);
  for (const p of projects) await deleteProjectCascade(p.id);
  await db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

module.exports = { deleteProjectCascade, deleteUserCascade };
