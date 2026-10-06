const projectId = qs('id');
if (!projectId) window.location.href = '/index.html';

let currentProject = null;
let themesMeta = null;

document.getElementById('previewBtn').href = `/api/projects/${projectId}/report/preview`;
document.getElementById('downloadBtn').href = `/api/projects/${projectId}/report/pdf`;
document.getElementById('downloadDocxBtn').href = `/api/projects/${projectId}/report/docx`;
document.getElementById('exportCsvBtn').href = `/api/export/projects/${projectId}/findings.csv`;
document.getElementById('exportXlsxBtn').href = `/api/export/projects/${projectId}/findings.xlsx`;

// ---- Export dropdown ----
const exportMenuBtn = document.getElementById('exportMenuBtn');
const exportMenu = document.getElementById('exportMenu');
exportMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  exportMenu.classList.toggle('hidden');
});
document.addEventListener('click', () => exportMenu.classList.add('hidden'));
exportMenu.addEventListener('click', (e) => e.stopPropagation());

// ---- Tabs ----
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

function fillForm(form, data) {
  for (const el of form.elements) {
    if (el.name && data[el.name] !== undefined && data[el.name] !== null) {
      el.value = data[el.name];
    }
  }
}

async function loadProject() {
  currentProject = await API.getProject(projectId);
  document.getElementById('projectName').textContent = currentProject.name;
  document.getElementById('projectMeta').textContent = `${currentProject.client_name || 'No client set'} · ${currentProject.findings.length} finding(s)`;
  fillForm(document.getElementById('overviewForm'), currentProject);

  const hasLogo = !!currentProject.logo_path;
  const logoState = document.getElementById('brandingLogoState');
  const uploadState = document.getElementById('brandingUploadState');
  const img = document.getElementById('logoPreview');
  if (hasLogo) {
    img.src = `/${currentProject.logo_path}?t=${Date.now()}`;
    img.classList.remove('hidden');
    logoState.classList.remove('hidden');
    uploadState.classList.add('hidden');
  } else {
    img.classList.add('hidden');
    logoState.classList.add('hidden');
    uploadState.classList.remove('hidden');
  }
  // When a logo is set, the company-name field is inactive (cover shows the logo instead).
  const companyInput = document.querySelector('#overviewForm [name=company_name]');
  if (companyInput) {
    companyInput.disabled = hasLogo;
    companyInput.placeholder = hasLogo
      ? 'A logo is set — remove it to use a company name'
      : "Shown on the cover when no logo is uploaded";
  }

  renderScope(currentProject.scope);
  renderFindings(currentProject.findings);
  renderShare();
  await renderDesignTab();
}

function renderShare() {
  const state = document.getElementById('shareState');
  const gen = document.getElementById('genShareBtn');
  const rev = document.getElementById('revokeShareBtn');
  if (currentProject.share_token) {
    const url = `${location.origin}/share/${currentProject.share_token}`;
    state.innerHTML = `<div class="list-item"><span class="content"><a href="${url}" target="_blank">${escapeHtml(url)}</a></span><button type="button" class="btn small secondary" id="copyShareBtn">Copy</button></div>`;
    gen.classList.add('hidden');
    rev.classList.remove('hidden');
    document.getElementById('copyShareBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(url).then(() => toast('Link copied')).catch(() => toast('Copy failed', true));
    });
  } else {
    state.innerHTML = '';
    gen.classList.remove('hidden');
    rev.classList.add('hidden');
  }
}

document.getElementById('genShareBtn').addEventListener('click', async () => {
  try { await API.createShare(projectId); toast('Share link created'); await loadProject(); } catch (e) { toast(e.message, true); }
});
document.getElementById('revokeShareBtn').addEventListener('click', async () => {
  if (!confirm('Revoke the share link? Anyone with the old link will lose access.')) return;
  try { await API.revokeShare(projectId); toast('Share link revoked'); await loadProject(); } catch (e) { toast(e.message, true); }
});

// ---- Design (theme + cover style) ----
function coverThumbBackground(styleKey, theme) {
  switch (styleKey) {
    case 'gradient':
      return `linear-gradient(135deg, ${theme.brand} 0%, ${theme.brandDark} 100%)`;
    case 'dark':
      return theme.brandDark;
    case 'band':
      return `linear-gradient(to bottom, ${theme.brand} 0%, ${theme.brand} 45%, #ffffff 45%, #ffffff 100%)`;
    case 'geometric':
      return `radial-gradient(circle at 85% 15%, ${theme.brandLight} 0%, ${theme.brandLight} 30%, #ffffff 31%)`;
    case 'corner':
      return `linear-gradient(to bottom left, ${theme.brand} 0, ${theme.brand} 26%, #ffffff 26%)`;
    case 'ribbon':
      return `linear-gradient(45deg, #ffffff 42%, ${theme.brand} 42%, ${theme.brand} 56%, #ffffff 56%)`;
    case 'waves':
      return `radial-gradient(ellipse at bottom, ${theme.brandLight} 0, ${theme.brandLight} 42%, #ffffff 44%)`;
    case 'circuit':
      return '#eef2f6';
    case 'mesh':
      return `radial-gradient(circle at 25% 25%, ${theme.brand} 0%, ${theme.brandDark} 60%)`;
    case 'triangles':
      return `linear-gradient(135deg, ${theme.brandLight} 0 50%, #ffffff 50%)`;
    case 'terminal':
      return 'linear-gradient(to bottom, #1b2330 0 22%, #0c1018 22%)';
    case 'shield':
      return `radial-gradient(circle at 80% 82%, ${theme.brandLight} 0, ${theme.brandLight} 30%, #ffffff 32%)`;
    case 'sidebar':
      return `linear-gradient(to right, ${theme.brand} 0 26%, #ffffff 26%)`;
    case 'topaccent':
      return `linear-gradient(to bottom, ${theme.brand} 0 14%, #ffffff 14%)`;
    default:
      return `linear-gradient(to bottom, #ffffff 0%, #ffffff 88%, ${theme.brand} 88%, ${theme.brand} 100%)`;
  }
}

// Builds the inline style for a header/footer thumbnail from the style's preview tokens.
function hfThumbStyle(preview, theme) {
  const pv = preview || {};
  const tok = (t) => (t === 'brand' ? theme.brand : t === 'dark' ? theme.brandDark : t === 'accent' ? theme.accent : t === 'tint' ? theme.brandLight : null);
  const barCol = pv.barColor ? tok(pv.barColor) : '#ffffff';
  let bg = '#ffffff';
  if (pv.barPlace === 'both') bg = barCol;
  else if (pv.barPlace === 'header') bg = `linear-gradient(to bottom, ${barCol} 0 45%, #ffffff 45%)`;
  else if (pv.barPlace === 'footer') bg = `linear-gradient(to bottom, #ffffff 0 55%, ${barCol} 55%)`;
  let extra = '';
  if (pv.rulePlace) { const rc = tok(pv.ruleColor) || theme.brand; extra += `border-top:3px solid ${rc}; border-bottom:3px solid ${rc};`; }
  if (pv.edge) { const ec = tok(pv.edge); extra += `box-shadow: inset 0 4px 0 ${ec}, inset 0 -4px 0 ${ec};`; }
  return `background:${bg}; ${extra} height:40px;`;
}

async function renderDesignTab() {
  if (!themesMeta) themesMeta = await API.getThemesMeta();

  const themeGrid = document.getElementById('themeGrid');
  themeGrid.innerHTML = '';
  for (const t of themesMeta.themes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-btn' + (currentProject.theme === t.key ? ' selected' : '');
    btn.innerHTML = `<span class="swatch-dot" style="background:${t.brand};"></span> ${escapeHtml(t.name)}`;
    btn.addEventListener('click', async () => {
      try {
        await API.updateProject(projectId, { theme: t.key });
        toast(`Theme set to ${t.name}`);
        await loadProject();
      } catch (err) {
        toast(err.message, true);
      }
    });
    themeGrid.appendChild(btn);
  }
  if (currentProject.theme === 'custom' && currentProject.custom_brand_color) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-btn selected';
    btn.innerHTML = `<span class="swatch-dot" style="background:${currentProject.custom_brand_color};"></span> Custom (from logo)`;
    themeGrid.appendChild(btn);
  }

  const currentTheme = currentProject.theme === 'custom' && currentProject.custom_brand_color
    ? { brand: currentProject.custom_brand_color, brandDark: currentProject.custom_brand_color, brandLight: '#f5f5f5' }
    : (themesMeta.themes.find((t) => t.key === currentProject.theme) || themesMeta.themes[0]);
  const coverGrid = document.getElementById('coverStyleGrid');
  coverGrid.innerHTML = '';
  for (const s of themesMeta.coverStyles) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'cover-style-card' + (currentProject.cover_style === s.key ? ' selected' : '');
    card.innerHTML = `
      <div class="cover-style-thumb" style="background:${coverThumbBackground(s.key, currentTheme)};"></div>
      <div class="name">${escapeHtml(s.name)}</div>
      <div class="desc">${escapeHtml(s.description)}</div>
    `;
    card.addEventListener('click', async () => {
      try {
        await API.updateProject(projectId, { cover_style: s.key });
        toast(`Cover style set to ${s.name}`);
        await loadProject();
      } catch (err) {
        toast(err.message, true);
      }
    });
    coverGrid.appendChild(card);
  }

  const alignGrid = document.getElementById('coverAlignGrid');
  alignGrid.innerHTML = '';
  for (const a of themesMeta.coverAlignments) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-btn' + ((currentProject.cover_alignment || 'left') === a.key ? ' selected' : '');
    btn.textContent = a.name;
    btn.addEventListener('click', async () => {
      try {
        await API.updateProject(projectId, { cover_alignment: a.key });
        toast(`Cover alignment set to ${a.name}`);
        await loadProject();
      } catch (err) {
        toast(err.message, true);
      }
    });
    alignGrid.appendChild(btn);
  }

  const wmGrid = document.getElementById('wordmarkStyleGrid');
  if (wmGrid && themesMeta.wordmarkStyles) {
    wmGrid.innerHTML = '';
    for (const w of themesMeta.wordmarkStyles) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'cover-style-card' + ((currentProject.wordmark_style || 'underline') === w.key ? ' selected' : '');
      card.innerHTML = `
        <div class="name">${escapeHtml(w.name)}</div>
        <div class="desc">${escapeHtml(w.description)}</div>
      `;
      card.addEventListener('click', async () => {
        try {
          await API.updateProject(projectId, { wordmark_style: w.key });
          toast(`Company name style set to ${w.name}`);
          await loadProject();
        } catch (err) {
          toast(err.message, true);
        }
      });
      wmGrid.appendChild(card);
    }
  }
  renderWordmarkControls(currentTheme);

  const fontGrid = document.getElementById('fontGrid');
  fontGrid.innerHTML = '';
  for (const f of themesMeta.fonts) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-btn' + (currentProject.font_family === f.key ? ' selected' : '');
    btn.style.fontFamily = f.stack;
    btn.textContent = f.name;
    btn.addEventListener('click', async () => {
      try {
        await API.updateProject(projectId, { font_family: f.key });
        toast(`Font set to ${f.name}`);
        await loadProject();
      } catch (err) {
        toast(err.message, true);
      }
    });
    fontGrid.appendChild(btn);
  }

  const pageBgGrid = document.getElementById('pageBgGrid');
  pageBgGrid.innerHTML = '';
  for (const b of themesMeta.pageBackgrounds) {
    const swatchColor = b.swatch === 'theme' ? currentTheme.brandLight : b.swatch;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-btn' + (currentProject.page_background === b.key ? ' selected' : '');
    btn.innerHTML = `<span class="swatch-dot" style="background:${swatchColor}; border-color:#ccc;"></span> ${escapeHtml(b.name)}`;
    btn.addEventListener('click', async () => {
      try {
        await API.updateProject(projectId, { page_background: b.key });
        toast(`Page background set to ${b.name}`);
        await loadProject();
      } catch (err) {
        toast(err.message, true);
      }
    });
    pageBgGrid.appendChild(btn);
  }

  const hfGrid = document.getElementById('headerFooterGrid');
  hfGrid.innerHTML = '';
  for (const s of themesMeta.headerFooterStyles) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'cover-style-card' + (currentProject.header_footer_style === s.key ? ' selected' : '');
    card.innerHTML = `
      <div class="cover-style-thumb" style="${hfThumbStyle(s.preview, currentTheme)}"></div>
      <div class="name">${escapeHtml(s.name)}</div>
      <div class="desc">${escapeHtml(s.description)}</div>
    `;
    card.addEventListener('click', async () => {
      try {
        await API.updateProject(projectId, { header_footer_style: s.key });
        toast(`Header/footer style set to ${s.name}`);
        await loadProject();
      } catch (err) {
        toast(err.message, true);
      }
    });
    hfGrid.appendChild(card);
  }

  document.querySelector('#watermarkForm [name=watermark_text]').value = currentProject.watermark_text || '';

  document.getElementById('coverPreviewFrame').src = `/api/projects/${projectId}/report/preview?t=${Date.now()}`;
}

document.getElementById('watermarkForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const watermark_text = new FormData(e.target).get('watermark_text');
  try {
    await API.updateProject(projectId, { watermark_text });
    toast('Watermark saved');
    loadProject();
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById('logoColorBtn').addEventListener('click', async () => {
  try {
    await API.extractLogoColor(projectId);
    toast('Theme updated from logo color');
    loadProject();
  } catch (err) {
    toast(err.message, true);
  }
});

const WM_SIZE_PX = { small: 16, medium: 22, large: 30, xlarge: 40 };

function renderWordmarkControls(theme) {
  const p = currentProject;
  document.getElementById('wmSize').value = p.wordmark_size || 'medium';
  document.querySelectorAll('.wm-toggle').forEach((b) => {
    b.classList.toggle('active', !!Number(p[b.dataset.wm]));
  });
  const colorInput = document.getElementById('wmColor');
  colorInput.value = /^#[0-9a-fA-F]{6}$/.test(p.wordmark_color) ? p.wordmark_color : (theme.brand || '#0f4c81');
  const twoTone = document.getElementById('wmTwoTone');
  twoTone.checked = !!p.wordmark_color2;
  document.getElementById('wmTwoToneControls').classList.toggle('hidden', !twoTone.checked);
  document.getElementById('wmColor2').value = /^#[0-9a-fA-F]{6}$/.test(p.wordmark_color2) ? p.wordmark_color2 : '#2563eb';
  document.getElementById('wmSplit').value = p.wordmark_split || 0;
  updateWordmarkPreview(theme);
}

function updateWordmarkPreview(theme) {
  const p = currentProject;
  const el = document.getElementById('wordmarkPreview');
  const name = p.company_name || p.prepared_by_org || 'Company Name';
  el.style.fontSize = (WM_SIZE_PX[p.wordmark_size] || 22) + 'px';
  el.style.fontWeight = Number(p.wordmark_bold) ? '800' : '400';
  el.style.fontStyle = Number(p.wordmark_italic) ? 'italic' : 'normal';
  el.style.textDecoration = Number(p.wordmark_underline) ? 'underline' : 'none';
  const c1 = /^#[0-9a-fA-F]{6}$/.test(p.wordmark_color) ? p.wordmark_color : '';
  const c2 = /^#[0-9a-fA-F]{6}$/.test(p.wordmark_color2) ? p.wordmark_color2 : '';
  if (c2 && name) {
    const n = Number(p.wordmark_split);
    const split = n > 0 && n < name.length ? n : Math.ceil(name.length / 2);
    el.style.color = '';
    el.innerHTML = `<span style="color:${c1 || theme.brand}">${escapeHtml(name.slice(0, split))}</span><span style="color:${c2}">${escapeHtml(name.slice(split))}</span>`;
  } else {
    el.style.color = c1 || theme.brand;
    el.textContent = name;
  }
}

async function saveWordmark(patch) {
  Object.assign(currentProject, patch);
  const t = (currentProject.theme === 'custom' && currentProject.custom_brand_color)
    ? { brand: currentProject.custom_brand_color }
    : (themesMeta.themes.find((x) => x.key === currentProject.theme) || themesMeta.themes[0]);
  updateWordmarkPreview(t);
  try { await API.updateProject(projectId, patch); } catch (err) { toast(err.message, true); }
}

document.querySelectorAll('.wm-toggle').forEach((b) => {
  b.addEventListener('click', () => {
    const field = b.dataset.wm;
    const next = Number(currentProject[field]) ? 0 : 1;
    b.classList.toggle('active', !!next);
    saveWordmark({ [field]: next });
  });
});
document.getElementById('wmSize').addEventListener('change', (e) => saveWordmark({ wordmark_size: e.target.value }));
document.getElementById('wmColor').addEventListener('change', (e) => saveWordmark({ wordmark_color: e.target.value }));
document.getElementById('wmColorClear').addEventListener('click', () => saveWordmark({ wordmark_color: '' }));
document.getElementById('wmColor2').addEventListener('change', (e) => saveWordmark({ wordmark_color2: e.target.value }));
document.getElementById('wmSplit').addEventListener('change', (e) => saveWordmark({ wordmark_split: parseInt(e.target.value, 10) || 0 }));
document.getElementById('wmTwoTone').addEventListener('change', (e) => {
  document.getElementById('wmTwoToneControls').classList.toggle('hidden', !e.target.checked);
  if (e.target.checked) {
    saveWordmark({ wordmark_color2: document.getElementById('wmColor2').value });
  } else {
    saveWordmark({ wordmark_color2: '' });
  }
});

document.getElementById('removeLogoBtn').addEventListener('click', async () => {
  if (!confirm('Remove the company logo? You can then use a company name on the cover instead.')) return;
  try {
    await API.removeLogo(projectId);
    toast('Logo removed');
    loadProject();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---- Overview form ----
document.getElementById('overviewForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  try {
    await API.updateProject(projectId, data);
    toast('Project details saved');
    loadProject();
  } catch (err) {
    toast(err.message, true);
  }
});

async function uploadLogoFile(file) {
  if (!file) return;
  // Instant client-side preview, then upload (uploading is near-instant anyway).
  const prev = document.getElementById('logoUploadPreview');
  if (prev && /^image\//.test(file.type)) {
    prev.src = URL.createObjectURL(file);
    prev.classList.remove('hidden');
  }
  try {
    await API.uploadLogo(projectId, file);
    toast('Logo updated');
    loadProject();
  } catch (err) {
    toast(err.message, true);
    if (prev) prev.classList.add('hidden');
  }
}

document.getElementById('logoInput').addEventListener('change', (e) => uploadLogoFile(e.target.files[0]));

// Drag-and-drop onto the upload zone.
const logoZone = document.getElementById('brandingUploadState');
if (logoZone) {
  ['dragenter', 'dragover'].forEach((ev) => logoZone.addEventListener(ev, (e) => {
    e.preventDefault(); logoZone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach((ev) => logoZone.addEventListener(ev, (e) => {
    e.preventDefault(); if (ev === 'dragleave' && logoZone.contains(e.relatedTarget)) return; logoZone.classList.remove('dragover');
  }));
  logoZone.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) uploadLogoFile(f); });
}

document.getElementById('deleteProjectBtn').addEventListener('click', async () => {
  if (!confirm('Delete this entire project, including all findings and evidence? This cannot be undone.')) return;
  try {
    await API.deleteProject(projectId);
    window.location.href = '/index.html';
  } catch (err) {
    toast(err.message, true);
  }
});

// ---- Scope ----
function renderScope(scope) {
  const list = document.getElementById('scopeList');
  list.innerHTML = '';
  if (!scope.length) {
    list.innerHTML = '<div class="helptext">No scope items added yet.</div>';
    return;
  }
  const groups = [];
  for (const s of scope) {
    let g = groups.find((x) => x.name === (s.group_name || 'Scope'));
    if (!g) { g = { name: s.group_name || 'Scope', items: [] }; groups.push(g); }
    g.items.push(s);
  }
  for (const g of groups) {
    const heading = document.createElement('h3');
    heading.textContent = g.name;
    heading.style.marginTop = '18px';
    list.appendChild(heading);
    for (const s of g.items) {
      const row = document.createElement('div');
      row.className = 'list-item';
      const content = s.item_type === 'app'
        ? `<strong>${escapeHtml(s.app_name)}</strong> ${escapeHtml(s.app_version || '')} ${s.platform ? `(${escapeHtml(s.platform)})` : ''}`
        : `<strong>${escapeHtml(s.tenant)}</strong> — ${escapeHtml(s.url)}`;
      row.innerHTML = `
        <div class="content">${content}</div>
        <button class="icon-btn danger" title="Remove">&#10005;</button>
      `;
      row.querySelector('button').addEventListener('click', async () => {
        try {
          await API.deleteScope(s.id);
          loadProject();
        } catch (err) {
          toast(err.message, true);
        }
      });
      list.appendChild(row);
    }
  }
}

const scopeItemType = document.getElementById('scopeItemType');
const scopeUrlFields = document.getElementById('scopeUrlFields');
const scopeAppFields = document.getElementById('scopeAppFields');
scopeItemType.addEventListener('change', () => {
  const isApp = scopeItemType.value === 'app';
  scopeUrlFields.classList.toggle('hidden', isApp);
  scopeAppFields.classList.toggle('hidden', !isApp);
});

document.getElementById('scopeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  if (!data.tenant) data.tenant = 'ALL';
  try {
    await API.addScope(projectId, data);
    const groupName = data.group_name;
    e.target.reset();
    document.querySelector('#scopeForm [name=group_name]').value = groupName;
    document.querySelector('#scopeForm [name=tenant]').value = 'ALL';
    scopeUrlFields.classList.remove('hidden');
    scopeAppFields.classList.add('hidden');
    scopeItemType.value = 'url';
    loadProject();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---- Findings ----
const severityClass = (sev) => `badge-${(sev || 'medium').toLowerCase()}`;

function renderFindings(findings) {
  const body = document.getElementById('findingsBody');
  const empty = document.getElementById('findingsEmpty');
  body.innerHTML = '';
  if (!findings.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  for (const f of findings) {
    const tr = document.createElement('tr');
    tr.className = 'finding-row';
    tr.innerHTML = `
      <td>${escapeHtml(f.identifier)}</td>
      <td>${escapeHtml(f.title)}</td>
      <td>${escapeHtml(f.category || '—')}</td>
      <td><span class="badge ${severityClass(f.severity)}">${escapeHtml(f.severity)}</span></td>
      <td>${f.cvss_score ? f.cvss_score.toFixed(1) : '—'}</td>
      <td><span class="badge badge-outline">${escapeHtml(f.status)}</span></td>
      <td><button class="btn small secondary" data-id="${f.id}">Edit</button></td>
    `;
    tr.querySelector('button').addEventListener('click', (ev) => {
      ev.stopPropagation();
      window.location.href = `/finding.html?id=${f.id}&project=${projectId}`;
    });
    tr.addEventListener('click', () => {
      window.location.href = `/finding.html?id=${f.id}&project=${projectId}`;
    });
    body.appendChild(tr);
  }
}

const newFindingModal = document.getElementById('newFindingModal');
document.getElementById('newFindingBtn').addEventListener('click', () => newFindingModal.classList.remove('hidden'));
document.getElementById('cancelNewFinding').addEventListener('click', () => newFindingModal.classList.add('hidden'));
newFindingModal.addEventListener('click', (e) => { if (e.target === newFindingModal) newFindingModal.classList.add('hidden'); });

document.getElementById('newFindingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  // Inline-validate the required title.
  const titleRow = form.title.closest('.form-row');
  if (!(data.title || '').trim()) { if (titleRow) titleRow.classList.add('invalid'); form.title.focus(); return; }
  if (titleRow) titleRow.classList.remove('invalid');
  try {
    const finding = await API.createFinding(projectId, data);
    window.location.href = `/finding.html?id=${finding.id}&project=${projectId}`;
  } catch (err) {
    toast(err.message, true);
  }
});

// Keyboard: Esc closes the finding modal; Ctrl/Cmd+S saves the open form.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') newFindingModal.classList.add('hidden');
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    if (!newFindingModal.classList.contains('hidden')) { document.getElementById('newFindingForm').requestSubmit(); return; }
    const activePanel = document.querySelector('.tab-panel.active');
    const form = activePanel && activePanel.querySelector('form');
    if (form) form.requestSubmit();
  }
});

// ---- Import from scanner ----
let parsedImportFindings = [];

document.getElementById('importUploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = document.getElementById('importFileInput').files[0];
  if (!file) return;
  try {
    const result = await API.previewImport(projectId, file);
    parsedImportFindings = result.findings;
    document.getElementById('importSummary').textContent = result.count > result.findings.length
      ? `Parsed ${result.count} findings (showing first ${result.findings.length}).`
      : `Parsed ${result.count} finding(s).`;
    renderImportPreview();
    document.getElementById('importPreviewArea').classList.remove('hidden');
  } catch (err) {
    toast(err.message, true);
  }
});

function renderImportPreview() {
  const body = document.getElementById('importPreviewBody');
  body.innerHTML = '';
  parsedImportFindings.forEach((f, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="import-check" data-idx="${i}" checked /></td>
      <td>${escapeHtml(f.title)}</td>
      <td><span class="badge ${severityClass(f.severity)}">${escapeHtml(f.severity)}</span></td>
      <td class="code" style="word-break:break-all;">${escapeHtml(f.url || '—')}</td>
      <td>${escapeHtml(f.source || '—')}</td>
    `;
    body.appendChild(tr);
  });
}

document.getElementById('importSelectAllBtn').addEventListener('click', () => {
  const boxes = document.querySelectorAll('.import-check');
  const allChecked = [...boxes].every((b) => b.checked);
  boxes.forEach((b) => { b.checked = !allChecked; });
});

document.getElementById('importCommitBtn').addEventListener('click', async () => {
  const selected = [...document.querySelectorAll('.import-check:checked')].map((b) => parsedImportFindings[Number(b.dataset.idx)]);
  if (!selected.length) return toast('Select at least one finding to import', true);
  try {
    const result = await API.commitImport(projectId, selected);
    toast(`Imported ${result.created} finding(s)`);
    document.getElementById('importPreviewArea').classList.add('hidden');
    document.getElementById('importUploadForm').reset();
    parsedImportFindings = [];
    loadProject();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---- Finding templates ----
let findingTemplates = [];
(async () => {
  const [builtin, mine] = await Promise.all([API.getFindingTemplates(), API.getMyTemplates().catch(() => [])]);
  const userTpls = mine.map((t) => ({ ...t, key: `user:${t.id}` }));
  findingTemplates = [...userTpls, ...builtin];
  const select = document.getElementById('templateSelect');
  const addGroup = (label, list, labelField) => {
    if (!list.length) return;
    const og = document.createElement('optgroup');
    og.label = label;
    for (const t of list) {
      const opt = document.createElement('option');
      opt.value = t.key;
      opt.textContent = t[labelField] || t.title;
      og.appendChild(opt);
    }
    select.appendChild(og);
  };
  addGroup('My Templates', userTpls, 'name');
  addGroup('Built-in', builtin, 'title');
})();

document.getElementById('templateSelect').addEventListener('change', (e) => {
  const t = findingTemplates.find((tpl) => tpl.key === e.target.value);
  const form = document.getElementById('newFindingForm');
  if (!t) {
    form.reset();
    return;
  }
  form.elements['title'].value = t.title;
  form.elements['category'].value = t.category || '';
  form.elements['scope_type'].value = 'Web Application';
  form.elements['likelihood'].value = t.likelihood || 'Medium';
  form.elements['impact'].value = t.impact || 'Medium';
  form.elements['owasp_category'].value = t.owasp_category || '';
  form.elements['cwe_id'].value = t.cwe_id || '';
  form.elements['cvss_vector'].value = t.cvss_vector || '';
  form.elements['description'].value = t.description || '';
  form.elements['remediation'].value = t.remediation || '';
});

guardUnsaved(document.getElementById('overviewForm'));
loadProject();
