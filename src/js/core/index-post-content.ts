/**
 * 首页列表摘要。对齐 Butterfly 5.7.0 scripts/common/postDesc.js
 *（f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * method：false 不显示；1 仅 description；2 description || 截断正文；3（默认）截断正文。
 * length 只作用于 method 2/3 的截断，默认 500。
 * 截断对齐 hexo-util@4 truncate：不足 length 原样，否则 length-3 字符加 "..."。
 * 去标签用与 post-meta 相同的简单正则，再把换行换成空格（同 postDesc.truncateContent）。
 * Halo 手动摘要对应 description = spec.excerpt.raw。不引入 moment。
 */
const DEFAULT_LENGTH = 500;
const OMISSION = '...';

export function resolveIndexPostContentMethod(value: unknown) {
  if (value === false || value === 'false') return false;
  const n = Number(value);
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 3;
}

export function resolveIndexPostContentLength(value: unknown) {
  if (value == null || value === '') return DEFAULT_LENGTH;
  const n = Number(value);
  return Number.isFinite(n) ? n : DEFAULT_LENGTH;
}

export function stripHtmlToPlain(html: unknown) {
  return String(html ?? '').replace(/<[^>]+>/g, '').replace(/\n/g, ' ');
}

export function truncatePlain(str: unknown, length: number) {
  const text = String(str ?? '');
  if (text.length < length) return text;
  const cut = Math.max(0, length - OMISSION.length);
  return text.slice(0, cut) + OMISSION;
}

export function truncateContent(content: unknown, length: number, encrypt = false) {
  if (!content || encrypt) return '';
  return truncatePlain(stripHtmlToPlain(content), length);
}

export function postDesc(data: {description?: string; content?: unknown} = {}, config: {method?: unknown; length?: unknown} = {}) {
  const method = resolveIndexPostContentMethod(config.method);
  if (method === false) return '';
  const length = resolveIndexPostContentLength(config.length);
  const description = data.description ?? '';
  switch (method) {
    case 1:
      return description || '';
    case 2:
      return description || truncateContent(data.content, length);
    default:
      return truncateContent(data.content, length);
  }
}
