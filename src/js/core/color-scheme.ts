/** One policy for the inline first paint and every page initializer. */
export const DARKMODE_START_DEFAULT = 18;
export const DARKMODE_END_DEFAULT = 6;
export function resolveMode(value: unknown) {
  return value === 'light' || value === 'dark' || value === 'schedule' ? value : 'system';
}
export function resolveHourBound(value: unknown, fallback: number) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback;
}
export function nightWindow(start: unknown, end: unknown): [number, number] {
  const valid = (v: unknown) => v !== null && v !== undefined && v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 23;
  if (!valid(start) || !valid(end) || Number(start) === Number(end)) return [18, 6];
  return [Number(start), Number(end)];
}
export function isNightHour(hour: number, start: number, end: number) {
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}
export interface ColorPolicy { styleMode?: unknown; start?: unknown; end?: unknown; saved?: unknown; prefersDark?: boolean; hour?: number }
export function resolveInitialColorScheme({styleMode, start, end, saved, prefersDark, hour = new Date().getHours()}: ColorPolicy = {}) {
  const mode = resolveMode(styleMode);
  if (mode === 'light' || mode === 'dark') return mode;
  if (saved === 'light' || saved === 'dark') return saved;
  if (mode === 'schedule') {
    const [a, b] = nightWindow(start, end);
    return isNightHour(hour, a, b) ? 'dark' : 'light';
  }
  return prefersDark === true ? 'dark' : 'light';
}
export function shouldListenPrefersColorScheme({styleMode}: ColorPolicy = {}) { return resolveMode(styleMode) === 'system'; }
/** Recompute at the next boundary in local wall time (also on focus/visibility). */
export function nextColorBoundary(now: Date, start: unknown, end: unknown) {
  const hours = nightWindow(start, end);
  return Math.min(...hours.map(hour => {
    const next = new Date(now); next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  }));
}
