import { t } from './i18n';
/** Butterfly 5.7.0 copy.copyright adapted to Halo article bodies. */

export function appendAttribution(text: string, limit: number, author: string, url: string, site: string, license: string) {
  return text.length > limit ? `${text}\n\n${t('ui.attribution', author, url, site, license)}` : text;
}

export function bindCopyAttribution(root = document) {
  const article = root.querySelector<HTMLElement>('article.render[data-copy-enabled]');
  if (!article || article.dataset.copyBound) return;
  article.dataset.copyBound = 'true';
  root.addEventListener('copy', (event: ClipboardEvent) => {
    if (event.defaultPrevented) return;
    if (event.target instanceof Element && event.target.closest('input,textarea,[contenteditable="true"]')) return;
    const selection = root.getSelection();
    if (!selection || selection.isCollapsed || !selection.anchorNode || !selection.focusNode) return;
    const selectedElement = selection.anchorNode.parentElement;
    if (!article.contains(selection.anchorNode) || !article.contains(selection.focusNode) ||
      selectedElement?.closest('pre,code,input,textarea,[contenteditable="true"]')) return;
    if (article.dataset.copyEnabled === 'false') { event.preventDefault(); return; }
    if (article.dataset.copyCopyright !== 'true' || !event.clipboardData) return;
    const text = selection.toString();
    const rawLimit = Number(article.dataset.copyLimit ?? 150);
    const limit = Number.isFinite(rawLimit) ? Math.max(0, rawLimit) : 150;
    if (text.length <= limit) return;
    try {
      event.clipboardData.setData('text/plain', appendAttribution(text, limit,
        article.dataset.copyAuthor ?? '', article.dataset.copyUrl ?? location.href,
        article.dataset.copySite ?? '', article.dataset.copyLicense ?? ''));
      event.preventDefault();
    } catch { /* Preserve browser copy if clipboard access fails. */ }
  });
}
