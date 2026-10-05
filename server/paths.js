const path = require('path');
const fs = require('fs');

// All mutable data (the SQLite database and uploaded logos/screenshots) lives under
// DATA_DIR. On a host with a persistent disk, point DATA_DIR at the mounted volume
// (e.g. /data) so nothing is lost on redeploy. Defaults to the project root, preserving
// the original local layout (./data/vapt.db, ./uploads/...).
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'data', 'vapt.db');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(path.dirname(DB_PATH));
ensureDir(path.join(UPLOADS_DIR, 'logos'));
ensureDir(path.join(UPLOADS_DIR, 'screenshots'));

// Maps a stored relative upload path (e.g. "uploads/logos/x.png") to its absolute path
// under DATA_DIR, so stored paths stay portable across hosts.
function resolveUpload(relPath) {
  return path.join(DATA_DIR, relPath);
}

module.exports = { DATA_DIR, UPLOADS_DIR, DB_PATH, resolveUpload };
