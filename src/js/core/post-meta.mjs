/**
 * Post word count / reading time. Same rule as the Thymeleaf postMeta fragment:
 * strip tags, then length / CHARS_PER_MINUTE (ceil). Not hexo-wordcount.
 */
export const CHARS_PER_MINUTE = 500;

export function stripHtmlToText(html) {
  return String(html ?? '').replace(/<[^>]+>/g, '');
}

export function countPostChars(html) {
  return stripHtmlToText(html).length;
}

export function minutesToRead(html, charsPerMinute = CHARS_PER_MINUTE) {
  const n = countPostChars(html);
  return n === 0 ? 0 : Math.ceil(n / charsPerMinute);
}
