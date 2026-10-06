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

async function loadProjects() {
  const projects = await API.listProjects();
  grid.innerHTML = '';
  if (!projects.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  for (const p of projects) {
    const card = document.createElement('div');
    card.className = 'card project-card';
    card.innerHTML = `
      <div class="name">${escapeHtml(p.name)}</div>
      <div class="meta">${escapeHtml(p.client_name || 'No client set')}</div>
      <div class="sev-chips">${severityChips(p)}</div>
      <div class="meta">${p.finding_count} finding(s) &middot; updated ${new Date(p.updated_at).toLocaleDateString()}</div>
      <div class="actions">
        <a class="btn small" href="/project.html?id=${p.id}">Open</a>
        <button class="btn small secondary" data-id="${p.id}" data-action="clone" data-tip="Duplicate this project, branding and all findings">Duplicate</button>
        <button class="btn small danger" data-id="${p.id}" data-action="delete">Delete</button>
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

// ---- Current user / logout ----
(async () => {
  try {
    const { user } = await API.authMe();
    document.getElementById('currentUser').textContent = user.name ? `${user.name} (${user.email})` : user.email;
  } catch (e) {
    // 401 here means the session expired; api.js leaves /api/auth/* alone, so send to login.
    window.location.href = '/login.html';
  }
})();

document.getElementById('logoutLink').addEventListener('click', async (e) => {
  e.preventDefault();
  try { await API.authLogout(); } catch (err) { /* ignore */ }
  window.location.href = '/login.html';
});

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
