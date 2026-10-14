import { tagFontSize } from './tag-cloud-colors.ts';

export interface TagCloudOptions { orderby?: unknown; order?: unknown; amount?: unknown; minFont?: unknown; maxFont?: unknown; unit?: unknown }
export function tagCloudSettings(input: TagCloudOptions) {
  const unit = ['px', 'em', 'rem'].includes(String(input.unit)) ? String(input.unit) : 'px';
  const bounds = unit === 'px' ? [8, 96, 12, 21] : [.5, 6, .75, 1.3125];
  const font = (value: unknown, fallback: number) => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.min(bounds[1], Math.max(bounds[0], Number(value))) : fallback;
  const minimum = font(input.minFont, bounds[2]), maximum = font(input.maxFont, bounds[3]);
  const amount = Number(input.amount);
  return { unit, min: Math.min(minimum, maximum), max: Math.max(minimum, maximum), amount: Number.isInteger(amount) && amount > 0 ? Math.min(amount, 10000) : 0,
    orderby: ['name', 'length', 'random'].includes(String(input.orderby)) ? String(input.orderby) : 'native', order: Number(input.order) === -1 ? -1 : 1 };
}
export function orderTagItems<T extends { name: string; count: number }>(items: T[], input: TagCloudOptions, locale = 'en', random = Math.random) {
  const settings = tagCloudSettings(input), result = [...items];
  if (settings.orderby === 'random') {
    for (let index = result.length - 1; index > 0; index--) { const other = Math.floor(random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; }
  } else if (settings.orderby !== 'native') {
    result.sort((a,b) => settings.order * ((settings.orderby === 'length' ? a.count - b.count : 0) || a.name.localeCompare(b.name, locale)));
  }
  return settings.amount ? result.slice(0, settings.amount) : result;
}
export function initializeTagCloud(container: HTMLElement, scale = true) {
  const settings = tagCloudSettings(container.dataset);
  const all = Array.from(container.querySelectorAll<HTMLAnchorElement>('a.link')).map(node => ({ node, name: node.textContent || '', count: Math.max(0, Number(node.getAttribute('data-postCount')) || 0) }));
  const selected = orderTagItems(all, container.dataset, document.documentElement.lang || 'en');
  const counts = selected.map(item => item.count);
  for (const item of selected) if (scale) item.node.style.fontSize = tagFontSize(item.count, counts, settings.min, settings.max) + settings.unit;
  container.replaceChildren(...selected.map(item => item.node));
  return selected.map(item => item.node);
}

/** Resolve only same-site archive links, including links in nested navigation groups. */
export function archiveMenuTitle(links: Array<{ href: string; title: string }>, base: string) {
  const origin = new URL(base).origin;
  for (const link of links) {
    try {
      const url = new URL(link.href, base);
      if (url.origin === origin && /^\/archives\/?$/.test(url.pathname) && link.title.trim()) return link.title.trim();
    } catch { /* Malformed author links do not affect the page. */ }
  }
  return '';
}
export function initializeArchiveTitle() {
  const config = window.MainApp.conf;
  if (!document.querySelector('#Butterfly.archives') || config.archive_dated || config.archive_title) return;
  const links = [...document.querySelectorAll<HTMLAnchorElement>('nav.nav menu a[href]')].map(node => ({href: node.href, title: node.getAttribute('title') || node.textContent || ''}));
  const title = archiveMenuTitle(links, location.href);
  if (!title) return;
  document.querySelectorAll('[data-archive-title]').forEach(node => { node.textContent = title; });
  const site = document.querySelector<HTMLMetaElement>('meta[name=author]')?.content;
  document.title = site ? site + ' - ' + title : title;
  document.querySelectorAll<HTMLMetaElement>('meta[property="og:title"],meta[name="twitter:title"]').forEach(node => {node.content = document.title;});
}
