import { t } from './i18n';

export function safeShareUrl(value: string, base: string) {
  try { const url = new URL(value, base); return ['http:', 'https:'].includes(url.protocol) ? url.href : base; } catch { return base; }
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
}
