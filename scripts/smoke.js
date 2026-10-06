// End-to-end smoke test: boots the app on a temp DB, runs the core flow, asserts, cleans up.
// Run with `npm run smoke`. No framework — just node:assert.
const { spawn } = require('child_process');
const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

const PORT = 4199;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'vapt-smoke-'));
const ROOT = path.join(__dirname, '..');
const srv = spawn(process.execPath, ['server/index.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DATA_DIR },
  stdio: 'ignore',
});

let cookie = '';
async function req(method, url, body) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`http://localhost:${PORT}${url}`, { method, headers, body: payload });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return res;
}

(async () => {
  let failed = false;
  try {
    // wait for the server
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(`http://localhost:${PORT}/healthz`)).ok) break; } catch (e) { /* retry */ }
      await new Promise((r) => setTimeout(r, 500));
    }

    assert.strictEqual((await req('POST', '/api/auth/signup', { email: 'smoke@test.local', name: 'Smoke', password: 'secret123' })).status, 201, 'signup');
    const p = await (await req('POST', '/api/projects', { name: 'Smoke Project' })).json();
    assert.ok(p.id, 'project created');
    assert.strictEqual((await req('POST', `/api/projects/${p.id}/findings`, { title: 'Test', impact: 'High', likelihood: 'High' })).status, 201, 'finding created');

    const pdf = await req('GET', `/api/projects/${p.id}/report/pdf`);
    assert.strictEqual(pdf.status, 200, 'pdf status');
    assert.strictEqual(Buffer.from(await pdf.arrayBuffer()).slice(0, 5).toString(), '%PDF-', 'pdf magic bytes');

    // per-user isolation: a second user cannot read the first user's project
    cookie = '';
    await req('POST', '/api/auth/signup', { email: 'smoke2@test.local', name: 'S2', password: 'secret123' });
    assert.strictEqual((await req('GET', `/api/projects/${p.id}`)).status, 404, 'cross-user access blocked');

    console.log('SMOKE PASS');
  } catch (e) {
    console.error('SMOKE FAIL:', e.message);
    failed = true;
  } finally {
    srv.kill();
    try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    process.exit(failed ? 1 : 0);
  }
})();
