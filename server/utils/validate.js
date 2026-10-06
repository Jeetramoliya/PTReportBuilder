// Server-side input validation for write endpoints. Enum fields are whitelisted against the
// real option lists, colours must be hex, and free text is length-capped — so bad input
// can't break report rendering or bloat the database.
const { THEMES, COVER_STYLES, PAGE_BACKGROUNDS, HEADER_FOOTER_STYLES, COVER_ALIGNMENTS, WORDMARK_STYLES } = require('./themes');
const { FONTS } = require('./fonts');

const SKIP = Symbol('skip'); // "leave this field unchanged"
const LEVELS = ['High', 'Medium', 'Low'];
const SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Info', 'None'];

function clampStr(v, max) {
  return String(v == null ? '' : v).slice(0, max);
}

const PROJECT_ENUMS = {
  theme: ['custom', ...Object.keys(THEMES)],
  cover_style: COVER_STYLES.map((s) => s.key),
  font_family: Object.keys(FONTS),
  page_background: PAGE_BACKGROUNDS.map((b) => b.key),
  header_footer_style: HEADER_FOOTER_STYLES.map((s) => s.key),
  cover_alignment: COVER_ALIGNMENTS.map((a) => a.key),
  wordmark_style: WORDMARK_STYLES.map((w) => w.key),
  wordmark_size: ['small', 'medium', 'large', 'xlarge'],
};
const PROJECT_HEX = ['wordmark_color', 'wordmark_color2', 'custom_brand_color'];
const PROJECT_BOOL = ['wordmark_bold', 'wordmark_italic', 'wordmark_underline'];
const PROJECT_LONG = ['executive_summary', 'methodology', 'client_address'];

// Returns a sanitised value for a project field, or SKIP to leave it unchanged (invalid enum
// / malformed colour). '' is allowed for colours so the user can clear them.
function coerceProjectField(f, v) {
  if (PROJECT_ENUMS[f]) return PROJECT_ENUMS[f].includes(v) ? v : SKIP;
  if (PROJECT_HEX.includes(f)) { const s = String(v == null ? '' : v); return s === '' || /^#[0-9a-fA-F]{6}$/.test(s) ? s : SKIP; }
  if (PROJECT_BOOL.includes(f)) return v ? 1 : 0;
  if (f === 'wordmark_split') { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 && n <= 200 ? n : 0; }
  if (f === 'finding_prefix') return clampStr(v, 12).toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'WEB';
  if (f === 'watermark_text') return clampStr(v, 40);
  if (PROJECT_LONG.includes(f)) return clampStr(v, 20000);
  return clampStr(v, 2000);
}

// Validates/clamps a finding payload. `severity` is returned only if explicitly valid;
// otherwise undefined so the caller derives it from the risk matrix / CVSS.
function validateFinding(body, prev) {
  prev = prev || {};
  return {
    impact: LEVELS.includes(body.impact) ? body.impact : (prev.impact || 'Medium'),
    likelihood: LEVELS.includes(body.likelihood) ? body.likelihood : (prev.likelihood || 'Medium'),
    severity: SEVERITIES.includes(body.severity) ? body.severity : undefined,
    title: clampStr(body.title, 300).trim(),
    category: clampStr(body.category, 200),
    scope_type: clampStr(body.scope_type, 120),
    owasp_category: clampStr(body.owasp_category, 160),
    cwe_id: clampStr(body.cwe_id, 40),
    status: clampStr(body.status, 40),
    description: clampStr(body.description, 20000),
    remediation: clampStr(body.remediation, 20000),
    cvss_vector: clampStr(body.cvss_vector, 160),
    identifier: clampStr(body.identifier, 40),
  };
}

module.exports = { SKIP, coerceProjectField, validateFinding, clampStr, LEVELS, SEVERITIES };
