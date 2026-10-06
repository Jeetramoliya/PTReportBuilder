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

async function createUser(email, name, password) {
  const id = nanoid();
  await db.prepare('INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)')
    .run(id, normalizeEmail(email), String(name || '').trim(), hashPassword(password));
  return db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(id);
}

function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email));
}

async function updatePassword(userId, newPassword) {
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), userId);
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
  return db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(id);
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db.prepare('INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return token;
}

async function destroySession(token) {
  if (token) await db.prepare('DELETE FROM user_sessions WHERE token = ?').run(token);
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
  seedAdmins,
  createSession,
  destroySession,
  userForSession,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
};
