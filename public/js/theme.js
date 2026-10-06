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

  function build() {
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
