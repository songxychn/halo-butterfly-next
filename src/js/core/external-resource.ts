/** Optional resources never participate in the theme's content-ready gate. */
export const enabled = (value: unknown) => value === true || value === 'true';
export const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function safeResourceUrl(value: unknown, base = globalThis.location?.href || 'https://example.invalid/') {
  const raw = text(value);
  if (!raw || /[\s\\<>"'`]/.test(raw) || (!/^https?:\/\//.test(raw) && !/^\/(?!\/)/.test(raw))) return '';
  try {
    const url = new URL(raw, base);
    if (url.username || url.password || !['https:', 'http:'].includes(url.protocol)) return '';
    if (url.protocol === 'http:' && url.origin !== new URL(base).origin) return '';
    return url.href;
  } catch { return ''; }
}

export interface ResourceConfig {
  version?: unknown;
  asset_base?: unknown;
  option?: Record<string, unknown>;
}

/** Browser-side counterpart of scripts/resource-templates.mjs (Prism + service URLs). */
export function resolveResource(key: string, local: string, config?: ResourceConfig, version = '', file = '') {
  const expand = (value: unknown) => text(value).replaceAll('${version}', version).replaceAll('${file}', file).replaceAll('${name}', 'halo-butterfly-next');
  const expanded = expand(config?.option?.[key]);
  const override = expanded.includes('${') ? '' : safeResourceUrl(expanded);
  if (override) return override;
  if (file) {
    const base = text(config?.asset_base).replaceAll('${version}', version).replaceAll('${name}', 'halo-butterfly-next');
    if (base && !/[?#]/.test(base) && !base.includes('${')) {
      const url = safeResourceUrl(base.replace(/\/+$/, '') + '/' + file);
      if (url) return url;
    }
  }
  return safeResourceUrl(local) ? local : '';
}

/** Only exact configured theme files are trusted during partial navigation. */
export function isThemeScriptSource(source: string, file: string, key: string, localRoot: string, config?: ResourceConfig, version = '', base = globalThis.location?.href || 'https://example.invalid/') {
  if (!['main', 'masonry', 'loading', 'charts'].includes(key) ||
      !/^(?:js\/[a-z0-9_-]+\.min\.js|plugins\/loading\/[a-z0-9_-]+\.min\.js)$/.test(file)) return false;
  if (key === 'charts' && file !== 'js/charts.min.js') return false;
  if (key === 'loading' ? !file.startsWith('plugins/loading/') : !file.startsWith('js/')) return false;
  const local = localRoot + file + (config?.version === false || config?.version === 'false' ? '' : '?v=' + version);
  const selected = resolveResource(key, local, config, version, file);
  try {
    const canonical = (value: string) => new URL(value, base).href;
    return canonical(source) === canonical(local) || Boolean(selected) && canonical(source) === canonical(selected);
  } catch { return false; }
}

const managed = new WeakMap<Document, Map<string, Promise<boolean>>>();
/** A timeout can leave executable bytes in flight: only a native error retries locally. */
export function loadManagedResource(source: string, local: string, {document = globalThis.document, kind = 'script', attributes = {}, timeout = 8000, valid, allowRetryAfterError = false}: {
  document?: Document; kind?: 'script' | 'style'; attributes?: Record<string, string>; timeout?: number; valid?: () => boolean; allowRetryAfterError?: boolean;
} = {}) {
  const selected = safeResourceUrl(source, document.baseURI), fallback = safeResourceUrl(local, document.baseURI);
  if (!selected) return Promise.resolve(false);
  let cache = managed.get(document);
  if (!cache) { cache = new Map(); managed.set(document, cache); }
  const key = kind + ':' + selected + ':' + fallback;
  const previous = cache.get(key);
  if (previous) return previous;
  let settle!: (success: boolean) => void;
  const result = new Promise<boolean>(resolve => { settle = resolve; });
  cache.set(key, result);
  const request = (url: string, retry: boolean) => {
    const node = document.createElement(kind === 'style' ? 'link' : 'script');
    if (kind === 'style') (node as HTMLLinkElement).rel = 'stylesheet';
    else (node as HTMLScriptElement).async = true;
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    let done = false;
    const finish = (success: boolean, canRetry = false) => {
      if (done) return;
      done = true; clearTimeout(timer); node.onload = node.onerror = null;
      if (!success) node.remove();
      if (!success && retry && canRetry) request(fallback, false);
      else {
        // Only definitive failures can be retried later; timeout bytes may execute late.
        if (!success && canRetry && allowRetryAfterError) cache!.delete(key);
        settle(success);
      }
    };
    const timer = setTimeout(() => finish(false), timeout);
    node.onload = () => { try { finish(!valid || valid(), true); } catch { finish(false, true); } };
    node.onerror = () => finish(false, true);
    if (kind === 'style') (node as HTMLLinkElement).href = url;
    else (node as HTMLScriptElement).src = url;
    document.head.append(node);
  };
  request(selected, Boolean(fallback) && fallback !== selected);
  return result;
}

const requests = new WeakMap<Document, Map<string, Promise<boolean>>>();
export function loadExternalScript(source: string, {document = globalThis.document, attributes = {}, timeout = 8000}: {
  document?: Document; attributes?: Record<string, string>; timeout?: number;
} = {}) {
  const url = safeResourceUrl(source, document.baseURI);
  if (!url) return Promise.resolve(false);
  let cache = requests.get(document);
  if (!cache) { cache = new Map(); requests.set(document, cache); }
  if (cache.has(url)) return cache.get(url)!;
  // Cache before appending, so repeated initializers share the native load outcome.
  let settle!: (success: boolean) => void;
  const promise = new Promise<boolean>(resolve => { settle = resolve; });
  cache.set(url, promise);
  const script = document.createElement('script');
  script.async = true;
  for (const [name, value] of Object.entries(attributes)) {
    if (/^data-[a-z0-9-]+$/.test(name) || name === 'crossorigin') script.setAttribute(name, value);
  }
  let done = false;
  const finish = (success: boolean) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    script.onload = script.onerror = null;
    if (!success) script.remove();
    settle(success);
  };
  const timer = setTimeout(() => finish(false), timeout);
  script.onload = () => finish(true);
  script.onerror = () => finish(false);
  script.src = url;
  document.head.append(script);
  return promise;
}
