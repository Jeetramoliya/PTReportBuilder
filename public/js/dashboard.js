const grid = document.getElementById('projectsGrid');
const emptyState = document.getElementById('emptyState');
const modal = document.getElementById('newProjectModal');

function severityDot(count, label, cls) {
  return count ? `<span class="badge ${cls}">${count} ${label}</span>` : '';
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
      <div class="meta">${p.finding_count} finding(s) &middot; updated ${new Date(p.updated_at).toLocaleDateString()}</div>
      <div class="actions">
        <a class="btn small" href="/project.html?id=${p.id}">Open</a>
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
