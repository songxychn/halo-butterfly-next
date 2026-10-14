import { t } from './i18n';
/**
 * 相对时间：读 time[datetime] 的绝对时间，替换可见文本。
 * 对齐 Butterfly 5.7.0 post_meta.*.date_format=relative，不引入 moment。
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelative(input: string | number | Date | null, now = Date.now()) {
  const date = input instanceof Date ? input : new Date(input ?? NaN);
  if (Number.isNaN(date.getTime())) return '';
  const diff = now - date.getTime();
  if (diff < MINUTE) return t('ui.now');
  if (diff < HOUR) return t('ui.minutesAgo', Math.floor(diff / MINUTE));
  if (diff < DAY) return t('ui.hoursAgo', Math.floor(diff / HOUR));
  return t('ui.daysAgo', Math.floor(diff / DAY));
}

function datePrefix(text: string) {
  if (text.startsWith(t('ui.publishedAlt'))) return t('ui.publishedAlt');
  if (text.startsWith(t('ui.published'))) return t('ui.published');
  if (text.startsWith(t('ui.updated'))) return t('ui.updated');
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
