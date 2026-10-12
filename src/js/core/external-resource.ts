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
  internal_provider?: unknown;
  third_party_provider?: unknown;
  version?: unknown;
  custom_format?: unknown;
  option?: Record<string, unknown>;
}

/** Browser-side counterpart of scripts/resource-templates.mjs (Prism + service URLs). */
export function resolveResource(key: string, local: string, config?: ResourceConfig, version = '', file = '') {
  const expand = (value: unknown) => text(value).replaceAll('${version}', version).replaceAll('${file}', file).replaceAll('${name}', 'halo-butterfly-next');
  const expanded = expand(config?.option?.[key]);
  const override = expanded.includes('${') ? '' : safeResourceUrl(expanded);
  if (override) return override;
  if (config?.internal_provider === 'custom' && file) {
    const custom = expand(config.custom_format);
    const url = safeResourceUrl(custom);
    if (url && !custom.includes('${')) return url;
  }
  return safeResourceUrl(local) ? local : '';
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
