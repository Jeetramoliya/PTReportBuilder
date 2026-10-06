const { nanoid } = require('nanoid');
const db = require('../db');
const { deleteUpload, getUpload, saveUpload } = require('../uploads');

// Copies an uploaded image blob to a new row and returns its new ref ('' if missing).
async function copyUpload(ref) {
  if (!ref) return '';
  const up = await getUpload(ref);
  return up ? saveUpload(up.data, up.mime, up.ext) : '';
}

// INSERTs a copy of `row` into `table`, taking every column except the excluded ones and
// applying `overrides` (e.g. a fresh id and the new parent id).
async function insertCopy(table, row, exclude, overrides) {
  const cols = Object.keys(row).filter((k) => !exclude.includes(k));
  const allCols = [...Object.keys(overrides), ...cols];
  const vals = [...Object.values(overrides), ...cols.map((k) => row[k])];
  await db.prepare(`INSERT INTO ${table} (${allCols.join(', ')}) VALUES (${allCols.map(() => '?').join(', ')})`).run(...vals);
}

// Deep-copies a project (scope, findings and all their sub-rows, plus logo/screenshot image
// blobs) for the same user. Returns the new project id, or null if the source is gone.
async function cloneProject(srcId, userId) {
  const src = await db.prepare('SELECT * FROM projects WHERE id = ?').get(srcId);
  if (!src) return null;
  const newId = nanoid();
  const logoPath = await copyUpload(src.logo_path);
  await insertCopy('projects', src, ['id', 'user_id', 'name', 'logo_path', 'created_at', 'updated_at'],
    { id: newId, user_id: userId, name: `${src.name || 'Project'} (Copy)`, logo_path: logoPath });

  const scope = await db.prepare('SELECT * FROM scope_items WHERE project_id = ?').all(srcId);
  for (const s of scope) await insertCopy('scope_items', s, ['id', 'project_id'], { id: nanoid(), project_id: newId });

  const findings = await db.prepare('SELECT * FROM findings WHERE project_id = ?').all(srcId);
  for (const f of findings) {
    const nfId = nanoid();
    await insertCopy('findings', f, ['id', 'project_id', 'created_at', 'updated_at'], { id: nfId, project_id: newId });

    const urls = await db.prepare('SELECT * FROM affected_urls WHERE finding_id = ?').all(f.id);
    for (const u of urls) await insertCopy('affected_urls', u, ['id', 'finding_id'], { id: nanoid(), finding_id: nfId });

    const steps = await db.prepare('SELECT * FROM poc_steps WHERE finding_id = ?').all(f.id);
    for (const s of steps) {
      const shot = await copyUpload(s.screenshot_path);
      await insertCopy('poc_steps', s, ['id', 'finding_id', 'screenshot_path'], { id: nanoid(), finding_id: nfId, screenshot_path: shot });
    }

    const refs = await db.prepare('SELECT * FROM finding_references WHERE finding_id = ?').all(f.id);
    for (const r of refs) await insertCopy('finding_references', r, ['id', 'finding_id'], { id: nanoid(), finding_id: nfId });

    const evs = await db.prepare('SELECT * FROM retest_events WHERE finding_id = ?').all(f.id);
    for (const ev of evs) await insertCopy('retest_events', ev, ['id', 'finding_id', 'created_at'], { id: nanoid(), finding_id: nfId });
  }
  return newId;
}

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

module.exports = { deleteProjectCascade, deleteUserCascade, cloneProject };
