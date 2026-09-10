/**
 * 文章过期提醒。对齐 Butterfly 5.7.0
 * layout/includes/post/outdate-notice.pug + source/js/main.js addPostOutdateNotice
 * + source/js/utils.js btf.diffDate（f223b1888b42b2b336068e6c959ed90a3cd7c8f3）。
 *
 * _config.yml 默认：enable false、style flat、limit_day 365、position top、
 * message_prev "It has been"、message_next 为英文过期说明。
 * 天数 Math.floor((now - updated) / 86400000)，updated 取文章更新时间，无则发布时间。
 * 可见文本 `${messagePrev} ${diffDay} ${messageNext}`，模板用 th:text。
 * 不做 related_post、wordcount、逐页 page.noticeOutdate 覆盖。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULTS = {
  enable: false,
  style: 'flat',
  limit_day: 365,
  position: 'top',
  message_prev: 'It has been',
  message_next: 'days since the last update, the content of the article may be outdated.',
};

export { DEFAULTS, DAY_MS };

export function resolveEnable(value) {
  return value === true || value === 'true';
}

export function resolveStyle(value) {
  return value === 'simple' ? 'simple' : 'flat';
}

export function resolvePosition(value) {
  return value === 'bottom' ? 'bottom' : 'top';
}

export function resolveLimitDay(value) {
  if (value === null || value === undefined || value === '') return DEFAULTS.limit_day;
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULTS.limit_day;
  return n;
}

export function resolveMessagePrev(value) {
  return value == null ? DEFAULTS.message_prev : String(value);
}

export function resolveMessageNext(value) {
  return value == null ? DEFAULTS.message_next : String(value);
}

/** 对齐 btf.diffDate(inputDate)（more=false）：Math.floor(diffMs / 86400000)。 */
export function daysSince(input, now = Date.now()) {
  if (input == null || input === '') return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now - date.getTime()) / DAY_MS);
}

/** Halo：status.lastModifyTime，无则 spec.publishTime。 */
export function resolveUpdatedAt(lastModifyTime, publishTime) {
  return lastModifyTime ?? publishTime ?? null;
}

export function shouldShow({ enable, days, limitDay }) {
  if (!resolveEnable(enable)) return false;
  if (days == null || !Number.isFinite(days)) return false;
  return days >= resolveLimitDay(limitDay);
}

export function formatNoticeText(messagePrev, days, messageNext) {
  return `${resolveMessagePrev(messagePrev)} ${days} ${resolveMessageNext(messageNext)}`;
}

export function noticeClassName(style) {
  return resolveStyle(style);
}
