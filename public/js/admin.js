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
    const planBadge = u.plan === 'pro' ? '<span class="badge badge-info">Pro</span>' : '<span class="badge badge-outline">Free</span>';
    const planBtn = `<button class="btn small secondary" data-plan="${u.id}" data-to="${u.plan === 'pro' ? 'free' : 'pro'}" style="margin-left:6px;">${u.plan === 'pro' ? '→ Free' : '→ Pro'}</button>`;
    tr.innerHTML = `
      <td>${escapeHtml(u.email)}</td>
      <td>${escapeHtml(u.name || '—')}</td>
      <td>${joined}</td>
      <td>${u.project_count}</td>
      <td>${u.finding_count}</td>
      <td style="white-space:nowrap;">${planBadge}${planBtn}</td>
      <td>${role}</td>
      <td style="text-align:right; white-space:nowrap;">${actions}</td>
    `;
    body.appendChild(tr);
  }
  body.querySelectorAll('[data-plan]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try { await API.adminSetPlan(btn.dataset.plan, btn.dataset.to); toast(`Plan set to ${btn.dataset.to}`); await loadAll(); }
      catch (e) { toast(e.message, true); btn.disabled = false; }
    });
  });
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

async function loadAudit() {
  const body = document.getElementById('auditBody');
  if (!body) return;
  try {
    const rows = await API.adminAudit();
    document.getElementById('auditEmpty').classList.toggle('hidden', rows.length > 0);
    body.innerHTML = rows.map((r) => `
      <tr>
        <td>${r.created_at ? new Date(r.created_at.replace(' ', 'T') + 'Z').toLocaleString() : '—'}</td>
        <td>${escapeHtml(r.actor_email || '—')}</td>
        <td><span class="badge badge-outline">${escapeHtml(r.action || '')}</span></td>
        <td>${escapeHtml(r.detail || '')}</td>
      </tr>`).join('');
  } catch (e) { /* ignore */ }
}

let allProjects = [];
function renderAdminProjects() {
  const body = document.getElementById('adminProjBody');
  if (!body) return;
  const q = (document.getElementById('projSearch').value || '').trim().toLowerCase();
  const list = allProjects.filter((p) => !q || (p.name || '').toLowerCase().includes(q) || (p.owner_email || '').toLowerCase().includes(q));
  body.innerHTML = list.map((p) => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.owner_email || '—')}</td>
      <td>${p.finding_count}</td>
      <td>${p.updated_at ? new Date(p.updated_at.replace(' ', 'T') + 'Z').toLocaleDateString() : '—'}</td>
      <td style="text-align:right;"><a class="btn small secondary" href="/api/admin/projects/${p.id}/report" target="_blank">View report</a></td>
    </tr>`).join('');
}
async function loadAdminProjects() {
  try { allProjects = await API.adminProjects(); renderAdminProjects(); } catch (e) { /* ignore */ }
}

async function loadChart() {
  const el = document.getElementById('chart');
  if (!el) return;
  try {
    const days = await API.adminChart();
    const max = Math.max(1, ...days.map((d) => Math.max(d.users, d.projects)));
    el.innerHTML = `
      <div style="display:flex; align-items:flex-end; gap:3px; height:110px;">
        ${days.map((d) => `<div data-tip="${d.day}: ${d.users} user(s), ${d.projects} project(s)" style="flex:1; display:flex; flex-direction:column; justify-content:flex-end; gap:2px;">
          <div style="height:${(d.projects / max) * 95}px; background:var(--accent); border-radius:2px 2px 0 0;"></div>
          <div style="height:${(d.users / max) * 95}px; background:var(--accent2); border-radius:2px 2px 0 0;"></div>
        </div>`).join('')}
      </div>
      <div class="helptext" style="margin-top:8px;"><span style="color:var(--accent)">&#9632;</span> Projects &nbsp; <span style="color:var(--accent2)">&#9632;</span> Users</div>`;
  } catch (e) { /* ignore */ }
}

async function loadAll() {
  await loadStats();
  allUsers = await API.adminUsers();
  renderUsers();
  loadAdminProjects();
  loadAudit();
  loadChart();
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
  const ps = document.getElementById('projSearch');
  if (ps) ps.addEventListener('input', renderAdminProjects);
  await loadAll();
})();
