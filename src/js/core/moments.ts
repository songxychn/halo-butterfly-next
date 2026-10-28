export function formatMomentDate(value: string, zone = 'UTC', locale = 'zh-CN') {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: zone };
  try { return new Intl.DateTimeFormat(locale, opts).format(date); }
  catch { return new Intl.DateTimeFormat('zh-CN', { ...opts, timeZone: 'UTC' }).format(date); }
}
export function nativeMomentPage(value: string, page: number, total: number) {
  try {
    const url = new URL(value);
    if (!/^\/moments(?:\/page\/[1-9]\d*)?\/?$/.test(url.pathname) || !Number.isSafeInteger(page) || page < 1 || page > total) return null;
    url.pathname = page === 1 ? '/moments' : `/moments/page/${page}`;
    url.hash = '';
    return url.pathname + url.search;
  } catch { return null; }
}
export function initializeMoments(root: Document = document) {
  const win = root.defaultView;
  if (!win) return;
  for (const node of root.querySelectorAll<HTMLElement>('time[data-moment-date][datetime]')) {
    node.textContent = formatMomentDate(node.getAttribute('datetime') || '', node.dataset.timeZone || 'UTC', root.documentElement.lang || 'zh-CN');
  }
  const jump = root.querySelector<HTMLFormElement>('[data-moment-page-jump]');
  if (jump) {
    const input = jump.elements.namedItem('page') as HTMLInputElement;
    const total = Number(jump.dataset.totalPages);
    jump.hidden = false;
    jump.addEventListener('submit', event => {
      event.preventDefault();
      const href = nativeMomentPage(win.location.href, Number(input.value), total);
      if (href) win.location.assign(href);
      else input.reportValidity();
    });
  }
}
