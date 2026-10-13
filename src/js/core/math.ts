import { t } from './i18n';
import type { SettingValue } from '../types.ts';

export interface MathOptions {
  enabled?: SettingValue;
  copyTex?: SettingValue;
  hideScrollbar?: SettingValue;
}
const SELECTOR = '.katex-inline,.katex-block,.katex-display,[math-inline],[math-display],.math-inline,.math-display,math';
const bindings = new WeakMap<HTMLElement, () => void>();
export const mathEnabled = (value: SettingValue, fallback = true): boolean =>
  value === false || value === 'false' ? false : value === true || value === 'true' ? true : fallback;

/** Only an explicit formula node is eligible; never scan prose for delimiters. */
export function mathSource(node: Element): string | null {
  const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
  if (annotation) return annotation.textContent ?? '';
  if (node.querySelector('math,.katex,.katex-error') || node.matches('math,.katex-display')) return null;
  if (!node.matches(SELECTOR)) return null;
  return node.getAttribute('content') ?? node.textContent ?? '';
}
export function blockMath(node: Element): boolean {
  return node.matches('.katex-block,.katex-display,[math-display],.math-display,math[display="block"]');
}

export async function copyMathText(text: string, doc: Document): Promise<boolean> {
  const clipboard = doc.defaultView?.navigator.clipboard;
  if (clipboard?.writeText) {
    try { await clipboard.writeText(text); return true; } catch { return false; }
  }
  // Older engines: isolate the fallback and restore focus and all selection ranges.
  const active = doc.activeElement;
  const selection = doc.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const field = doc.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.style.cssText = 'position:fixed;left:-9999px;top:0';
  doc.body.append(field);
  let copied = false;
  try { field.select(); copied = doc.execCommand('copy'); } catch { /* report via the control */ }
  finally {
    field.remove();
    if (active instanceof HTMLElement) active.focus({ preventScroll: true });
    selection?.removeAllRanges();
    for (const range of ranges) selection?.addRange(range);
  }
  return copied;
}

/** Augment existing output, without importing a renderer or replacing native math. */
export function enhanceMath(article: HTMLElement, options: MathOptions = {}): () => void {
  if (bindings.has(article)) return bindings.get(article)!;
  const doc = article.ownerDocument;
  const enabled = mathEnabled(options.enabled);
  const copy = mathEnabled(options.copyTex);
  const records = new Map<Element, { shell: HTMLElement; source: HTMLElement; raw: string | null }>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const resize = new ResizeObserver(entries => {
    for (const { target } of entries) {
      const scroll = target as HTMLElement;
      const overflow = scroll.scrollWidth > scroll.clientWidth + 1;
      if (overflow) {
        scroll.tabIndex = 0;
        scroll.setAttribute('role', 'region');
        scroll.setAttribute('aria-label', t('ui.formula'));
      } else {
        scroll.removeAttribute('tabindex');
        scroll.removeAttribute('role');
        scroll.removeAttribute('aria-label');
      }
    }
  });
  const scan = () => {
    for (const node of article.querySelectorAll(SELECTOR)) {
      if (node.closest('pre,code,button,.theme-math-source')) continue;
      // An editor wrapper owns its descendants; keep MathML semantics untouched.
      if (node.parentElement?.closest(SELECTOR) && article.contains(node.parentElement.closest(SELECTOR))) continue;
      if (!records.has(node) && node.closest('.theme-math-scroll')) continue;
      const raw = mathSource(node);
      const existing = records.get(node);
      if (existing) {
        if (raw !== null && raw !== existing.raw) {
          existing.raw = raw;
          existing.source.textContent = raw;
        }
        continue;
      }
      const block = blockMath(node);
      const shell = doc.createElement('span');
      shell.className = block ? 'theme-math-block' : 'theme-math-inline';
      shell.classList.toggle('hide-math-scrollbar', mathEnabled(options.hideScrollbar, false));
      const scroll = doc.createElement('span');
      scroll.className = 'theme-math-scroll';
      scroll.addEventListener('keydown', event => {
        if (event.target !== scroll || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const distance = event.key === 'ArrowRight' ? 80 : event.key === 'ArrowLeft' ? -80
          : event.key === 'Home' ? -scroll.scrollWidth : event.key === 'End' ? scroll.scrollWidth : 0;
        if (!distance || scroll.scrollWidth <= scroll.clientWidth + 1) return;
        event.preventDefault();
        scroll.scrollBy({ left: distance, behavior: 'instant' });
      });
      node.before(shell);
      shell.append(scroll);
      scroll.append(node);
      const source = doc.createElement('span');
      source.className = 'theme-math-source';
      source.textContent = raw;
      records.set(node, { shell, source, raw });
      if (!enabled && raw !== null) {
        // Hide only the formula with a recoverable source. Keep plugin targets intact.
        node.setAttribute('data-math-source-view', '');
        scroll.append(source);
      }
      if (copy && raw !== null && raw.trim()) {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'theme-math-copy';
        button.textContent = 'TeX';
        button.title = t('ui.copyTex');
        button.setAttribute('aria-label', t('ui.copyTex'));
        const status = doc.createElement('span');
        status.className = 'theme-math-status';
        status.setAttribute('role', 'status');
        button.addEventListener('click', async () => {
          const value = mathSource(node) ?? records.get(node)?.raw;
          const ok = value != null && await copyMathText(value, doc);
          status.textContent = ok ? t('ui.sourceCopied') : t('ui.sourceCopyError');
          const timer = setTimeout(() => { status.textContent = ''; timers.delete(timer); }, 2500);
          timers.add(timer);
        });
        shell.classList.add('has-math-copy');
        shell.append(button, status);
      }
      resize.observe(scroll);
    }
    for (const [node, record] of records) {
      if (!article.contains(node)) { resize.unobserve(record.shell.firstElementChild!); record.shell.remove(); records.delete(node); }
    }
  };
  const selectionCopy = (event: ClipboardEvent) => {
    if (!copy || !event.clipboardData) return;
    const selection = doc.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return;
    const range = selection.getRangeAt(0);
    for (const [node, record] of records) {
      if (!node.contains(range.startContainer) || !node.contains(range.endContainer)) continue;
      // Partial selections retain native browser behavior. Buttons cover source-only mode.
      const full = doc.createRange();
      full.selectNodeContents(node);
      if (range.compareBoundaryPoints(Range.START_TO_START, full) !== 0 || range.compareBoundaryPoints(Range.END_TO_END, full) !== 0) continue;
      const raw = mathSource(node) ?? record.raw;
      if (raw === null) return;
      event.clipboardData.setData('text/plain', raw);
      event.preventDefault();
      return;
    }
  };
  scan();
  const mutations = new MutationObserver(scan);
  mutations.observe(article, { childList: true, subtree: true, characterData: true });
  article.addEventListener('copy', selectionCopy);
  const dispose = () => {
    mutations.disconnect(); resize.disconnect(); article.removeEventListener('copy', selectionCopy);
    for (const timer of timers) clearTimeout(timer);
    // Keep output and controls intact; a page navigation discards this DOM.
  };
  bindings.set(article, dispose);
  return dispose;
}
