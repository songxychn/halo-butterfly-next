import {enabled, text, safeResourceUrl, loadExternalScript, resolveResource, type ResourceConfig} from './external-resource.ts';
import {initializeChat, type ChatConfig, type IntegrationWindow} from './integration-chat.ts';

export interface AnalyticsConfig {
  baidu_analytics?: unknown; google_analytics?: unknown; cloudflare_analytics?: unknown;
  microsoft_clarity?: unknown;
  google_tag_manager?: {tag_id?: unknown; domain?: unknown};
  umami_analytics?: {enable?: unknown; serverURL?: unknown; script_name?: unknown; website_id?: unknown;
    option?: unknown; UV_PV?: {site_uv?: unknown; site_pv?: unknown; page_pv?: unknown; stats_url?: unknown}};
}
export interface IntegrationConfig {
  analytics?: AnalyticsConfig; chat?: ChatConfig;
  adsense?: {enable?: unknown; js?: unknown; client?: unknown; auto_ads?: unknown; enable_page_level_ads?: unknown};
}
export type ScriptLoader = (url: string, options?: {attributes?: Record<string, string>}) => Promise<boolean>;
export interface AnalyticsWindow extends IntegrationWindow {
  _hmt?: unknown[][]; dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void;
  clarity?: ((...args: unknown[]) => void) & {q?: unknown[][]};
  adsbygoogle?: unknown[];
  umami?: {track: (properties: (props: Record<string, unknown>) => Record<string, unknown>) => unknown};
}

const identifier = (value: unknown, pattern: RegExp) => pattern.test(text(value)) ? text(value) : '';
export function buildAnalyticsPlan(config: AnalyticsConfig = {}) {
  const plans: {key: string; url: string; attributes?: Record<string, string>}[] = [];
  const baidu = identifier(config.baidu_analytics, /^[a-f\d]{32}$/i);
  if (baidu) plans.push({key: 'baidu_analytics', url: `https://hm.baidu.com/hm.js?${baidu}`});
  const ga = identifier(config.google_analytics, /^G-[A-Z\d]+$/);
  if (ga) plans.push({key: 'google_analytics', url: `https://www.googletagmanager.com/gtag/js?id=${ga}`});
  const cf = identifier(config.cloudflare_analytics, /^[a-z\d-]+$/i);
  if (cf) plans.push({key: 'cloudflare_analytics', url: 'https://static.cloudflareinsights.com/beacon.min.js', attributes: {'data-cf-beacon': JSON.stringify({token: cf})}});
  const clarity = identifier(config.microsoft_clarity, /^[a-z\d]+$/i);
  if (clarity) plans.push({key: 'microsoft_clarity', url: `https://www.clarity.ms/tag/${clarity}`});
  const gtm = identifier(config.google_tag_manager?.tag_id, /^GTM-[A-Z\d]+$/);
  const domain = text(config.google_tag_manager?.domain) || 'https://www.googletagmanager.com';
  if (gtm && safeResourceUrl(domain)) plans.push({key: 'google_tag_manager', url: `${domain.replace(/\/$/, '')}/gtm.js?id=${gtm}`});
  const umami = config.umami_analytics;
  const site = identifier(umami?.website_id, /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i);
  const server = text(umami?.serverURL) || 'https://cloud.umami.is';
  const script = text(umami?.script_name) || 'script.js';
  if (enabled(umami?.enable) && site && /^[a-z\d_./-]+\.js$/i.test(script) && !script.split('/').includes('..') && safeResourceUrl(server)) {
    const attributes: Record<string, string> = {};
    let options: unknown = umami?.option;
    if (typeof options === 'string') { try {options = JSON.parse(options);} catch {options = null;} }
    if (options && typeof options === 'object' && !Array.isArray(options)) {
      for (const [key, value] of Object.entries(options)) {
        if (['data-host-url', 'data-domains', 'data-tag', 'data-do-not-track', 'data-exclude-search', 'data-exclude-hash'].includes(key) && ['string','boolean'].includes(typeof value)) {
          if (key !== 'data-host-url' || safeResourceUrl(value)) attributes[key] = String(value);
        }
      }
    }
    attributes['data-website-id'] = site;
    attributes['data-auto-track'] = 'false';
    plans.push({key: 'umami_analytics', url: `${server.replace(/\/$/, '')}/${script.replace(/^\//, '')}`, attributes});
  }
  return plans;
}

export function initializeAnalytics(config: AnalyticsConfig, win: AnalyticsWindow, load: ScriptLoader) {
  const plans = buildAnalyticsPlan(config);
  const tasks = plans.map(async plan => {
    if (plan.key === 'baidu_analytics') win._hmt ??= [];
    if (plan.key === 'google_analytics' || plan.key === 'google_tag_manager') win.dataLayer ??= [];
    if (plan.key === 'google_analytics') {
      win.gtag ??= function (..._args: unknown[]) {win.dataLayer!.push(arguments);};
      win.gtag('js', new Date()); win.gtag('config', text(config.google_analytics));
    }
    if (plan.key === 'google_tag_manager') win.dataLayer!.push({'gtm.start': Date.now(), event: 'gtm.js'});
    if (plan.key === 'microsoft_clarity') {
      win.clarity ??= Object.assign((...args: unknown[]) => {win.clarity!.q!.push(args);}, {q: [] as unknown[][]});
    }
    const loaded = await load(plan.url, {attributes: plan.attributes});
    if (loaded && plan.key === 'umami_analytics' && typeof win.umami?.track === 'function') {
      // Native Umami handles DNT/domains/disabled local storage; no API credential is required.
      win.umami.track(props => ({...props, url: win.location.pathname + win.location.search, title: win.document.title}));
    }
    return {key: plan.key, loaded};
  });
  return Promise.all(tasks);
}

/** Credentials remain on a site-owned backend. Public response: {site_uv,site_pv,page_pv}. */
export async function updatePublicStats(config: AnalyticsConfig['umami_analytics'], root = document, fetcher = fetch) {
  const stats = config?.UV_PV;
  if (!enabled(config?.enable) || !stats) return false;
  const nodes = (['site_uv','site_pv','page_pv'] as const).flatMap(key => enabled(stats[key])
    ? Array.from(root.querySelectorAll<HTMLElement>(`[data-umami-stat="${key}"]`)).map(node => ({key, node})) : []);
  if (!nodes.length) return false;
  const source = safeResourceUrl(stats.stats_url, root.baseURI);
  if (!source) return false;
  const url = new URL(source);
  if (nodes.some(({key}) => key === 'page_pv')) url.searchParams.set('path', new URL(root.baseURI).pathname);
  try {
    const response = await fetcher(url.href, {credentials: 'omit', signal: AbortSignal.timeout(5000), headers: {Accept: 'application/json'}});
    if (!response.ok) return false;
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    let updated = false;
    for (const {key, node} of nodes) {
      const value = (data as Record<string, unknown>)[key];
      if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {node.textContent = String(value); updated = true;}
    }
    return updated;
  } catch { return false; }
}

export async function initializeAdsense(config: IntegrationConfig['adsense'], win: AnalyticsWindow, root: Document, load: ScriptLoader) {
  if (!enabled(config?.enable)) return false;
  const client = identifier(config?.client, /^ca-pub-\d{16}$/);
  const raw = text(config?.js) || 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
  const source = safeResourceUrl(raw, root.baseURI);
  if (!client || !source) return false;
  const url = new URL(source); url.searchParams.set('client', client);
  win.adsbygoogle ??= [];
  const loaded = await load(url.href, {attributes: {crossorigin: 'anonymous'}});
  if (!loaded) return false;
  if (enabled(config.auto_ads)) win.adsbygoogle.push({google_ad_client: client, enable_page_level_ads: enabled(config.enable_page_level_ads)});
  for (const ad of root.querySelectorAll<HTMLElement>('.theme-ad ins.adsbygoogle')) {
    if (ad.dataset.adsbygoogleStatus || ad.dataset.themeAdQueued) continue;
    ad.dataset.themeAdQueued = 'true';
    win.adsbygoogle.push({});
  }
  return true;
}

const documents = new WeakMap<Document, Promise<unknown>>();
export function initializeIntegrations({config = window.MainApp?.integrations, resources = window.MainApp?.resources,
  root = document, win = window as AnalyticsWindow, load = (url, options) => loadExternalScript(url, {...options, document: root})}: {
  config?: IntegrationConfig; resources?: ResourceConfig; root?: Document; win?: AnalyticsWindow; load?: ScriptLoader;
} = {}) {
  if (documents.has(root)) return documents.get(root)!;
  const ready = new Promise<void>(resolve => {
    if (root.readyState === 'loading') root.addEventListener('DOMContentLoaded', () => resolve(), {once: true}); else resolve();
  }).then(async () => {
    const analytics = config?.analytics || {};
    const byUrl = new Map(buildAnalyticsPlan(analytics).map(plan => [plan.url, plan.key]));
    const resourceLoad: ScriptLoader = (url, options) => load(resolveResource(byUrl.get(url) || '', url, resources), options);
    return Promise.allSettled([
      initializeAnalytics(analytics, win, resourceLoad), updatePublicStats(analytics.umami_analytics, root),
      initializeChat(config?.chat || {}, win, root, (url, options) => load(resolveResource(`chat_${text(config?.chat?.use)}`, url, resources), options)),
      initializeAdsense(config?.adsense, win, root, (url, options) => load(resolveResource('google_adsense', url, resources), options)),
    ]);
  });
  documents.set(root, ready);
  return ready;
}
