const { DatabaseSync } = require('node:sqlite');
const { DB_PATH } = require('./paths');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
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
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scope_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  group_name TEXT DEFAULT 'Scope',
  item_type TEXT DEFAULT 'url',
  tenant TEXT DEFAULT 'ALL',
  url TEXT DEFAULT '',
  app_name TEXT DEFAULT '',
  app_version TEXT DEFAULT '',
  platform TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS findings (
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
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS affected_urls (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS poc_steps (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  step_text TEXT DEFAULT '',
  payload TEXT DEFAULT '',
  screenshot_path TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS finding_references (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  label TEXT DEFAULT '',
  url TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS retest_events (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  event_date TEXT DEFAULT '',
  previous_status TEXT DEFAULT '',
  new_status TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT DEFAULT ''
);
`);

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('projects', 'report_subtitle', "TEXT DEFAULT ''");
ensureColumn('projects', 'iteration_label', "TEXT DEFAULT ''");
ensureColumn('projects', 'theme', "TEXT DEFAULT 'navy'");
ensureColumn('projects', 'cover_style', "TEXT DEFAULT 'classic'");
ensureColumn('scope_items', 'group_name', "TEXT DEFAULT 'Scope'");
ensureColumn('scope_items', 'item_type', "TEXT DEFAULT 'url'");
ensureColumn('scope_items', 'app_name', "TEXT DEFAULT ''");
ensureColumn('scope_items', 'app_version', "TEXT DEFAULT ''");
ensureColumn('scope_items', 'platform', "TEXT DEFAULT ''");
ensureColumn('projects', 'user_id', "TEXT DEFAULT ''");
ensureColumn('findings', 'scope_type', "TEXT DEFAULT 'Web Application'");
ensureColumn('findings', 'owasp_category', "TEXT DEFAULT ''");
ensureColumn('findings', 'cwe_id', "TEXT DEFAULT ''");
ensureColumn('poc_steps', 'payload', "TEXT DEFAULT ''");
ensureColumn('projects', 'font_family', "TEXT DEFAULT 'sans'");
ensureColumn('projects', 'custom_brand_color', "TEXT DEFAULT ''");
ensureColumn('projects', 'watermark_text', "TEXT DEFAULT ''");
ensureColumn('projects', 'page_background', "TEXT DEFAULT 'white'");
ensureColumn('projects', 'cover_alignment', "TEXT DEFAULT 'left'");
ensureColumn('projects', 'company_name', "TEXT DEFAULT ''");
ensureColumn('projects', 'wordmark_style', "TEXT DEFAULT 'underline'");
ensureColumn('projects', 'wordmark_bold', 'INTEGER DEFAULT 1');
ensureColumn('projects', 'wordmark_italic', 'INTEGER DEFAULT 0');
ensureColumn('projects', 'wordmark_underline', 'INTEGER DEFAULT 0');
ensureColumn('projects', 'wordmark_size', "TEXT DEFAULT 'medium'");
ensureColumn('projects', 'wordmark_color', "TEXT DEFAULT ''");
ensureColumn('projects', 'wordmark_color2', "TEXT DEFAULT ''");
ensureColumn('projects', 'wordmark_split', 'INTEGER DEFAULT 0');
ensureColumn('projects', 'header_footer_style', "TEXT DEFAULT 'minimal'");

module.exports = db;
