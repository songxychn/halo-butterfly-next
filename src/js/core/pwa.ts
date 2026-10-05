const BASE = '/butterfly-pwa/';
const CACHE_PREFIX = 'halo-butterfly-pwa-offline-';
type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

export function ownsRegistration(registration: ServiceWorkerRegistration, origin: string): boolean {
  const workers = [registration.active, registration.waiting, registration.installing].filter(Boolean);
  return registration.scope === origin + '/' && workers.length > 0 &&
    workers.every(worker => worker!.scriptURL === origin + BASE + 'sw.js');
}

export async function clearOwnedPwa(container: ServiceWorkerContainer, storage: CacheStorage, origin: string) {
  for (const registration of await container.getRegistrations()) {
    if (ownsRegistration(registration, origin)) await registration.unregister();
  }
  for (const key of await storage.keys()) if (key.startsWith(CACHE_PREFIX)) await storage.delete(key);
}

/** The optional companion plugin owns configuration/metadata and the root worker. */
export async function initializePwa() {
  if (!isSecureContext || !('serviceWorker' in navigator) || !('caches' in window)) return;
  if (document.documentElement.dataset.butterflyPwaInitialized) return;
  document.documentElement.dataset.butterflyPwaInitialized = 'true';
  const origin = location.origin;
  const manifests = [...document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]')];
  const ours = manifests.find(link => link.hasAttribute('data-butterfly-pwa') && link.href === origin + BASE + 'manifest.webmanifest');
  try {
    if (!ours) { await clearOwnedPwa(navigator.serviceWorker, caches, origin); return; }
    if (manifests.length !== 1) return; // Do not compete with another plugin's application identity.
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.some(registration => !ownsRegistration(registration, origin))) return;
  } catch { return; } // Storage policy may deny access; normal navigation must still work.

  const register = async () => {
    const registration = await navigator.serviceWorker.register(BASE + 'sw.js', { scope: '/', updateViaCache: 'none' });
    registration.active?.postMessage({ type: 'butterfly-pwa:resume' });
  };

  const host = document.querySelector('footer, .footer');
  if (!host || matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone) {
    await register().catch(() => {});
    return;
  }
  const panel = document.createElement('div');
  panel.className = 'pwa-entry';
  const install = document.createElement('button');
  install.type = 'button'; install.textContent = '安装应用'; install.hidden = true;
  const details = document.createElement('details');
  const summary = document.createElement('summary'); summary.textContent = '添加到桌面';
  const help = document.createElement('p');
  help.textContent = '可在浏览器菜单中选择“安装应用”或“添加到主屏幕”。iPhone / iPad 可使用 Safari 的分享菜单。';
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  details.append(summary, help); panel.append(install, details, status); host.append(panel);
  let pending: InstallEvent | null = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); pending = event as InstallEvent;
    install.hidden = false; details.hidden = true;
  });
  window.addEventListener('appinstalled', () => { pending = null; panel.remove(); });
  install.addEventListener('click', async () => {
    if (!pending) return;
    const event = pending; pending = null; install.disabled = true;
    try { await event.prompt(); await event.userChoice; }
    catch { status.textContent = '请使用浏览器菜单添加到桌面。'; }
    finally { install.hidden = true; install.disabled = false; details.hidden = false; }
  });
  try {
    await register();
  } catch {
    status.textContent = '离线提示暂不可用，请联网访问。';
  }
}
