const findingId = qs('id');
const projectIdParam = qs('project');
if (!findingId) window.location.href = '/index.html';
document.getElementById('backLink').href = projectIdParam ? `/project.html?id=${projectIdParam}` : '/index.html';

let currentFinding = null;
let cvssVector = ''; // empty means "not set, use likelihood/impact"

function fillForm(form, data) {
  for (const el of form.elements) {
    if (el.name && data[el.name] !== undefined && data[el.name] !== null) {
      el.value = data[el.name];
    }
  }
}

function parseVector(vector) {
  const parts = {};
  String(vector || '').replace(/^CVSS:3\.[01]\//, '').split('/').forEach((p) => {
    const [k, v] = p.split(':');
    if (k && v) parts[k] = v;
  });
  return parts;
}

function buildVectorFromSelects() {
  const metrics = {};
  document.querySelectorAll('#cvssSelects select').forEach((sel) => {
    metrics[sel.dataset.metric] = sel.value;
  });
  return `CVSS:3.1/AV:${metrics.AV}/AC:${metrics.AC}/PR:${metrics.PR}/UI:${metrics.UI}/S:${metrics.S}/C:${metrics.C}/I:${metrics.I}/A:${metrics.A}`;
}

function severityBadgeClass(sev) {
  return `badge-${(sev || 'none').toLowerCase()}`;
}

async function refreshCvssDisplay() {
  const vector = buildVectorFromSelects();
  try {
    const result = await API.calculateCvss(vector);
    cvssVector = vector;
    document.getElementById('cvssScoreValue').textContent = result.score.toFixed(1);
    const badge = document.getElementById('cvssSeverityBadge');
    badge.textContent = result.severity;
    badge.className = `badge ${severityBadgeClass(result.severity)}`;
    document.getElementById('cvssVectorText').textContent = result.vector;
  } catch (e) {
    toast(e.message, true);
  }
}

document.querySelectorAll('#cvssSelects select').forEach((sel) => {
  sel.addEventListener('change', refreshCvssDisplay);
});

document.getElementById('clearCvssBtn').addEventListener('click', () => {
  cvssVector = '';
  document.getElementById('cvssScoreValue').textContent = '0.0';
  const badge = document.getElementById('cvssSeverityBadge');
  badge.textContent = 'Not set';
  badge.className = 'badge badge-outline';
  document.getElementById('cvssVectorText').textContent = '';
});

async function loadFinding() {
  currentFinding = await API.getFinding(findingId);
  document.getElementById('findingTitle').textContent = `${currentFinding.identifier}: ${currentFinding.title}`;
  document.getElementById('findingMeta').textContent = `Severity: ${currentFinding.severity} · Risk Rating: ${currentFinding.risk_rating} · Status: ${currentFinding.status}`;
  fillForm(document.getElementById('findingForm'), currentFinding);

  if (currentFinding.cvss_vector) {
    const parsed = parseVector(currentFinding.cvss_vector);
    document.querySelectorAll('#cvssSelects select').forEach((sel) => {
      if (parsed[sel.dataset.metric]) sel.value = parsed[sel.dataset.metric];
    });
    cvssVector = currentFinding.cvss_vector;
    document.getElementById('cvssScoreValue').textContent = currentFinding.cvss_score.toFixed(1);
    const badge = document.getElementById('cvssSeverityBadge');
    badge.textContent = currentFinding.severity;
    badge.className = `badge ${severityBadgeClass(currentFinding.severity)}`;
    document.getElementById('cvssVectorText').textContent = currentFinding.cvss_vector;
  } else {
    cvssVector = '';
    document.getElementById('cvssSeverityBadge').textContent = 'Not set';
    document.getElementById('cvssSeverityBadge').className = 'badge badge-outline';
  }

  renderUrls(currentFinding.affected_urls);
  renderPoc(currentFinding.poc_steps);
  renderRefs(currentFinding.references);
  renderRetests(currentFinding.retest_events || []);
}

document.getElementById('findingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.cvss_vector = cvssVector;
  try {
    await API.updateFinding(findingId, data);
    toast('Finding saved');
    loadFinding();
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById('deleteFindingBtn').addEventListener('click', async () => {
  if (!confirm('Delete this finding and all its evidence?')) return;
  try {
    await API.deleteFinding(findingId);
    window.location.href = projectIdParam ? `/project.html?id=${projectIdParam}` : '/index.html';
  } catch (err) {
    toast(err.message, true);
  }
});

// ---- Affected URLs ----
function renderUrls(urls) {
  const list = document.getElementById('urlList');
  list.innerHTML = '';
  if (!urls.length) {
    list.innerHTML = '<div class="helptext">No affected URLs added yet.</div>';
    return;
  }
  for (const u of urls) {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `<div class="content">${escapeHtml(u.url)}</div><button class="icon-btn danger" title="Remove">&#10005;</button>`;
    row.querySelector('button').addEventListener('click', async () => {
      try { await API.deleteUrl(u.id); loadFinding(); } catch (err) { toast(err.message, true); }
    });
    list.appendChild(row);
  }
}

document.getElementById('urlForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = new FormData(e.target).get('url');
  try {
    await API.addUrl(findingId, url);
    e.target.reset();
    loadFinding();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---- PoC steps ----
function renderPoc(steps) {
  const list = document.getElementById('pocList');
  list.innerHTML = '';
  if (!steps.length) {
    list.innerHTML = '<div class="helptext">No reproduction steps added yet.</div>';
    return;
  }
  steps.forEach((step, i) => {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.style.flexDirection = 'column';
    row.style.alignItems = 'stretch';
    row.innerHTML = `
      <div class="row between">
        <div class="content"><strong>Step ${i + 1}.</strong> ${escapeHtml(step.step_text)}</div>
        <button class="icon-btn danger" title="Remove">&#10005;</button>
      </div>
      ${step.payload ? `<pre style="font-family:Consolas,monospace; font-size:11px; background:#1f2933; color:#e6edf3; padding:8px 10px; border-radius:4px; margin:6px 0 0; white-space:pre-wrap; word-break:break-all;">${escapeHtml(step.payload)}</pre>` : ''}
      ${step.screenshot_path ? `<img class="screenshot-thumb" src="/${step.screenshot_path}" />` : ''}
    `;
    row.querySelector('button').addEventListener('click', async () => {
      try { await API.deletePoc(step.id); loadFinding(); } catch (err) { toast(err.message, true); }
    });
    list.appendChild(row);
  });
}

document.getElementById('pocForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await API.addPoc(findingId, fd);
    e.target.reset();
    loadFinding();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---- References ----
function renderRefs(refs) {
  const list = document.getElementById('refList');
  list.innerHTML = '';
  if (!refs.length) {
    list.innerHTML = '<div class="helptext">No references added yet.</div>';
    return;
  }
  for (const r of refs) {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `<div class="content"><strong>${escapeHtml(r.label)}</strong> — ${escapeHtml(r.url)}</div><button class="icon-btn danger" title="Remove">&#10005;</button>`;
    row.querySelector('button').addEventListener('click', async () => {
      try { await API.deleteReference(r.id); loadFinding(); } catch (err) { toast(err.message, true); }
    });
    list.appendChild(row);
  }
}

document.getElementById('refForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  try {
    await API.addReference(findingId, data);
    e.target.reset();
    loadFinding();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---- Retest tracking ----
function renderRetests(events) {
  const list = document.getElementById('retestList');
  list.innerHTML = '';
  if (!events.length) {
    list.innerHTML = '<div class="helptext">No retest activity logged yet.</div>';
    return;
  }
  for (const ev of events) {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `
      <div class="content">
        <strong>${escapeHtml(ev.event_date)}</strong> — ${escapeHtml(ev.previous_status)} &rarr; <strong>${escapeHtml(ev.new_status)}</strong>
        ${ev.notes ? `<br/><span class="muted">${escapeHtml(ev.notes)}</span>` : ''}
      </div>
      <button class="icon-btn danger" title="Remove">&#10005;</button>
    `;
    row.querySelector('button').addEventListener('click', async () => {
      try { await API.deleteRetestEvent(ev.id); loadFinding(); } catch (err) { toast(err.message, true); }
    });
    list.appendChild(row);
  }
}

document.getElementById('retestForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  try {
    await API.addRetestEvent(findingId, data);
    e.target.reset();
    toast('Retest logged');
    loadFinding();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---- Startup ----
(async () => {
  try {
    const categories = await API.getOwaspCategories();
    const select = document.getElementById('owaspSelect');
    for (const cat of categories) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    }
  } catch (e) {
    // non-fatal — OWASP tagging is optional
  }
  loadFinding();
})();
