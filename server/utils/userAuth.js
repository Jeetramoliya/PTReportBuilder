const crypto = require('crypto');
const { nanoid } = require('nanoid');
const db = require('../db');

const SESSION_COOKIE = 'vapt_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(derived, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function createUser(email, name, password, opts = {}) {
  const id = nanoid();
  await db.prepare('INSERT INTO users (id, email, name, password_hash, is_admin) VALUES (?, ?, ?, ?, ?)')
    .run(id, normalizeEmail(email), String(name || '').trim(), hashPassword(password), opts.isAdmin ? 1 : 0);
  return db.prepare('SELECT id, email, name, is_admin, created_at FROM users WHERE id = ?').get(id);
}

function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email));
}

async function updatePassword(userId, newPassword) {
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), userId);
}

async function setAdmin(userId, flag) {
  await db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(flag ? 1 : 0, userId);
}

async function setPlan(userId, plan) {
  await db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan === 'pro' ? 'pro' : 'free', userId);
}

// Creates any admin accounts (ADMIN_EMAILS) that don't exist yet, using ADMIN_PASSWORD.
// Both env vars must be set; otherwise this is a no-op (admins can just sign up normally).
async function seedAdmins() {
  const emails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);
  const password = process.env.ADMIN_PASSWORD;
  if (!emails.length || !password) return;
  for (const email of emails) {
    if (!(await findUserByEmail(email))) {
      await createUser(email, 'Administrator', password);
      console.log(`Seeded admin account: ${normalizeEmail(email)}`);
    }
  }
}

function getUserById(id) {
  return db.prepare(`SELECT id, email, name, is_admin, plan, created_at,
    (CASE WHEN totp_secret <> '' THEN 1 ELSE 0 END) AS has_2fa FROM users WHERE id = ?`).get(id);
}

async function createSession(userId, meta = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db.prepare('INSERT INTO user_sessions (token, user_id, user_agent, ip, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(token, userId, String(meta.ua || '').slice(0, 300), String(meta.ip || '').slice(0, 60), expiresAt);
  return token;
}

async function destroySession(token) {
  if (token) await db.prepare('DELETE FROM user_sessions WHERE token = ?').run(token);
}

async function listSessions(userId, currentToken) {
  const rows = await db.prepare('SELECT token, user_agent, ip, created_at, expires_at FROM user_sessions WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  return rows.map((r) => ({
    id: r.token.slice(0, 12), user_agent: r.user_agent, ip: r.ip, created_at: r.created_at,
    current: r.token === currentToken,
  }));
}

async function revokeSession(userId, idPrefix, currentToken) {
  const rows = await db.prepare('SELECT token FROM user_sessions WHERE user_id = ?').all(userId);
  const match = rows.find((r) => r.token.slice(0, 12) === idPrefix && r.token !== currentToken);
  if (match) await db.prepare('DELETE FROM user_sessions WHERE token = ?').run(match.token);
}

async function revokeOtherSessions(userId, keepToken) {
  await db.prepare('DELETE FROM user_sessions WHERE user_id = ? AND token <> ?').run(userId, keepToken || '');
}

// --- TOTP (2FA) ---
async function setTotpPending(userId, secret) {
  await db.prepare('UPDATE users SET totp_pending = ? WHERE id = ?').run(secret, userId);
}
async function enableTotp(userId) {
  await db.prepare("UPDATE users SET totp_secret = totp_pending, totp_pending = '' WHERE id = ?").run(userId);
}
async function disableTotp(userId) {
  await db.prepare("UPDATE users SET totp_secret = '', totp_pending = '' WHERE id = ?").run(userId);
}
function getSecrets(userId) {
  return db.prepare('SELECT totp_secret, totp_pending FROM users WHERE id = ?').get(userId);
}

// Returns the user row for a valid, unexpired session token, or null.
async function userForSession(token) {
  if (!token) return null;
  const row = await db.prepare('SELECT user_id, expires_at FROM user_sessions WHERE token = ?').get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await destroySession(token);
    return null;
  }
  return (await getUserById(row.user_id)) || null;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Lax;${secure}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  normalizeEmail,
  createUser,
  findUserByEmail,
  getUserById,
  updatePassword,
  setAdmin,
  setPlan,
  seedAdmins,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  setTotpPending,
  enableTotp,
  disableTotp,
  getSecrets,
  createSession,
  destroySession,
  userForSession,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
};
