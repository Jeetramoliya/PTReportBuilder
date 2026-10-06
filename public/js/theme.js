// Accent-colour switcher. Applies the saved accent immediately (before paint) and injects a
// small fixed picker into every page. Per-browser only (localStorage), no server state.
(function () {
  const ACCENTS = ['violet', 'cyan', 'emerald', 'amber', 'rose'];
  const KEY = 'vapt_accent';
  let saved;
  try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }
  const current = ACCENTS.includes(saved) ? saved : 'violet';
  document.documentElement.dataset.accent = current;

  function build() {
    if (document.querySelector('.accent-picker')) return;
    const picker = document.createElement('div');
    picker.className = 'accent-picker';
    picker.innerHTML = '<span class="ap-label" aria-hidden="true">&#127912;</span>';
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
