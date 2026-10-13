import { pageScope } from './page-lifecycle.ts';

const key = Symbol.for('halo-butterfly-next.content-tracker');
declare global { interface Window { [key]?: { scope: object; url: string } } }

/** Halo 2.26.1 counter payload, with identity supplied by the current server page.
 * The native tracker captures identity in a history wrapper with no dispose API.
 * PJAX pages opt out on the server and report once per committed page instead.
 */
export function trackContentView(root: Document = document) {
  const win = root.defaultView;
  if (!win) return;
  const scope = pageScope();
  if (win[key]?.scope === scope) return;
  const referrer = win[key]?.url ?? root.referrer;
  win[key] = { scope, url: win.location.href };
  const subject = root.querySelector<HTMLElement>('[data-theme-tracker]');
  if (!subject) return;
  const { group, plural, name, endpoint } = subject.dataset;
  if (group !== 'content.halo.run' || !['posts', 'singlepages'].includes(plural || '') || !name || !endpoint) return;
  let target: URL;
  try {
    target = new URL(endpoint, win.location.href);
    if (target.origin !== win.location.origin || !target.pathname.endsWith('/apis/api.halo.run/v1alpha1/trackers/counter') || target.search || target.hash) return;
    if (win.localStorage.getItem('haloTracker.disabled')) return;
  } catch { return; }
  // No history monkeypatch or persistent event handlers, and no retry that could
  // count a visit twice. keepalive lets an already committed view finish on exit.
  void win.fetch(target.href, {
    method: 'POST', credentials: 'same-origin', keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group, plural, name, hostname: win.location.hostname,
      screen: `${win.screen.width}x${win.screen.height}`, language: win.navigator.language,
      url: win.location.pathname + win.location.search, referrer }),
  }).catch(error => console.debug('Theme content counter unavailable', error));
}
