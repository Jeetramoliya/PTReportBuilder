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
  try {
    await API.post('/api/auth/login', data);
    window.location.href = '/index.html';
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  try {
    await API.post('/api/auth/signup', data);
    window.location.href = '/index.html';
  } catch (err) {
    toast(err.message, true);
  }
});
