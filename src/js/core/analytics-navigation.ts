import {enabled, text, type ResourceConfig} from './external-resource.ts';
import type {IntegrationConfig, AnalyticsWindow, ScriptLoader} from './integrations.ts';

const stateKey = Symbol.for('halo-butterfly-next.manual-analytics');
interface State {id: string; ready: boolean; promise: Promise<boolean>; previous: string}
declare global {interface Window {[stateKey]?: State}}
/** Opt-in means the owner has disabled GA4 enhanced history page views. */
export function manualAnalyticsId(config: IntegrationConfig = {}, resources?: ResourceConfig) {
  const analytics = config.analytics || {}, id = text(analytics.google_analytics);
  if (!enabled(analytics.google_analytics_manual_pageviews) || !/^G-[A-Z\d]+$/.test(id) ||
      text(analytics.baidu_analytics) || text(analytics.cloudflare_analytics) || text(analytics.microsoft_clarity) ||
      text(analytics.google_tag_manager?.tag_id) || enabled(analytics.umami_analytics?.enable) ||
      ['chatra', 'tidio', 'crisp', 'knocket'].includes(text(config.chat?.use)) || enabled(config.adsense?.enable) ||
      text(resources?.option?.google_analytics)) return '';
  return id;
}
export function supportsAnalyticsNavigation(root: Document, win: Window | undefined = globalThis.window) {
  const marker = root.querySelector<HTMLScriptElement>('script[data-theme-script="analytics"]');
  const state = win?.[stateKey];
  if (!marker) return !state;
  return Boolean(state?.ready && marker.dataset.analyticsId === state.id && !marker.dataset.analyticsSource);
}
/** Call only after a successful page commit, never on pushState/popstate itself. */
export function trackCommittedAnalytics(root: Document = document, win: AnalyticsWindow = window) {
  const state = win[stateKey];
  if (!state?.ready || !supportsAnalyticsNavigation(root, win)) return;
  const url = new URL(win.location.href); url.hash = '';
  win.gtag?.('event', 'page_view', {send_to: state.id, page_location: url.href,
    page_title: root.title, page_referrer: state.previous});
  state.previous = url.href;
}
export function initializeManualAnalytics(id: string, root: Document, win: AnalyticsWindow, load: ScriptLoader) {
  if (win[stateKey]) return win[stateKey]!.promise;
  let settle!: (success: boolean) => void;
  const promise = new Promise<boolean>(resolve => {settle = resolve;});
  const state: State = {id, ready: false, promise, previous: root.referrer};
  win[stateKey] = state;
  win.dataLayer ??= [];
  win.gtag ??= function (..._args: unknown[]) {win.dataLayer!.push(arguments);};
  win.gtag('js', new Date()); win.gtag('config', id, {send_page_view: false});
  void load('https://www.googletagmanager.com/gtag/js?id=' + id,
    {attributes: {'data-theme-script': 'analytics-sdk'}}).then(loaded => {
    state.ready = loaded;
    if (loaded) {
      trackCommittedAnalytics(root, win);
      root.addEventListener('pjax:complete', () => trackCommittedAnalytics(root, win));
      root.dispatchEvent(new Event('halo-butterfly-next:analytics-ready'));
    }
    settle(loaded);
  }, () => settle(false));
  return promise;
}
