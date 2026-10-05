export const CACHE_PREFIX = 'halo-butterfly-pwa-offline-';
export const CACHE_NAME = CACHE_PREFIX + '__PWA_REVISION__';
export const BASE = '/butterfly-pwa/';

export function publicNavigation(request: Pick<Request, 'url' | 'method' | 'mode'>, origin: string): boolean {
  const url = new URL(request.url);
  // Keep downloads, query-based actions, private routes and ambiguous encoded paths native.
  return request.method === 'GET' && request.mode === 'navigate' && url.origin === origin &&
    !url.search && !url.pathname.includes('%') &&
    !/^\/(?:console|uc|login|logout|signup|register|oauth2|actuator|apis|api|system|upload|attachments|butterfly-pwa)(?:\/|$)/i.test(url.pathname) &&
    !/\.[a-z0-9]{1,8}$/i.test(url.pathname);
}

export function installWorker(worker: ServiceWorkerGlobalScope) {
  const offlineUrl = new URL(BASE + 'offline.html', worker.location.origin).href;
  let retired = false;
  const clear = async (keepCurrent = false) => {
    for (const key of await worker.caches.keys()) {
      if (key.startsWith(CACHE_PREFIX) && (!keepCurrent || key !== CACHE_NAME)) await worker.caches.delete(key);
    }
  };
  const retire = async () => {
    retired = true;
    await clear();
    await worker.registration.unregister();
  };
  const checkEnabled = async () => {
    try {
      const response = await worker.fetch(BASE + 'status', { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(4000) });
      if (response.status === 404 || response.status === 410) { await retire(); return false; }
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const config = await response.json();
        if (config.owner === 'butterfly-pwa' && config.enabled === false) { await retire(); return false; }
        return config.owner === 'butterfly-pwa' && config.enabled === true;
      }
    } catch { /* Offline or transient server failure cannot revoke a previous registration. */ }
    return null;
  };
  const prepareOffline = async () => {
    const response = await worker.fetch(offlineUrl, { cache: 'reload', redirect: 'error' });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Offline page unavailable');
    await (await worker.caches.open(CACHE_NAME)).put(offlineUrl, response);
  };
  worker.addEventListener('install', event => {
    event.waitUntil((async () => {
      if (await checkEnabled() !== true) throw new Error('PWA must be enabled before installation');
      await prepareOffline();
      await worker.skipWaiting();
    })());
  });
  worker.addEventListener('activate', event => {
    event.waitUntil((async () => { await clear(true); await worker.clients.claim(); })());
  });
  worker.addEventListener('message', event => {
    const client = event.source as Client | null;
    if (event.data?.type !== 'butterfly-pwa:resume' || !client || new URL(client.url).origin !== worker.location.origin) return;
    event.waitUntil((async () => {
      // Browsers can resurrect an unregistered identical worker while another tab still uses it.
      if (await checkEnabled() !== true) return;
      if (!(await (await worker.caches.open(CACHE_NAME)).match(offlineUrl))) await prepareOffline();
      retired = false;
      await worker.clients.claim();
    })());
  });
  worker.addEventListener('fetch', event => {
    if (retired || !publicNavigation(event.request, worker.location.origin)) return;
    // Fetching status also retires this worker after plugin disable/uninstall, even on another theme.
    event.waitUntil(checkEnabled().then(() => {}));
    event.respondWith((async () => {
      try { return await worker.fetch(event.request); }
      catch (error) {
        if (retired) throw error;
        const cached = await (await worker.caches.open(CACHE_NAME)).match(offlineUrl);
        if (!cached) throw error;
        // A distinct status/header prevents treating a fallback as real article content (e.g. PJAX).
        return new Response(await cached.text(), { status: 503, headers: {
          'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store', 'X-Butterfly-PWA': 'offline',
        } });
      }
    })());
  });
}
