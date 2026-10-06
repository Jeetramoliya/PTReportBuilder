// Accent-colour switcher. Applies the saved accent immediately (before paint) and injects a
// small fixed picker into every page. Per-browser only (localStorage), no server state.
(function () {
  const ACCENTS = ['violet', 'cyan', 'emerald', 'amber', 'rose'];
  const KEY = 'vapt_accent';
  let saved;
  try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }
  const current = ACCENTS.includes(saved) ? saved : 'violet';
  document.documentElement.dataset.accent = current;

  const MODE_KEY = 'vapt_theme';
  let mode;
  try { mode = localStorage.getItem(MODE_KEY); } catch (e) { mode = null; }
  mode = mode === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = mode;

  // Favicon = BlackRoot mark.
  try {
    const fav = document.createElement('link');
    fav.rel = 'icon';
    fav.type = 'image/svg+xml';
    fav.href = '/img/blackroot-icon.svg';
    document.head.appendChild(fav);
  } catch (e) { /* ignore */ }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Viewport-aware tooltip: a single floating bubble that flips above/below and clamps to the
  // screen edges, so it's never clipped (which the pure-CSS version was, near edges/overflow).
  function initTooltips() {
    let tip = null;
    let tipFor = null;
    const hide = () => { if (tip) { tip.remove(); tip = null; tipFor = null; } };
    const place = (el) => {
      const r = el.getBoundingClientRect();
      const tr = tip.getBoundingClientRect();
      let top = r.top - tr.height - 8;
      if (top < 6) top = r.bottom + 8;                         // flip below if no room above
      let left = r.left + r.width / 2 - tr.width / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8)); // clamp horizontally
      tip.style.top = `${Math.round(top)}px`;
      tip.style.left = `${Math.round(left)}px`;
    };
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest('[data-tip]');
      if (!el || el === tipFor) return;
      hide();
      const text = el.getAttribute('data-tip');
      if (!text) return;
      tipFor = el;
      tip = document.createElement('div');
      tip.className = 'tip-bubble';
      tip.textContent = text;
      document.body.appendChild(tip);
      place(el);
      requestAnimationFrame(() => { if (tip) tip.classList.add('show'); });
    });
    document.addEventListener('mouseout', (e) => {
      const el = e.target.closest('[data-tip]');
      if (el && el === tipFor) hide();
    });
    document.addEventListener('mousedown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
  }

  // Profile menu in the top bar (name, email, role, admin link, logout). Injected into a
  // `.topbar-right` container; skipped on pages where the user isn't signed in (e.g. login).
  async function buildProfile() {
    const right = document.querySelector('.topbar-right');
    if (!right || right.querySelector('.topbar-profile')) return;
    let me;
    try { const r = await fetch('/api/auth/me'); if (r.ok) me = (await r.json()).user; } catch (e) { /* not signed in */ }
    if (!me) return;
    const nameOrEmail = me.name || me.email;
    const initials = (String(nameOrEmail).trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('') || '?').toUpperCase();
    const role = me.is_admin ? 'Admin' : 'User';
    const dd = document.createElement('div');
    dd.className = 'dropdown topbar-profile';
    dd.innerHTML =
      `<button type="button" class="profile-btn">
         <span class="profile-avatar">${esc(initials)}</span>
         <span class="profile-name">${esc(nameOrEmail)}</span>
         <span class="profile-caret">▾</span>
       </button>
       <div class="dropdown-menu hidden">
         <div class="profile-head">
           <div class="profile-name-full">${esc(me.name || '—')}</div>
           <div class="profile-email">${esc(me.email)}</div>
           <div style="margin-top:7px;"><span class="badge ${me.is_admin ? 'badge-info' : 'badge-outline'}">${role}</span></div>
         </div>
         <hr class="section-divider" style="margin:8px 0;">
         ${me.is_admin ? '<a href="/admin.html">Admin Panel</a>' : ''}
         <a href="/index.html">My Projects</a>
         <a href="#" class="profile-logout">Log out</a>
       </div>`;
    right.appendChild(dd);
    const btn = dd.querySelector('.profile-btn');
    const menu = dd.querySelector('.dropdown-menu');
    btn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); });
    document.addEventListener('click', () => menu.classList.add('hidden'));
    dd.querySelector('.profile-logout').addEventListener('click', async (e) => {
      e.preventDefault();
      try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (_) { /* ignore */ }
      window.location.href = '/login.html';
    });
  }

  function build() {
    initTooltips();
    buildProfile();
    if (document.querySelector('.accent-picker')) return;
    const picker = document.createElement('div');
    picker.className = 'accent-picker';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'theme-toggle';
    toggle.setAttribute('data-tip', 'Light / dark mode');
    const setToggleIcon = () => { toggle.textContent = document.documentElement.dataset.theme === 'light' ? '☾' : '☀'; };
    setToggleIcon();
    toggle.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(MODE_KEY, next); } catch (e) { /* ignore */ }
      setToggleIcon();
    });
    picker.appendChild(toggle);
    const sep = document.createElement('span');
    sep.className = 'accent-sep';
    picker.appendChild(sep);

    const label = document.createElement('span');
    label.className = 'ap-label';
    label.setAttribute('aria-hidden', 'true');
    label.innerHTML = '&#127912;';
    picker.appendChild(label);
    ACCENTS.forEach((a) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'accent-dot' + (a === document.documentElement.dataset.accent ? ' active' : '');
      dot.dataset.accent = a;
      dot.setAttribute('data-tip', a[0].toUpperCase() + a.slice(1));
      dot.addEventListener('click', () => {
        document.documentElement.dataset.accent = a;
        try { localStorage.setItem(KEY, a); } catch (e) { /* ignore */ }
        picker.querySelectorAll('.accent-dot').forEach((d) => d.classList.toggle('active', d.dataset.accent === a));
      });
      picker.appendChild(dot);
    });
    document.body.appendChild(picker);

    // "Powered by BlackRoot" brand badge, bottom-right. Uses the real logo asset at
    // /img/blackroot.(svg|png); if that file isn't present, falls back to a text wordmark.
    if (!document.querySelector('.brandmark')) {
      const mark = document.createElement('div');
      mark.className = 'brandmark';
      const pre = document.createElement('span');
      pre.className = 'bm-pre';
      pre.textContent = 'Powered by';
      const logo = document.createElement('img');
      logo.className = 'brandmark-logo';
      logo.alt = 'BlackRoot';
      logo.src = '/img/blackroot.svg';
      // Fall back svg -> png -> text wordmark.
      logo.addEventListener('error', () => {
        if (logo.src.endsWith('.svg')) { logo.src = '/img/blackroot.png'; return; }
        const strong = document.createElement('strong');
        strong.textContent = 'BLACKROOT';
        logo.replaceWith(strong);
      });
      mark.appendChild(pre);
      mark.appendChild(logo);
      document.body.appendChild(mark);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
