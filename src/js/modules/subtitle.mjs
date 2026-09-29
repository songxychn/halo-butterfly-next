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

// JSON configuration deliberately cannot replace strings, HTML mode, DOM targets or callbacks.
export function subtitleTypedOptions(value) {
  let source = value;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); } catch { return {}; }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const options = {};
  const delays = ['typeSpeed', 'startDelay', 'backSpeed', 'backDelay', 'fadeOutDelay'];
  const switches = ['smartBackspace', 'shuffle', 'fadeOut', 'loop', 'showCursor', 'autoInsertCss', 'bindInputFocusEvents'];
  for (const key of delays) {
    if (Object.hasOwn(source, key) && typeof source[key] === 'number' && Number.isFinite(source[key]) && source[key] >= 0 && source[key] <= 2147483647) options[key] = source[key];
  }
  for (const key of switches) {
    if (Object.hasOwn(source, key) && typeof source[key] === 'boolean') options[key] = source[key];
  }
  if (Object.hasOwn(source, 'loopCount')) {
    if (source.loopCount === 'Infinity') options.loopCount = Infinity;
    else if (Number.isSafeInteger(source.loopCount) && source.loopCount >= 0) options.loopCount = source.loopCount;
  }
  if (Object.hasOwn(source, 'cursorChar') && typeof source.cursorChar === 'string') options.cursorChar = escapeMarkup(source.cursorChar);
  if (Object.hasOwn(source, 'fadeOutClass') && typeof source.fadeOutClass === 'string' && /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(source.fadeOutClass)) options.fadeOutClass = source.fadeOutClass;
  return options;
}

export function subtitleSource(config) {
  const source = config.subtitle_source;
  if (source === undefined || source === null || source === '' || source === 'custom') {
    const url = typeof config.typewriter_random_api === 'string' ? config.typewriter_random_api.trim() : '';
    return config.enable_typewriter_random_text === true && url ? { kind: 'custom', url, path: config.typewriter_api_value_format } : null;
  }
  switch (String(source)) {
    case '1': return { kind: 'hitokoto', url: 'https://v1.hitokoto.cn' };
    case '2': return { kind: 'yiyan', url: 'https://v.api.aa1.cn/api/yiyan/index.php' };
    // The official SDK reads this JSON endpoint; do not execute a third-party script.
    case '3': return { kind: 'jinrishici', url: 'https://v2.jinrishici.com/one.json?client=browser-sdk/1.2', withCredentials: true };
    default: return null;
  }
}

export function providerSubtitles(response, source) {
  if (source.kind === 'custom') {
    const text = randomSubtitle(response, source.path);
    return text === null ? [] : [text];
  }
  if (source.kind === 'yiyan') {
    const match = typeof response.body === 'string' && /<p>(.*?)<\/p>/g.exec(response.body);
    return match && match[1].trim() ? [match[1]] : [];
  }
  const json = { ...response, contentType: 'application/json' };
  const text = randomSubtitle(json, source.kind === 'hitokoto' ? 'hitokoto' : 'data.content');
  if (text === null) return [];
  const from = source.kind === 'hitokoto' && randomSubtitle(json, 'from');
  return from ? [text, `出自 ${from}`] : [text];
}

const escapeMarkup = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function runSubtitle({ element, config = {}, createTyped, requestRandom }) {
  if (!element || config.enable_above === false || config.enable_subtitle === false) return;

  let strings = customSubtitles(config.typewriter_custom_text);
  let contentType = 'html'; // Preserve author-configured markup in the existing dynamic mode.
  const source = subtitleSource(config);
  let staticText = strings[0] ?? '';
  if (source) {
    try {
      const remote = providerSubtitles(await requestRandom(source.url, source), source);
      if (remote.length) {
        staticText = remote[0];
        if (source.kind === 'custom' || !strings.length) {
          strings = remote;
          contentType = null;
        } else {
          // Built-in providers prepend their text to author HTML, matching upstream order.
          // Escape external markup before mixing with the trusted local HTML strings.
          strings = [...remote.map(escapeMarkup), ...strings];
        }
      }
    } catch {
      // Unavailable services use the same local content as the no-source case.
    }
  }

  if (config.subtitle_effect === false || strings.length === 0) {
    element.textContent = staticText;
    return;
  }
  return createTyped(element, {
    strings,
    contentType,
    startDelay: 300,
    typeSpeed: 200,
    loop: true,
    backSpeed: 50,
    ...subtitleTypedOptions(config.subtitle_typed_option),
  });
}
