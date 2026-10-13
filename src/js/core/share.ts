import { preconnectResource } from './resource-hints.ts';
import { t } from './i18n';
import { pageScope } from './page-lifecycle.ts';
import { resolveResource, loadManagedResource } from './external-resource.ts';
interface ShareWindow extends Window { socialShare?: (element: HTMLElement, options?: unknown) => void; a2a_config?: Record<string, unknown> }
const LABELS: Record<string, string> = {facebook: 'Facebook', x: 'X', twitter: 'Twitter', get wechat() { return t('ui.wechat'); }, get weibo() { return t('ui.weibo'); }, qq: 'QQ', get qzone() { return t('ui.qzone'); }, linkedin: 'LinkedIn', get sina_weibo() { return t('ui.weibo'); }, facebook_messenger: 'Messenger', get email() { return t('ui.email'); }, get copy_link() { return t('ui.copyLink'); }};
export function parseShareItems(value: string, allowed?: string[]) {
  return [...new Set(value.split(',').map(item => item.trim().toLowerCase()).filter(item => /^[a-z][a-z0-9_]*$/.test(item) && (!allowed || allowed.includes(item))))];
}
export function safeShareUrl(value: string, base: string) {
  try { const url = new URL(value, base); return ['http:', 'https:'].includes(url.protocol) ? url.href : base; } catch { return base; }
}
function loadScript(url: string) {
  return new Promise<void>((resolve, reject) => {
    preconnectResource(url);
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
    try { await navigator.clipboard.writeText(url); if (status) status.textContent = t('ui.linkCopied'); }
    catch { field?.focus(); field?.select(); if (status) status.textContent = t('ui.copyManual'); }
  });
  const system = region.querySelector<HTMLButtonElement>('[data-share-system]');
  if (system && typeof navigator.share === 'function') {
    system.hidden = false;
    system.addEventListener('click', async () => {
      try { await navigator.share({title: region.dataset.title ?? root.title, url}); }
      catch (error) { if ((error as Error).name !== 'AbortError' && status) status.textContent = t('ui.shareFallback'); }
    });
  }
  const win = window as ShareWindow, scope = pageScope();
  if (region.dataset.postShare === 'sharejs') {
    const sites = parseShareItems(region.dataset.items ?? '', ['facebook', 'x', 'twitter', 'wechat', 'weibo', 'qq', 'qzone', 'linkedin']);
    if (!sites.length) return;
    const host = region.querySelector<HTMLElement>('[data-share-provider]')!;
    host.dataset.title = region.dataset.title ?? '';
    host.dataset.url = url; host.dataset.image = region.dataset.image ? safeShareUrl(region.dataset.image, location.href) : '';
    host.dataset.sites = sites.join(',');
    const style = 'plugins/sharejs/css/share.min.css', script = 'plugins/sharejs/js/social-share.min.js';
    const localStyle = MainApp.conf.assets_link + style, localScript = MainApp.conf.assets_link + script;
    const styles = loadManagedResource(resolveResource('sharejs_css', localStyle, MainApp.resources, MainApp.version, style), localStyle, {document: root, kind: 'style'});
    const scripts = typeof win.socialShare === 'function' ? Promise.resolve(true) : loadManagedResource(resolveResource('sharejs', localScript, MainApp.resources, MainApp.version, script), localScript, {document: root, attributes: {'data-theme-script':'sharejs', 'data-resource-key':'sharejs', 'data-resource-file':script}, valid: () => typeof win.socialShare === 'function'});
    void Promise.all([styles, scripts]).then(([styled, loaded]) => {
      if (!styled || !loaded) throw new Error('Share resources unavailable');
      if (!scope.active || !region.isConnected) return;
      win.socialShare?.(host, {sites, mobileSites: sites, url, title: region.dataset.title ?? root.title, image: host.dataset.image, description: root.querySelector<HTMLMetaElement>('meta[name=description]')?.content || '', source: root.title, origin: location.origin});
      host.querySelectorAll<HTMLAnchorElement>('a').forEach(link => {
        const name = sites.find(site => link.classList.contains(`icon-${site}`));
        link.setAttribute('aria-label', t('ui.shareTo', LABELS[name ?? ''] ?? name ?? t('ui.platform')));
        link.rel = 'noopener noreferrer';
        if (name === 'wechat') {
          link.href = '#';
          link.addEventListener('focus', () => link.classList.remove('wechat-dismissed'));
          link.addEventListener('click', e => {
            e.preventDefault();
            const open = link.classList.toggle('wechat-open');
            link.classList.toggle('wechat-dismissed', !open);
          });
          link.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
              link.classList.remove('wechat-open');
              link.classList.add('wechat-dismissed');
            }
          });
        } else if (link.href.startsWith('http:')) link.href = link.href.replace(/^http:/, 'https:');
      });
    }).catch(() => { if (status) status.textContent = t('ui.shareError'); });
  } else if (region.dataset.postShare === 'addtoany') {
    const items = parseShareItems(region.dataset.items ?? '');
    if (!items.length) return;
    const host = region.querySelector<HTMLElement>('[data-share-provider]')!;
    host.className = 'a2a_kit a2a_kit_size_32 a2a_default_style';
    host.dataset.a2aUrl = url; host.dataset.a2aTitle = region.dataset.title ?? '';
    for (const item of items) {
      const link = root.createElement('a'); link.className = `a2a_button_${item}`;
      link.href = `https://www.addtoany.com/add_to/${item}?linkurl=${encodeURIComponent(url)}&linkname=${encodeURIComponent(region.dataset.title ?? '')}`;
      link.textContent = LABELS[item] ?? item; link.setAttribute('aria-label', t('ui.shareTo', LABELS[item] ?? item));
      link.target = '_blank'; link.rel = 'noopener noreferrer'; host.append(link);
    }
    win.a2a_config = {...win.a2a_config, num_services: items.length};
    void loadScript('https://static.addtoany.com/menu/page.js').catch(() => { if (status) status.textContent = t('ui.shareError'); });
  }
}
