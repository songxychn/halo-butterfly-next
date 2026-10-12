interface ShareWindow extends Window { socialShare?: (element: HTMLElement, options?: unknown) => void; a2a_config?: Record<string, unknown> }
const LABELS: Record<string, string> = {facebook: 'Facebook', x: 'X', twitter: 'Twitter', wechat: '微信', weibo: '微博', qq: 'QQ', qzone: 'QQ 空间', linkedin: 'LinkedIn', sina_weibo: '微博', facebook_messenger: 'Messenger', email: '邮件', copy_link: '复制链接'};
export function parseShareItems(value: string, allowed?: string[]) {
  return [...new Set(value.split(',').map(item => item.trim().toLowerCase()).filter(item => /^[a-z][a-z0-9_]*$/.test(item) && (!allowed || allowed.includes(item))))];
}
export function safeShareUrl(value: string, base: string) {
  try { const url = new URL(value, base); return ['http:', 'https:'].includes(url.protocol) ? url.href : base; } catch { return base; }
}
function loadScript(url: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => { script.remove(); reject(new Error('Share service timed out')); }, 10000);
    script.src = url; script.async = true;
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error('Share service unavailable')); };
    document.body.append(script);
  });
}
export function initializeShare(root = document) {
  const region = root.querySelector<HTMLElement>('[data-post-share]');
  if (!region || region.dataset.initialized) return;
  region.dataset.initialized = 'true';
  const url = safeShareUrl(region.dataset.url ?? '', location.href);
  const field = region.querySelector<HTMLInputElement>('[data-share-url]');
  if (field) field.value = url;
  const status = region.querySelector<HTMLElement>('[data-share-status]');
  region.querySelector<HTMLButtonElement>('[data-share-copy]')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); if (status) status.textContent = '链接已复制'; }
    catch { field?.focus(); field?.select(); if (status) status.textContent = '请手动复制链接'; }
  });
  const system = region.querySelector<HTMLButtonElement>('[data-share-system]');
  if (system && typeof navigator.share === 'function') {
    system.hidden = false;
    system.addEventListener('click', async () => {
      try { await navigator.share({title: region.dataset.title ?? root.title, url}); }
      catch (error) { if ((error as Error).name !== 'AbortError' && status) status.textContent = '请使用下方链接分享'; }
    });
  }
  const win = window as ShareWindow;
  if (region.dataset.postShare === 'sharejs') {
    const sites = parseShareItems(region.dataset.items ?? '', ['facebook', 'x', 'twitter', 'wechat', 'weibo', 'qq', 'qzone', 'linkedin']);
    if (!sites.length) return;
    const host = region.querySelector<HTMLElement>('[data-share-provider]')!;
    host.dataset.title = region.dataset.title ?? '';
    host.dataset.url = url; host.dataset.image = region.dataset.image ? safeShareUrl(region.dataset.image, location.href) : '';
    host.dataset.sites = sites.join(',');
    const css = root.createElement('link'); css.rel = 'stylesheet'; css.href = `${MainApp.conf.assets_link}plugins/sharejs/css/share.min.css`; root.head.append(css);
    void loadScript(`${MainApp.conf.assets_link}plugins/sharejs/js/social-share.min.js`).then(() => {
      win.socialShare?.(host, {sites, mobileSites: sites});
      host.querySelectorAll<HTMLAnchorElement>('a').forEach(link => {
        const name = sites.find(site => link.classList.contains(`icon-${site}`));
        link.setAttribute('aria-label', `分享到${LABELS[name ?? ''] ?? name ?? '平台'}`);
        link.rel = 'noopener noreferrer';
        if (name === 'wechat') {
          link.href = '#'; link.addEventListener('click', e => {e.preventDefault(); link.classList.toggle('wechat-open');});
          link.addEventListener('keydown', e => {if (e.key === 'Escape') link.classList.remove('wechat-open');});
        } else if (link.href.startsWith('http:')) link.href = link.href.replace(/^http:/, 'https:');
      });
    }).catch(() => { if (status) status.textContent = '分享组件暂不可用，可复制链接'; });
  } else if (region.dataset.postShare === 'addtoany') {
    const items = parseShareItems(region.dataset.items ?? '');
    if (!items.length) return;
    const host = region.querySelector<HTMLElement>('[data-share-provider]')!;
    host.className = 'a2a_kit a2a_kit_size_32 a2a_default_style';
    host.dataset.a2aUrl = url; host.dataset.a2aTitle = region.dataset.title ?? '';
    for (const item of items) {
      const link = root.createElement('a'); link.className = `a2a_button_${item}`;
      link.href = `https://www.addtoany.com/add_to/${item}?linkurl=${encodeURIComponent(url)}&linkname=${encodeURIComponent(region.dataset.title ?? '')}`;
      link.textContent = LABELS[item] ?? item; link.setAttribute('aria-label', `分享到${LABELS[item] ?? item}`);
      link.target = '_blank'; link.rel = 'noopener noreferrer'; host.append(link);
    }
    win.a2a_config = {...win.a2a_config, num_services: items.length};
    void loadScript('https://static.addtoany.com/menu/page.js').catch(() => { if (status) status.textContent = '分享组件暂不可用，可复制链接'; });
  }
}
