/**
 * 文章目录。对齐 Butterfly 5.7.0
 * _config.yml toc + layout/includes/widget/card_post_toc.pug
 * + layout/includes/widget/index.pug + source/js/main.js scrollFnToDo
 * + source/js/utils.js btf.getScrollPercent
 * （f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * 默认：number true、expand false、style_simple false、scroll_percent true。
 * number 对应 hexo toc(..., {list_number})，序号形如 1. / 1.1.。
 * expand 对应 .toc-content.is-expand；false 时子级折叠，当前项父级展开。
 * style_simple 仅文章页：true 时侧栏只留目录（不含最近文章等）。
 * scroll_percent 对应 GLOBAL_CONFIG.percent.toc，写入 .toc-percentage。
 * 不做 toc.post / toc.page、anchor、related_post、逐页 toc_number / toc_expand / toc_style_simple。
 */

const DEFAULTS = {
  number: true,
  expand: false,
  style_simple: false,
  scroll_percent: true,
};

export { DEFAULTS };

function isExplicitFalse(value: unknown) {
  return value === false || value === 'false';
}

function isExplicitTrue(value: unknown) {
  return value === true || value === 'true';
}

/** 默认 true；仅显式 false 关闭。 */
export function resolveNumber(value: unknown) {
  if (isExplicitFalse(value)) return false;
  if (isExplicitTrue(value)) return true;
  return DEFAULTS.number;
}

/** 默认 false；仅显式 true 开启。 */
export function resolveExpand(value: unknown) {
  return isExplicitTrue(value);
}

/** 默认 false；仅显式 true 开启。仅文章页。 */
export function resolveStyleSimple(value: unknown) {
  return isExplicitTrue(value);
}

/** 默认 true；仅显式 false 关闭。 */
export function resolveScrollPercent(value: unknown) {
  if (isExplicitFalse(value)) return false;
  if (isExplicitTrue(value)) return true;
  return DEFAULTS.scroll_percent;
}

/** tocbot collapseDepth：展开全部用 6，折叠子级用 0。 */
export function resolveCollapseDepth(value: unknown) {
  return resolveExpand(value) ? 6 : 0;
}

/** 对齐 hexo toc list_number：1. / 1.1. / 2.3.1. */
export function formatTocNumber(parts: number[]) {
  return `${parts.join('.')}.`;
}

interface TocItem { text: string; children?: TocItem[] }
interface NumberedTocItem { number: string; text: string; children: NumberedTocItem[] }
export function numberTocItems(items: TocItem[], prefix: number[] = []): NumberedTocItem[] {
  return (items || []).map((item, index) => {
    const parts = [...prefix, index + 1];
    return {
      number: formatTocNumber(parts),
      text: item.text,
      children: numberTocItems(item.children || [], parts),
    };
  });
}

function listItems(list: Element) {
  return [...list.children].filter(node => node.tagName === 'LI');
}

function childList(item: Element) {
  return [...item.children].find(node => node.tagName === 'OL' || node.tagName === 'UL');
}

export function applyTocNumbers(root: Element | null, enabled: boolean) {
  if (!root || !root.querySelectorAll) return;
  for (const node of root.querySelectorAll('.toc-number')) node.remove();
  root.classList?.toggle?.('is-numbered', Boolean(enabled));
  if (!enabled) return;
  const walk = (list: Element | null | undefined, prefix: number[]): void => {
    if (!list) return;
    listItems(list).forEach((item, index) => {
      const parts = [...prefix, index + 1];
      const link = [...item.children].find(node => node.matches?.('a, .toc-link'));
      if (link && !link.querySelector('.toc-number')) {
        const span = root.ownerDocument.createElement('span');
        span.className = 'toc-number';
        span.textContent = formatTocNumber(parts);
        link.insertBefore(span, link.firstChild);
      }
      walk(childList(item), parts);
    });
  };
  walk(root.querySelector(':scope > ol, :scope > ul, .toc-list'), []);
}

/**
 * 对齐 btf.getScrollPercent(currentTop, ele)。
 * viewport 可注入 innerHeight / document.documentElement.scrollHeight 以便测试。
 */
export interface ScrollViewport { innerHeight: number; document?: {documentElement?: {scrollHeight: number}} }
export function getScrollPercent(currentTop: number, ele: Pick<HTMLElement, 'clientHeight' | 'offsetTop'> | null, viewport: ScrollViewport = globalThis) {
  if (!ele) return 0;
  const docHeight = ele.clientHeight;
  const winHeight = viewport.innerHeight;
  const headerHeight = ele.offsetTop;
  const scrollHeight = viewport.document?.documentElement?.scrollHeight ?? 0;
  const contentMath = Math.max(docHeight - winHeight, scrollHeight - winHeight);
  const scrollPercent = contentMath ? (currentTop - headerHeight) / contentMath : 0;
  return Math.max(0, Math.min(100, Math.round(scrollPercent * 100)));
}
