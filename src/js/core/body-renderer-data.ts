import { t } from './i18n';
export type RendererKind = 'mermaid' | 'chartjs' | 'abcjs';
export interface BodyRendererConfig {
  mermaid?: { enable?: unknown; code_write?: unknown; theme?: { light?: string; dark?: string }; open_in_new_tab?: unknown; zoom_pan?: unknown };
  chartjs?: { enable?: unknown; fontColor?: { light?: string; dark?: string }; borderColor?: { light?: string; dark?: string }; scale_ticks_backdropColor?: { light?: string; dark?: string } };
  abcjs?: { enable?: unknown; per_page?: unknown };
}
export interface RenderRequest {
  source: string; params: Record<string, unknown>; mode: 'light' | 'dark';
  theme: string; colors: { font: string; border: string; backdrop: string };
  hiddenDatasets: Set<number>;
}
export interface BodyRenderer { render(output: HTMLElement, request: RenderRequest): Promise<() => void> }
declare global { interface Window { ThemeBodyRenderers?: Partial<Record<RendererKind, BodyRenderer>> } }

/** No executable configuration, inherited keys, or unbounded recursive input. */
export function parseRendererJson(source: string): Record<string, unknown> {
  if (source.length > 100_000) throw new Error(t('ui.errorConfigSize'));
  let count = 0;
  const inspect = (value: unknown, depth = 0): void => {
    if (++count > 20_000 || depth > 64) throw new Error(t('ui.errorConfigDepth'));
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error(t('ui.errorConfigKey'));
      inspect(child, depth + 1);
    }
  };
  const value: unknown = JSON.parse(source);
  inspect(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(t('ui.errorConfigObject'));
  return value as Record<string, unknown>;
}
export function resolveChartTheme(value: unknown, mode: 'light' | 'dark'): unknown {
  if (Array.isArray(value)) return value.map(item => resolveChartTheme(item, mode));
  if (!value || typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  const key = mode + '-mode';
  if (Object.hasOwn(obj, key)) return resolveChartTheme(obj[key], mode);
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, resolveChartTheme(v, mode)]));
}
export function mermaidTheme(value: unknown, mode: 'light' | 'dark') {
  return typeof value === 'string' && ['default', 'forest', 'dark', 'neutral', 'base'].includes(value) ? value : mode === 'dark' ? 'dark' : 'default';
}
