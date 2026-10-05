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

// ---- Security settings ----
const securityModal = document.getElementById('securityModal');

async function openSecurityModal() {
  // Open the modal first so the button always responds, even if the status check fails.
  securityModal.classList.remove('hidden');
  try {
    const status = await API.authStatus();
    document.getElementById('securityDisabledView').classList.toggle('hidden', status.enabled);
    document.getElementById('securityEnabledView').classList.toggle('hidden', !status.enabled);
  } catch (err) {
    document.getElementById('securityDisabledView').classList.remove('hidden');
    document.getElementById('securityEnabledView').classList.add('hidden');
    toast('Could not reach the server — is it running?', true);
  }
}

document.getElementById('securityLink').addEventListener('click', (e) => {
  e.preventDefault();
  openSecurityModal();
});
document.getElementById('cancelSecurity').addEventListener('click', () => securityModal.classList.add('hidden'));
document.getElementById('cancelSecurity2').addEventListener('click', () => securityModal.classList.add('hidden'));
securityModal.addEventListener('click', (e) => { if (e.target === securityModal) securityModal.classList.add('hidden'); });

document.getElementById('enableAuthForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = new FormData(e.target).get('password');
  try {
    await API.authEnable(password);
    toast('Password protection enabled');
    securityModal.classList.add('hidden');
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById('changeAuthForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  try {
    await API.authChangePassword(data.current_password, data.new_password);
    toast('Password changed');
    e.target.reset();
    securityModal.classList.add('hidden');
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById('disableAuthForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const current_password = new FormData(e.target).get('current_password');
  if (!confirm('Disable password protection? Anyone with access to this app will no longer need to sign in.')) return;
  try {
    await API.authDisable(current_password);
    toast('Password protection disabled');
    securityModal.classList.add('hidden');
  } catch (err) {
    toast(err.message, true);
  }
});

loadProjects();
