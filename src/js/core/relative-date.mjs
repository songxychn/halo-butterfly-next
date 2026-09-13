/**
 * 相对时间：读 time[datetime] 的绝对时间，替换可见文本。
 * 对齐 Butterfly 5.7.0 post_meta.*.date_format=relative，不引入 moment。
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelative(input, now = Date.now()) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const diff = now - date.getTime();
  if (diff < MINUTE) return '刚刚';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  return `${Math.floor(diff / DAY)} 天前`;
}

function datePrefix(text) {
  if (text.startsWith('发表于 ')) return '发表于 ';
  if (text.startsWith('发布于 ')) return '发布于 ';
  if (text.startsWith('更新于 ')) return '更新于 ';
  return '';
}

export function applyRelativeDates(root = document, now = Date.now()) {
  const nodes = root.querySelectorAll('time[data-relative-date="true"][datetime]');
  for (const el of nodes) {
    const relative = formatRelative(el.getAttribute('datetime'), now);
    if (!relative) continue;
    el.textContent = datePrefix(el.textContent || '') + relative;
  }
}
