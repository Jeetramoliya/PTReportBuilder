const path = require('path');
const fs = require('fs');

// Local node:sqlite backend stores its file under DATA_DIR (defaults to the project root,
// giving ./data/vapt.db). In production the DB is Turso and uploads live in the DB, so this
// path is only used for local development. Uploaded images are stored in the DB, not on disk.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..');
const DB_PATH = path.join(DATA_DIR, 'data', 'vapt.db');

if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

module.exports = { DATA_DIR, DB_PATH };
