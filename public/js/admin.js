let allUsers = [];

async function guard() {
  try {
    const { user } = await API.authMe();
    if (!user.is_admin) { window.location.href = '/index.html'; return false; }
    return true;
  } catch (e) {
    window.location.href = '/login.html';
    return false;
  }
}

function statCard(label, value) {
  return `<div class="card" style="margin:0;"><div class="meta" style="text-transform:uppercase; letter-spacing:0.05em; font-size:11px;">${label}</div><div style="font-size:28px; font-weight:800; color:var(--heading);">${value}</div></div>`;
}

async function loadStats() {
  const s = await API.adminStats();
  document.getElementById('statsRow').innerHTML =
    statCard('Users', s.users) + statCard('Projects', s.projects) + statCard('Findings', s.findings);
}

function renderUsers() {
  const q = (document.getElementById('userSearch').value || '').trim().toLowerCase();
  const body = document.getElementById('usersBody');
  const list = allUsers.filter((u) => !q || (u.email || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q));
  body.innerHTML = '';
  document.getElementById('usersEmpty').classList.toggle('hidden', list.length > 0);
  for (const u of list) {
    const tr = document.createElement('tr');
    const joined = u.created_at ? new Date(u.created_at.replace(' ', 'T') + 'Z').toLocaleDateString() : '—';
    const role = u.is_env_admin
      ? '<span class="badge badge-info">owner</span>'
      : (u.is_admin ? '<span class="badge badge-info">admin</span>' : '<span class="badge badge-outline">user</span>');
    // Owner (env) admins are locked. Everyone else can be promoted/demoted and removed.
    let actions = '';
    if (!u.is_env_admin) {
      const roleBtn = u.is_admin
        ? `<button class="btn small secondary" data-action="demote" data-id="${u.id}">Revoke admin</button>`
        : `<button class="btn small secondary" data-action="promote" data-id="${u.id}">Make admin</button>`;
      actions = `${roleBtn} <button class="btn small danger" data-action="remove" data-id="${u.id}" data-email="${escapeHtml(u.email)}">Remove</button>`;
    }
    tr.innerHTML = `
      <td>${escapeHtml(u.email)}</td>
      <td>${escapeHtml(u.name || '—')}</td>
      <td>${joined}</td>
      <td>${u.project_count}</td>
      <td>${u.finding_count}</td>
      <td>${role}</td>
      <td style="text-align:right; white-space:nowrap;">${actions}</td>
    `;
    body.appendChild(tr);
  }
  body.querySelectorAll('[data-action="remove"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Permanently remove ${btn.dataset.email} and ALL their projects, findings and evidence? This cannot be undone.`)) return;
      btn.disabled = true;
      try { await API.adminDeleteUser(btn.dataset.id); toast('User removed'); await loadAll(); }
      catch (e) { toast(e.message, true); btn.disabled = false; }
    });
  });
  body.querySelectorAll('[data-action="promote"], [data-action="demote"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const makeAdmin = btn.dataset.action === 'promote';
      btn.disabled = true;
      try { await API.adminSetAdmin(btn.dataset.id, makeAdmin); toast(makeAdmin ? 'Admin access granted' : 'Admin access revoked'); await loadAll(); }
      catch (e) { toast(e.message, true); btn.disabled = false; }
    });
  });
}

async function loadAll() {
  await loadStats();
  allUsers = await API.adminUsers();
  renderUsers();
}

// Add User modal
const addModal = document.getElementById('addUserModal');
document.getElementById('addUserBtn').addEventListener('click', () => addModal.classList.remove('hidden'));
document.getElementById('cancelAddUser').addEventListener('click', () => addModal.classList.add('hidden'));
addModal.addEventListener('click', (e) => { if (e.target === addModal) addModal.classList.add('hidden'); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') addModal.classList.add('hidden'); });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const emailOk = EMAIL_RE.test((form.email.value || '').trim());
  const pwOk = (form.password.value || '').length >= 6;
  form.email.closest('.form-row').classList.toggle('invalid', !emailOk);
  form.password.closest('.form-row').classList.toggle('invalid', !pwOk);
  if (!emailOk || !pwOk) return;
  try {
    await API.adminCreateUser({
      email: form.email.value.trim(), name: form.name.value.trim(),
      password: form.password.value, is_admin: form.is_admin.checked,
    });
    addModal.classList.add('hidden');
    form.reset();
    toast('User created');
    await loadAll();
  } catch (err) {
    toast(err.message, true);
  }
});

(async () => {
  if (!(await guard())) return;
  document.getElementById('userSearch').addEventListener('input', renderUsers);
  await loadAll();
})();
