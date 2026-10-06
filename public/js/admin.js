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
    tr.innerHTML = `
      <td>${escapeHtml(u.email)}${u.is_admin ? ' <span class="badge badge-info">admin</span>' : ''}</td>
      <td>${escapeHtml(u.name || '—')}</td>
      <td>${joined}</td>
      <td>${u.project_count}</td>
      <td>${u.finding_count}</td>
      <td style="text-align:right;">${u.is_admin ? '' : `<button class="btn small danger" data-id="${u.id}" data-email="${escapeHtml(u.email)}">Remove</button>`}</td>
    `;
    body.appendChild(tr);
  }
  body.querySelectorAll('[data-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Permanently remove ${btn.dataset.email} and ALL their projects, findings and evidence? This cannot be undone.`)) return;
      btn.disabled = true;
      try {
        await API.adminDeleteUser(btn.dataset.id);
        toast('User removed');
        await loadAll();
      } catch (e) {
        toast(e.message, true);
        btn.disabled = false;
      }
    });
  });
}

async function loadAll() {
  await loadStats();
  allUsers = await API.adminUsers();
  renderUsers();
}

(async () => {
  if (!(await guard())) return;
  document.getElementById('userSearch').addEventListener('input', renderUsers);
  await loadAll();
})();
