// RFC 6238 TOTP (SHA-1, 30s step, 6 digits) + RFC 4648 base32, using only node:crypto.
const crypto = require('crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0; let value = 0; let out = '';
  for (const b of buf) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const s = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0; let value = 0; const out = [];
  for (const c of s) {
    value = (value << 5) | B32.indexOf(c); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20)); // 160-bit secret
}

function hotp(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[off] & 0x7f) << 24) | ((hmac[off + 1] & 0xff) << 16)
    | ((hmac[off + 2] & 0xff) << 8) | (hmac[off + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}

function totpToken(secret, t = Date.now()) {
  return hotp(secret, Math.floor(t / 1000 / 30));
}

// Accepts the current code ±`window` steps (clock skew tolerance).
function verifyTotp(secret, token, window = 1) {
  if (!secret || !/^\d{6}$/.test(String(token || ''))) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (crypto.timingSafeEqual(Buffer.from(hotp(secret, step + i)), Buffer.from(String(token)))) return true;
  }
  return false;
}

function otpauthUrl(secret, email, issuer = 'BlackRoot VAPT') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}`
    + `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
}

module.exports = { generateSecret, totpToken, verifyTotp, otpauthUrl };

// Self-check: a freshly generated secret's current token verifies; a wrong one doesn't.
if (require.main === module) {
  const assert = require('assert');
  const s = generateSecret();
  assert.ok(verifyTotp(s, totpToken(s)), 'current token should verify');
  assert.ok(!verifyTotp(s, '000000') || totpToken(s) === '000000', 'wrong token should fail');
  assert.strictEqual(base32Decode(base32Encode(Buffer.from('hello'))).toString(), 'hello', 'base32 round-trip');
  console.log('totp self-check ok');
}
