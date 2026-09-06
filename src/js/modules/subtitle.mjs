// Missing switches preserve the visible subtitle of existing Halo configurations.
export function customSubtitles(value) {
  if (typeof value !== 'string') return [];
  const lines = value.replace(/[\r\n]/g, '').split('|&|');
  return lines.some(line => line.trim()) ? lines : [];
}

export function randomSubtitle({ body, contentType = '' }, valuePath) {
  if (typeof body !== 'string') return null;
  const path = typeof valuePath === 'string' ? valuePath.trim() : '';
  let value = body;
  if (path || /\bjson\b/i.test(contentType)) {
    try { value = JSON.parse(body); } catch { return null; }
    if (path) {
      for (const key of path.split('.')) {
        if (!key || ['__proto__', 'prototype', 'constructor'].includes(key) ||
          value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return null;
        value = value[key];
      }
    }
  }
  return typeof value === 'string' && value.trim() ? value : null;
}

export async function runSubtitle({ element, config = {}, createTyped, requestRandom }) {
  if (!element || config.enable_above === false || config.enable_subtitle === false) return;

  let strings = customSubtitles(config.typewriter_custom_text);
  const api = typeof config.typewriter_random_api === 'string' ? config.typewriter_random_api.trim() : '';
  if (config.enable_typewriter_random_text === true && api) {
    try {
      const text = randomSubtitle(await requestRandom(api), config.typewriter_api_value_format);
      if (text !== null) strings = [text];
    } catch {
      // Unavailable services use the same local content as the no-source case.
    }
  }

  if (config.subtitle_effect === false || strings.length === 0) {
    element.textContent = strings[0] ?? '';
    return;
  }
  return createTyped(element, {
    strings,
    contentType: null,
    startDelay: 300,
    typeSpeed: 200,
    loop: true,
    backSpeed: 50,
  });
}
