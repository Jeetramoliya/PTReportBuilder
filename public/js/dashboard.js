const grid = document.getElementById('projectsGrid');
const emptyState = document.getElementById('emptyState');
const modal = document.getElementById('newProjectModal');

function severityChips(p) {
  const defs = [
    ['sev_critical', 'C', 'c-critical'], ['sev_high', 'H', 'c-high'], ['sev_medium', 'M', 'c-medium'],
    ['sev_low', 'L', 'c-low'], ['sev_info', 'I', 'c-info'],
  ];
  const chips = defs.filter((d) => p[d[0]] > 0).map((d) => `<span class="sev-chip ${d[2]}">${p[d[0]]} ${d[1]}</span>`);
  if (!chips.length) return '<span class="sev-chip c-none">No findings</span>';
  return chips.join('');
}

const RISK_WEIGHT = { sev_critical: 10000, sev_high: 1000, sev_medium: 100, sev_low: 10, sev_info: 1 };
function riskScore(p) {
  return Object.keys(RISK_WEIGHT).reduce((s, k) => s + (p[k] || 0) * RISK_WEIGHT[k], 0);
}

let allProjects = [];

async function loadProjects() {
  allProjects = await API.listProjects();
  renderProjects();
}

function renderProjects() {
  const toolbar = document.getElementById('projectToolbar');
  const noMatch = document.getElementById('noMatch');
  grid.innerHTML = '';
  if (!allProjects.length) {
    emptyState.classList.remove('hidden');
    noMatch.classList.add('hidden');
    if (toolbar) toolbar.classList.add('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  if (toolbar) toolbar.classList.remove('hidden');

  const q = (document.getElementById('projectSearch').value || '').trim().toLowerCase();
  const sort = document.getElementById('projectSort').value;
  let list = allProjects.filter((p) => !q
    || (p.name || '').toLowerCase().includes(q)
    || (p.client_name || '').toLowerCase().includes(q));
  const sorters = {
    updated: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
    name: (a, b) => (a.name || '').localeCompare(b.name || ''),
    findings: (a, b) => b.finding_count - a.finding_count,
    risk: (a, b) => riskScore(b) - riskScore(a),
  };
  list = list.slice().sort(sorters[sort] || sorters.updated);

  noMatch.classList.toggle('hidden', list.length > 0);

  for (const p of list) {
    const card = document.createElement('div');
    card.className = 'card project-card';
    const shared = p.my_role === 'shared';
    card.innerHTML = `
      <div class="name">${escapeHtml(p.name)}${shared ? ' <span class="badge badge-outline" style="font-size:9.5px; vertical-align:middle;">shared</span>' : ''}</div>
      <div class="meta">${escapeHtml(p.client_name || 'No client set')}</div>
      <div class="sev-chips">${severityChips(p)}</div>
      <div class="meta">${p.finding_count} finding(s) &middot; updated ${new Date(p.updated_at).toLocaleDateString()}</div>
      <div class="actions">
        <a class="btn small" href="/project.html?id=${p.id}">Open</a>
        <button class="btn small secondary" data-id="${p.id}" data-action="clone" data-tip="Duplicate this project, branding and all findings">Duplicate</button>
        ${shared ? '' : `<button class="btn small danger" data-id="${p.id}" data-action="delete">Delete</button>`}
      </div>
    `;
    grid.appendChild(card);
  }
  grid.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this project and all its findings? This cannot be undone.')) return;
      try {
        await API.deleteProject(btn.dataset.id);
        toast('Project deleted');
        loadProjects();
      } catch (e) {
        toast(e.message, true);
      }
    });
  });
  grid.querySelectorAll('[data-action="clone"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await API.cloneProject(btn.dataset.id);
        toast('Project duplicated');
        loadProjects();
      } catch (e) {
        toast(e.message, true);
        btn.disabled = false;
      }
    });
  });
}

document.getElementById('newProjectBtn').addEventListener('click', () => {
  modal.classList.remove('hidden');
  document.querySelector('#newProjectForm [name=assessment_date]').value = new Date().toISOString().slice(0, 10);
});
document.getElementById('cancelNewProject').addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

document.getElementById('newProjectForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    const project = await API.createProject(data);
    modal.classList.add('hidden');
    window.location.href = `/project.html?id=${project.id}`;
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById('projectSearch').addEventListener('input', renderProjects);
document.getElementById('projectSort').addEventListener('change', renderProjects);

// Reveal the Admin Panel card for admins (the profile menu, injected by theme.js, handles
// the user info + logout). The page itself is already auth-guarded server-side.
(async () => {
  try {
    const { user } = await API.authMe();
    if (user.is_admin) document.getElementById('adminHomeCard').classList.remove('hidden');
    twofaEnabled = !!user.has_2fa;
    renderTwofaStatus();
    loadSessions();
  } catch (e) {
    window.location.href = '/login.html';
  }
})();

// Esc closes the open modal; a CTA button in the empty state opens the New Project modal.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') modal.classList.add('hidden');
});
const emptyCta = document.getElementById('emptyCreateBtn');
if (emptyCta) emptyCta.addEventListener('click', () => document.getElementById('newProjectBtn').click());

// Change password (while logged in)
const pwForm = document.getElementById('changePasswordForm');
if (pwForm) {
  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(pwForm).entries());
    if ((data.new_password || '').length < 6) { toast('New password must be at least 6 characters', true); return; }
    try {
      await API.post('/api/auth/change-password', data);
      pwForm.reset();
      toast('Password changed');
    } catch (err) {
      toast(err.message, true);
    }
  });
}

// ---- Two-factor auth ----
let twofaEnabled = false;
function renderTwofaStatus() {
  const el = document.getElementById('twofaStatus');
  if (!el) return;
  el.innerHTML = twofaEnabled
    ? '<span class="badge badge-info">Enabled</span> <button type="button" class="btn small danger" id="twofaDisableBtn" style="margin-left:8px;">Disable 2FA</button>'
    : '<span class="badge badge-outline">Disabled</span> <button type="button" class="btn small secondary" id="twofaSetupBtn" style="margin-left:8px;">Enable 2FA</button>';
  const setupBtn = document.getElementById('twofaSetupBtn');
  if (setupBtn) setupBtn.addEventListener('click', startTwofaSetup);
  const disBtn = document.getElementById('twofaDisableBtn');
  if (disBtn) disBtn.addEventListener('click', disableTwofa);
}
async function startTwofaSetup() {
  try {
    const r = await API.twofaSetup();
    document.getElementById('twofaQr').src = r.qr;
    document.getElementById('twofaSecret').textContent = r.secret;
    document.getElementById('twofaSetup').classList.remove('hidden');
  } catch (e) { toast(e.message, true); }
}
async function disableTwofa() {
  const password = prompt('Enter your password to disable 2FA:');
  if (!password) return;
  try { await API.twofaDisable({ password }); twofaEnabled = false; renderTwofaStatus(); toast('2FA disabled'); }
  catch (e) { toast(e.message, true); }
}
if (document.getElementById('twofaConfirm')) {
  document.getElementById('twofaConfirm').addEventListener('click', async () => {
    const code = document.getElementById('twofaCode').value.trim();
    try {
      await API.twofaEnable(code);
      twofaEnabled = true;
      document.getElementById('twofaSetup').classList.add('hidden');
      document.getElementById('twofaCode').value = '';
      renderTwofaStatus();
      toast('2FA enabled');
    } catch (e) { toast(e.message, true); }
  });
  document.getElementById('twofaCancel').addEventListener('click', () => document.getElementById('twofaSetup').classList.add('hidden'));
}

// ---- Active sessions ----
async function loadSessions() {
  const el = document.getElementById('sessionList');
  if (!el) return;
  try {
    const sessions = await API.listSessions();
    el.innerHTML = sessions.map((s) => `
      <div class="list-item">
        <span class="content">${s.current ? '<span class="badge badge-info">This device</span> ' : ''}${escapeHtml(s.user_agent || 'Unknown device')}<br/>
        <span class="helptext" style="margin:0;">${escapeHtml(s.ip || '')} · since ${new Date((s.created_at || '').replace(' ', 'T') + 'Z').toLocaleString()}</span></span>
        ${s.current ? '' : `<button class="btn small danger" data-session="${s.id}">Revoke</button>`}
      </div>`).join('');
    el.querySelectorAll('[data-session]').forEach((b) => b.addEventListener('click', async () => {
      try { await API.revokeSession(b.dataset.session); toast('Session revoked'); loadSessions(); } catch (e) { toast(e.message, true); }
    }));
  } catch (e) { /* ignore */ }
}
if (document.getElementById('revokeOthersBtn')) {
  document.getElementById('revokeOthersBtn').addEventListener('click', async () => {
    try { await API.revokeOtherSessions(); toast('Other devices logged out'); loadSessions(); } catch (e) { toast(e.message, true); }
  });
}

document.getElementById('deleteAccountBtn').addEventListener('click', async () => {
  // Irreversible: require typing DELETE so it can't be a stray click.
  if (prompt('This permanently deletes your account and ALL projects. Type DELETE to confirm:') !== 'DELETE') return;
  try {
    await API.deleteAccount();
    alert('Your account has been deleted.');
    window.location.href = '/login.html';
  } catch (e) {
    toast(e.message, true);
  }
});

loadProjects();
