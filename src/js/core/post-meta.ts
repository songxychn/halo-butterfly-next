/**
 * Post word count / reading time. Same rule as the Thymeleaf postMeta fragment:
 * strip tags, then length / CHARS_PER_MINUTE (ceil). Not hexo-wordcount.
 * Rendering is gated by wordcount.enable (default false) and busuanzi.page_pv (default false).
 */
export const CHARS_PER_MINUTE = 500;

export function stripHtmlToText(html: unknown) {
  return String(html ?? '').replace(/<[^>]+>/g, '');
}

export function countPostChars(html: unknown) {
  return stripHtmlToText(html).length;
}

export function minutesToRead(html: unknown, charsPerMinute = CHARS_PER_MINUTE) {
  const n = countPostChars(html);
  return n === 0 ? 0 : Math.ceil(n / charsPerMinute);
}
