const { nanoid } = require('nanoid');
const db = require('./db');

// Uploaded images (logos, PoC screenshots) are stored as rows in the `uploads` table so
// they persist on hosts without a writable disk. The value kept on projects/poc_steps is
// a virtual path of the form "uploads/<id>", served by the /uploads/:id route.

async function saveUpload(buffer, mime, ext) {
  const id = nanoid();
  await db.prepare('INSERT INTO uploads (id, mime, ext, data) VALUES (?, ?, ?, ?)')
    .run(id, mime || '', ext || '', buffer);
  return `uploads/${id}`;
}

function toId(ref) {
  return String(ref || '').replace(/^\/?uploads\//, '');
}

async function getUpload(ref) {
  const id = toId(ref);
  if (!id) return null;
  const row = await db.prepare('SELECT * FROM uploads WHERE id = ?').get(id);
  if (!row || row.data == null) return null;
  return { mime: row.mime, ext: row.ext, data: Buffer.from(row.data) };
}

async function deleteUpload(ref) {
  const id = toId(ref);
  if (id) await db.prepare('DELETE FROM uploads WHERE id = ?').run(id);
}

module.exports = { saveUpload, getUpload, deleteUpload };
