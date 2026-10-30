// Apply a saved choice before the stylesheet paints; otherwise follow the device.
(() => {
  const root = document.documentElement;
  const media = window.matchMedia?.('(prefers-color-scheme: light)') || {matches:false};
  let saved = null;
  try { saved = localStorage.getItem('dlsta-theme'); } catch { /* private browsing */ }
  if (saved !== 'light' && saved !== 'dark') saved = null;
  const apply = () => {
    const theme = saved || (media.matches ? 'light' : 'dark');
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f7f8f0' : '#10130f');
    const toggle = document.querySelector('#theme-toggle');
    if (!toggle) return;
    const next = theme === 'dark' ? 'light' : 'dark';
    toggle.setAttribute('aria-label', `Switch to ${next} mode`);
    toggle.setAttribute('title', `Switch to ${next} mode`);
    toggle.querySelector('.theme-label').textContent = next === 'light' ? 'Light' : 'Dark';
  };
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelector('#theme-toggle')?.addEventListener('click', () => {
      saved = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('dlsta-theme', saved); } catch { /* use this page only */ }
      apply();
    });
  });
  media.addEventListener?.('change', () => { if (!saved) apply(); });
})();
