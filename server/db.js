// Database layer with two interchangeable backends behind one small async API:
//   - Turso (remote libsql) when DATABASE_URL is a libsql:// / https:// URL — used in
//     production so data persists without a local disk.
//   - node:sqlite (local file) otherwise — used for local development.
// Both expose: db.exec(sql) and db.prepare(sql).{get,all,run}(...args), all async.

const { DB_PATH } = require('./paths');

const DATABASE_URL = process.env.DATABASE_URL || '';
const useTurso = /^(libsql|https?):/i.test(DATABASE_URL);

let backend;

if (useTurso) {
  const { createClient } = require('@libsql/client/web');
  const client = createClient({ url: DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN });

  const toObj = (row, columns) => {
    const o = {};
    columns.forEach((c, i) => { o[c] = row[i]; });
    return o;
  };

  backend = {
    async exec(sql) { await client.execute(sql); },
    prepare(sql) {
      return {
        async get(...args) {
          const r = await client.execute({ sql, args });
          return r.rows[0] ? toObj(r.rows[0], r.columns) : undefined;
        },
        async all(...args) {
          const r = await client.execute({ sql, args });
          return r.rows.map((row) => toObj(row, r.columns));
        },
        async run(...args) {
          return client.execute({ sql, args });
        },
      };
    },
  };
} else {
  const { DatabaseSync } = require('node:sqlite');
  const sdb = new DatabaseSync(DB_PATH);
  sdb.exec('PRAGMA foreign_keys = ON');

  backend = {
    async exec(sql) { sdb.exec(sql); },
    prepare(sql) {
      const st = sdb.prepare(sql);
      return {
        async get(...args) { return st.get(...args); },
        async all(...args) { return st.all(...args); },
        async run(...args) { return st.run(...args); },
      };
    },
  };
}

// Each table as its own statement so it works on both backends (libsql executes one
// statement per call).
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS user_sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT '',
    name TEXT NOT NULL,
    client_name TEXT DEFAULT '',
    client_address TEXT DEFAULT '',
    client_website TEXT DEFAULT '',
    company_name TEXT DEFAULT '',
    wordmark_style TEXT DEFAULT 'underline',
    wordmark_bold INTEGER DEFAULT 1,
    wordmark_italic INTEGER DEFAULT 0,
    wordmark_underline INTEGER DEFAULT 0,
    wordmark_size TEXT DEFAULT 'medium',
    wordmark_color TEXT DEFAULT '',
    wordmark_color2 TEXT DEFAULT '',
    wordmark_split INTEGER DEFAULT 0,
    logo_path TEXT DEFAULT '',
    finding_prefix TEXT DEFAULT 'WEB',
    report_title TEXT DEFAULT '',
    report_subtitle TEXT DEFAULT '',
    iteration_label TEXT DEFAULT '',
    theme TEXT DEFAULT 'navy',
    cover_style TEXT DEFAULT 'classic',
    cover_alignment TEXT DEFAULT 'left',
    font_family TEXT DEFAULT 'sans',
    custom_brand_color TEXT DEFAULT '',
    watermark_text TEXT DEFAULT '',
    page_background TEXT DEFAULT 'white',
    header_footer_style TEXT DEFAULT 'minimal',
    assessment_date TEXT DEFAULT '',
    tester_name TEXT DEFAULT '',
    prepared_by_org TEXT DEFAULT '',
    tagline TEXT DEFAULT 'Confidential & Proprietary',
    executive_summary TEXT DEFAULT '',
    methodology TEXT DEFAULT '',
    share_token TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS scope_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    group_name TEXT DEFAULT 'Scope',
    item_type TEXT DEFAULT 'url',
    tenant TEXT DEFAULT 'ALL',
    url TEXT DEFAULT '',
    app_name TEXT DEFAULT '',
    app_version TEXT DEFAULT '',
    platform TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS findings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    identifier TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT '',
    scope_type TEXT DEFAULT 'Web Application',
    owasp_category TEXT DEFAULT '',
    cwe_id TEXT DEFAULT '',
    severity TEXT DEFAULT 'Medium',
    impact TEXT DEFAULT 'Medium',
    likelihood TEXT DEFAULT 'Medium',
    risk_rating TEXT DEFAULT 'Medium',
    cvss_vector TEXT DEFAULT '',
    cvss_score REAL DEFAULT 0,
    status TEXT DEFAULT 'Open',
    description TEXT DEFAULT '',
    remediation TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS affected_urls (
    id TEXT PRIMARY KEY,
    finding_id TEXT NOT NULL,
    url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS poc_steps (
    id TEXT PRIMARY KEY,
    finding_id TEXT NOT NULL,
    step_text TEXT DEFAULT '',
    payload TEXT DEFAULT '',
    screenshot_path TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS finding_references (
    id TEXT PRIMARY KEY,
    finding_id TEXT NOT NULL,
    label TEXT DEFAULT '',
    url TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS retest_events (
    id TEXT PRIMARY KEY,
    finding_id TEXT NOT NULL,
    event_date TEXT DEFAULT '',
    previous_status TEXT DEFAULT '',
    new_status TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  // Uploaded logos/screenshots are stored in the database (not on disk) so they survive
  // on hosts without a persistent filesystem.
  `CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    mime TEXT DEFAULT '',
    ext TEXT DEFAULT '',
    data BLOB,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  // A user's own reusable finding templates (data is the finding payload as JSON).
  `CREATE TABLE IF NOT EXISTS finding_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  // Short-lived password reset tokens.
  `CREATE TABLE IF NOT EXISTS password_resets (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
];

// Idempotent column additions for databases created before the column existed. Each runs on
// every boot; "duplicate column" errors are expected and ignored.
const MIGRATIONS = [
  "ALTER TABLE projects ADD COLUMN share_token TEXT DEFAULT ''",
  'ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0',
];

async function initDb() {
  for (const stmt of SCHEMA) {
    await backend.exec(stmt);
  }
  for (const stmt of MIGRATIONS) {
    try { await backend.exec(stmt); } catch (e) {
      if (!/duplicate column/i.test(e.message || '')) throw e;
    }
  }
}

module.exports = backend;
module.exports.initDb = initDb;
