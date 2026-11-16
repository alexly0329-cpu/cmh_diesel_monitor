/* Apply the preference before first paint; storage may be unavailable in private mode. */
(() => {
  const root = document.documentElement;
  let saved;
  try { saved = localStorage.getItem('cmh-color-scheme'); } catch (_) {}
  root.dataset.colorScheme = saved === 'dark' || saved === 'light' ? saved :
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    const sync = () => toggle.setAttribute('aria-checked', root.dataset.colorScheme === 'dark');
    sync();
    toggle.addEventListener('click', () => {
      root.dataset.colorScheme = root.dataset.colorScheme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('cmh-color-scheme', root.dataset.colorScheme); } catch (_) {}
      sync();
    });
  });
})();
