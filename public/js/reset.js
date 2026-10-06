const token = qs('token');
if (!token) toast('Missing reset token — use the link from your email.', true);
document.getElementById('resetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = e.target.new_password;
  const row = input.closest('.form-row');
  if (input.value.length < 6) { row.classList.add('invalid'); return; }
  row.classList.remove('invalid');
  try {
    await API.post('/api/auth/reset-password', { token, new_password: input.value });
    toast('Password updated — redirecting to sign in…');
    setTimeout(() => { window.location.href = '/login.html'; }, 1200);
  } catch (err) {
    toast(err.message, true);
  }
});
