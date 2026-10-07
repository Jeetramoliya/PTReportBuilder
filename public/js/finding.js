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
  // Compliance is stored as a JSON array; show it as a comma-separated list.
  let tags = [];
  try { tags = JSON.parse(currentFinding.compliance || '[]'); } catch (e) { tags = []; }
  document.querySelector('#findingForm [name=compliance_tags]').value = (tags || []).join(', ');

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
  data.compliance = (data.compliance_tags || '').split(',').map((t) => t.trim()).filter(Boolean);
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

// ---- PoC screenshot: file / drag-drop / clipboard paste ----
const pocFileInput = document.querySelector('#pocForm input[name=screenshot]');
const pocPreview = document.getElementById('pocPreview');
const pocDrop = document.getElementById('pocDrop');

function showPocPreview(file) {
  if (file && /^image\//.test(file.type)) { pocPreview.src = URL.createObjectURL(file); pocPreview.classList.remove('hidden'); }
}
function attachPocFile(file) {
  if (!file || !/^image\//.test(file.type)) return;
  const dt = new DataTransfer(); dt.items.add(file); pocFileInput.files = dt.files; // put it where the form submit reads it
  showPocPreview(file);
}
pocFileInput.addEventListener('change', () => showPocPreview(pocFileInput.files[0]));

['dragenter', 'dragover'].forEach((ev) => pocDrop.addEventListener(ev, (e) => { e.preventDefault(); pocDrop.classList.add('dragover'); }));
['dragleave', 'drop'].forEach((ev) => pocDrop.addEventListener(ev, (e) => {
  e.preventDefault(); if (ev === 'dragleave' && pocDrop.contains(e.relatedTarget)) return; pocDrop.classList.remove('dragover');
}));
pocDrop.addEventListener('drop', (e) => attachPocFile(e.dataTransfer.files[0]));

// Paste an image anywhere on the page to attach it to the step being written.
document.addEventListener('paste', (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const it of items) {
    if (it.type && it.type.startsWith('image/')) {
      const blob = it.getAsFile();
      if (blob) {
        const ext = (blob.type.split('/')[1] || 'png');
        attachPocFile(new File([blob], `pasted-${Date.now()}.${ext}`, { type: blob.type }));
        toast('Screenshot attached from clipboard');
        e.preventDefault();
      }
      break;
    }
  }
});

document.getElementById('pocForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await API.addPoc(findingId, fd);
    e.target.reset();
    pocPreview.classList.add('hidden');
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

guardUnsaved(document.getElementById('findingForm'));

document.getElementById('saveTemplateBtn').addEventListener('click', async () => {
  const f = document.getElementById('findingForm');
  const name = prompt('Save as template — name:', f.title.value || 'My Template');
  if (!name) return;
  const data = {
    name,
    title: f.title.value, category: f.category.value, scope_type: f.scope_type.value,
    owasp_category: f.owasp_category.value, cwe_id: f.cwe_id.value,
    impact: f.impact.value, likelihood: f.likelihood.value,
    description: f.description.value, remediation: f.remediation.value,
    cvss_vector: (currentFinding && currentFinding.cvss_vector) || '',
  };
  try { await API.saveMyTemplate(data); toast('Saved to your template library'); } catch (e) { toast(e.message, true); }
});
