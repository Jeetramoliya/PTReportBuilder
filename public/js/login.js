// If already signed in, go straight to the dashboard.
(async () => {
  try {
    await API.get('/api/auth/me');
    window.location.href = '/index.html';
  } catch (e) {
    // not signed in — stay on the login page
  }
})();

document.querySelectorAll('[data-auth-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-auth-tab]').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`auth-${btn.dataset.authTab}`).classList.add('active');
  });
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  // Raw fetch so we can read the totp_required flag (API.post only surfaces the message).
  const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const body = await res.json().catch(() => ({}));
  if (res.ok) { window.location.href = '/index.html'; return; }
  if (body.totp_required) {
    const row = document.getElementById('totpRow');
    row.classList.remove('hidden');
    row.querySelector('input').focus();
    if (data.totp) toast(body.error || 'Invalid code', true); // only nag once they've tried a code
    return;
  }
  toast(body.error || 'Sign in failed', true);
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Marks/clears a field's inline error by toggling .invalid on its .form-row.
function setFieldValid(input, ok) {
  const row = input.closest('.form-row');
  if (row) row.classList.toggle('invalid', !ok);
  return ok;
}

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const emailOk = setFieldValid(form.email, EMAIL_RE.test((data.email || '').trim()));
  const pwOk = setFieldValid(form.password, (data.password || '').length >= 6);
  if (!emailOk || !pwOk) return;
  try {
    await API.post('/api/auth/signup', data);
    window.location.href = '/index.html';
  } catch (err) {
    // Surface server-side field errors inline where we can.
    if (/email/i.test(err.message)) setFieldValid(form.email, false);
    if (/password/i.test(err.message)) setFieldValid(form.password, false);
    toast(err.message, true);
  }
});
// Clear a field's error as soon as the user edits it.
document.querySelectorAll('#signupForm input').forEach((inp) => {
  inp.addEventListener('input', () => { const r = inp.closest('.form-row'); if (r) r.classList.remove('invalid'); });
});

// Forgot password
document.getElementById('forgotLink').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('forgotForm').classList.toggle('hidden');
});
document.getElementById('forgotForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.email.value.trim();
  if (!EMAIL_RE.test(email)) { toast('Enter a valid email address', true); return; }
  try {
    const r = await API.post('/api/auth/forgot-password', { email });
    toast(r.message || 'If an account exists, a reset link has been sent.');
    e.target.reset();
    e.target.classList.add('hidden');
  } catch (err) {
    toast(err.message, true);
  }
});
