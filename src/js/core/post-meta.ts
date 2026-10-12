/** Count Chinese characters and other-language words, not HTML bytes. */
export const CHARS_PER_MINUTE = 350;
export const WORDS_PER_MINUTE = 160;

export function stripHtmlToText(html: unknown) {
  const plain = String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  // Browser aggregation decodes all HTML entities, matching Halo's HtmlEscape.
  if (typeof DOMParser !== 'undefined') {
    return (new DOMParser().parseFromString(plain, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
  return plain
    .replace(/&(#x[\da-f]+|#\d+|nbsp|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
      const names: Record<string, string> = {nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"};
      if (code[0] !== '#') return names[code.toLowerCase()] ?? entity;
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : ' ';
    }).replace(/\s+/g, ' ').trim();
}

export function readingMetrics(html: unknown) {
  const text = stripHtmlToText(html);
  const chinese = (text.match(/\p{Script=Han}/gu) ?? []).length;
  const words = (text.replace(/\p{Script=Han}/gu, ' ').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length;
  return {chinese, words, count: chinese + words,
    minutes: Math.ceil(chinese / CHARS_PER_MINUTE + words / WORDS_PER_MINUTE)};
}

export function countPostChars(html: unknown) { return readingMetrics(html).count; }
export function minutesToRead(html: unknown) { return readingMetrics(html).minutes; }

