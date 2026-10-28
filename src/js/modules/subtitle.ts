import type { TypedOptions } from 'typed.js';
import type { ThemeConfig } from '../types.ts';
export type SubtitleOptions = Omit<TypedOptions, 'contentType'> & {contentType: 'html' | null};
// Local author-configured subtitle content.
export function customSubtitles(value: unknown) {
  if (typeof value !== 'string') return [];
  const lines = value.replace(/[\r\n]/g, '').split('|&|');
  return lines.some(line => line.trim()) ? lines : [];
}

// JSON configuration deliberately cannot replace strings, HTML mode, DOM targets or callbacks.
export function subtitleTypedOptions(value: unknown): Pick<TypedOptions, 'typeSpeed' | 'startDelay' | 'backSpeed' | 'backDelay' | 'fadeOutDelay' | 'smartBackspace' | 'shuffle' | 'fadeOut' | 'loop' | 'showCursor' | 'autoInsertCss' | 'bindInputFocusEvents' | 'loopCount' | 'cursorChar' | 'fadeOutClass'> {
  let source = value;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); } catch { return {}; }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const record = source as Record<string, unknown>;
  const options: TypedOptions = {};
  const delays = ['typeSpeed', 'startDelay', 'backSpeed', 'backDelay', 'fadeOutDelay'] as const;
  const switches = ['smartBackspace', 'shuffle', 'fadeOut', 'loop', 'showCursor', 'autoInsertCss', 'bindInputFocusEvents'] as const;
  for (const key of delays) {
    if (Object.hasOwn(source, key) && typeof record[key] === 'number' && Number.isFinite(record[key]) && record[key] >= 0 && record[key] <= 2147483647) options[key] = record[key];
  }
  for (const key of switches) {
    if (Object.hasOwn(source, key) && typeof record[key] === 'boolean') options[key] = record[key];
  }
  if (Object.hasOwn(source, 'loopCount')) {
    if (record.loopCount === 'Infinity') options.loopCount = Infinity;
    else if (typeof record.loopCount === 'number' && Number.isSafeInteger(record.loopCount) && record.loopCount >= 0) options.loopCount = record.loopCount;
  }
  if (Object.hasOwn(source, 'cursorChar') && typeof record.cursorChar === 'string') options.cursorChar = escapeMarkup(record.cursorChar);
  if (Object.hasOwn(source, 'fadeOutClass') && typeof record.fadeOutClass === 'string' && /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(record.fadeOutClass)) options.fadeOutClass = record.fadeOutClass;
  return options;
}

const escapeMarkup = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function runSubtitle<T>({ element, config = {}, createTyped, isActive = () => true }: {
  element: Element | null; config?: ThemeConfig;
  isActive?: () => boolean;
  createTyped: (element: Element, options: SubtitleOptions) => T;
}) {
  if (!element || config.enable_above === false || config.enable_subtitle === false) return;

  const strings = customSubtitles(config.typewriter_custom_text);
  const staticText = strings[0] ?? config.site_subtitle ?? '';
  element.textContent = staticText;

  if (!isActive()) return;
  if (!staticText && strings.length === 0) {
    element.parentElement?.setAttribute('hidden', '');
    return;
  }
  element.parentElement?.removeAttribute('hidden');
  if (config.subtitle_effect === false || strings.length === 0 || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    element.textContent = staticText;
    return;
  }
  return createTyped(element, {
    strings,
    contentType: 'html',
    startDelay: 300,
    typeSpeed: 200,
    loop: true,
    backSpeed: 50,
    ...subtitleTypedOptions(config.subtitle_typed_option),
  });
}
