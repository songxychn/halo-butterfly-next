// Inlined by the build before first paint; Halo expressions stay in the template.
try {
  const conf = window.MainApp.conf;
  const mode = conf.style_mode;
  const saved = localStorage.getItem('halo-butterfly-next.color-scheme');
  const acm = conf.darkmode_autoChangeMode;
  const autoMode = (acm === 1 || acm === '1') ? 1 : (acm === 2 || acm === '2') ? 2 : false;
  const parseHour = (value: unknown, fallback: number) => {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const h = Math.trunc(n);
    return (h < 0 || h > 24) ? fallback : h;
  };
  const start = parseHour(conf.darkmode_start, 6);
  const end = parseHour(conf.darkmode_end, 18);
  const hour = new Date().getHours();
  const night = start < end ? (hour < start || hour >= end) : (hour >= start || hour < end);
  let theme = 'light';
  if (mode === 'light' || mode === 'dark') theme = mode;
  else if (saved === 'light' || saved === 'dark') theme = saved;
  else {
    const effective = autoMode !== false ? autoMode : (mode === 'auto' ? 2 : false);
    if (effective === 1) {
      const light = window.matchMedia('(prefers-color-scheme: light)').matches;
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = light ? 'light' : dark ? 'dark' : (night ? 'dark' : 'light');
    } else if (effective === 2) theme = night ? 'dark' : 'light';
  }
  document.documentElement.dataset.colorScheme = theme;
} catch { document.documentElement.dataset.colorScheme = 'light'; }
try {
  const restoreAside = window.MainApp.conf.restore_aside;
  if (restoreAside) {
    const raw = localStorage.getItem('aside-status');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.expiry && Date.now() > data.expiry) localStorage.removeItem('aside-status');
      else if (data.value !== undefined) document.documentElement.classList.toggle('hide-aside', data.value === 'hide');
    }
  }
} catch {}

// Capture readiness before deferred page bundles execute.
window.MainApp.codeDomReady = new Promise(resolve => {
  document.addEventListener('DOMContentLoaded', resolve, {once: true});
});
