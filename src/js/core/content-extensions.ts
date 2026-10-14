import { t } from './i18n';
import { hashId, localAnchorId } from './article-anchor.ts';

// Author content is ordinary, fully readable HTML. Only successful initialization
// adds controls, ARIA and hidden panels; teardown restores the original attributes.
const KEY = Symbol.for('halo-butterfly-next.content-extensions');
declare global { interface HTMLElement { [KEY]?: () => void } }
const HEADINGS = 'H2,H3,H4,H5,H6'.split(',');
interface Tabs { panels: HTMLElement[]; select: (index: number, focus?: boolean) => void }

export function contentTabIndex(value: string | null, count: number) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 1 && index <= count ? index - 1 : 0;
}

function initializeTabs(root: HTMLElement): { tabs: Tabs; cleanup: () => void } | null {
  const doc = root.ownerDocument;
  const panels = [...root.children] as HTMLElement[];
  // Do not hide malformed groups, stray text, or an editor's partially retained HTML.
  if (panels.length < 2 || panels.some(panel => panel.tagName !== 'SECTION' || panel.hasAttribute('hidden')) ||
      [...root.childNodes].some(node => node.nodeType === 3 && node.textContent?.trim())) return null;
  const headings = panels.map(panel => [...panel.children].find(child => HEADINGS.includes(child.tagName)));
  const titles = headings.map(heading => heading?.textContent?.trim() || '');
  if (titles.some(title => !title)) return null;
  if (panels.some(panel => panel.id && [...doc.querySelectorAll('[id]')].filter(node => node.id === panel.id).length !== 1)) return null;

  const original = panels.map(panel => new Map(['id', 'role', 'aria-labelledby', 'tabindex', 'hidden']
    .map(name => [name, panel.getAttribute(name)])));
  const ready = root.getAttribute('data-content-tabs-ready');
  const nav = doc.createElement('div');
  nav.className = 'content-tab-list';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', root.getAttribute('aria-label') || t('ui.contentGroup'));
  const buttons: HTMLButtonElement[] = [];
  let disposed = false;
  const allocateId = (prefix: string) => {
    let index = 1;
    while (doc.getElementById(`${prefix}-${index}`) || buttons.some(button => button.id === `${prefix}-${index}`) ||
        panels.some(panel => panel.id === `${prefix}-${index}`)) index++;
    return `${prefix}-${index}`;
  };
  const select = (index: number, focus = false) => {
    if (disposed) return;
    buttons.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    if (focus) buttons[index].focus({ preventScroll: true });
    // Newly visible media, TOC and layout observers use their existing mechanisms.
  };
  const click = (event: MouseEvent) => {
    const index = buttons.findIndex(button => button === event.target || button.contains(event.target as Node));
    if (index >= 0) select(index);
  };
  const keydown = (event: KeyboardEvent) => {
    const index = buttons.findIndex(button => button === event.target);
    if (index < 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    let next: number;
    switch (event.key) {
      case 'ArrowLeft': next = (index + buttons.length - 1) % buttons.length; break;
      case 'ArrowRight': next = (index + 1) % buttons.length; break;
      case 'Home': next = 0; break;
      case 'End': next = buttons.length - 1; break;
      default: return; // Enter/Space retain native button activation; Up/Down scroll normally.
    }
    event.preventDefault();
    select(next, true);
  };
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    nav.removeEventListener('click', click);
    nav.removeEventListener('keydown', keydown);
    nav.remove();
    panels.forEach((panel, i) => original[i].forEach((value, name) => {
      if (value === null) panel.removeAttribute(name);
      else panel.setAttribute(name, value);
    }));
    if (ready === null) root.removeAttribute('data-content-tabs-ready');
    else root.setAttribute('data-content-tabs-ready', ready);
  };
  try {
    panels.forEach((panel, i) => {
      if (!panel.id) panel.id = allocateId('content-panel');
      const button = doc.createElement('button');
      button.type = 'button';
      button.id = allocateId('content-tab');
      button.textContent = titles[i]; // Never parse titles as HTML or move author nodes.
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', panel.id);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', button.id);
      panel.tabIndex = 0;
      buttons.push(button);
      nav.append(button);
    });
    nav.addEventListener('click', click);
    nav.addEventListener('keydown', keydown);
    root.prepend(nav);
    root.setAttribute('data-content-tabs-ready', '');
    select(contentTabIndex(root.getAttribute('data-content-tabs'), panels.length));
    return { tabs: { panels, select }, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

export function enhanceContent(article: HTMLElement) {
  if (article[KEY]) return article[KEY];
  const doc = article.ownerDocument;
  const win = doc.defaultView;
  if (!win) return () => {};
  const tabs = new Map<HTMLElement, Tabs>();
  const cleanups: (() => void)[] = [];
  for (const root of article.querySelectorAll<HTMLElement>('[data-content-tabs]')) {
    try {
      const result = initializeTabs(root);
      if (!result) continue;
      tabs.set(root, result.tabs);
      cleanups.push(result.cleanup);
    } catch (error) {
      console.debug('Content group remains readable after initialization failure', error);
    }
  }
  const reveal = (id: string) => {
    const target = doc.getElementById(id);
    if (!target || !article.contains(target)) return;
    for (let node: HTMLElement | null = target; node && node !== article; node = node.parentElement) {
      if (node.tagName === 'DETAILS') (node as HTMLDetailsElement).open = true;
      const controller = node.parentElement && tabs.get(node.parentElement);
      if (controller) {
        const index = controller.panels.indexOf(node);
        if (index >= 0) controller.select(index);
      }
    }
  };
  const hashchange = () => reveal(hashId(win.location.hash));
  const click = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target as Element | null;
    const link = target?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const id = localAnchorId(link.href, win.location.href);
    if (id) reveal(id); // Reveal before native anchors / chapter links calculate their scroll position.
  };
  const closedForPrint = new Set<HTMLDetailsElement>();
  const beforeprint = () => {
    for (const details of article.querySelectorAll<HTMLDetailsElement>('details:not([open])')) {
      closedForPrint.add(details);
      details.open = true;
    }
  };
  const afterprint = () => {
    for (const details of closedForPrint) details.open = false;
    closedForPrint.clear();
  };
  doc.addEventListener('click', click);
  win.addEventListener('hashchange', hashchange);
  win.addEventListener('popstate', hashchange);
  win.addEventListener('beforeprint', beforeprint);
  win.addEventListener('afterprint', afterprint);
  hashchange();
  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    afterprint();
    doc.removeEventListener('click', click);
    win.removeEventListener('hashchange', hashchange);
    win.removeEventListener('popstate', hashchange);
    win.removeEventListener('beforeprint', beforeprint);
    win.removeEventListener('afterprint', afterprint);
    cleanups.reverse().forEach(dispose => dispose());
    tabs.clear();
    delete article[KEY];
  };
  article[KEY] = cleanup;
  return cleanup;
}
