import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { REPO, RUNTIME, browserEnvironment } from '../browser/support.mjs';

Object.assign(process.env, browserEnvironment());
const { chromium } = await import(path.join(RUNTIME, 'deps/node_modules/playwright/index.mjs'));
const output = path.join(REPO, '.runtime/pwa-lab/browser');
await mkdir(output, { recursive: true });
const identity = JSON.parse(await readFile(path.join(REPO, '.runtime/pwa-lab/pwa-owner.json')));
assert.equal(identity.owner, 'halo-butterfly-next-pwa'); assert.equal(identity.halo, 18097);
const base = 'http://127.0.0.1:18097';
const prefix = 'halo-butterfly-pwa-offline-';
const report = { testedAt: new Date().toISOString(), result: 'running', cases: [], limitations: [
  'Headless Chromium validates browser contracts; native OS installation and real iOS/Android devices are not exercised.',
  'This first stage does not provide offline article reading.',
] };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
report.themeSha256 = hash(await readFile(path.join(REPO, 'dist/halo-butterfly-next-0.1.0-alpha.3.zip')));
report.pluginSha256 = hash(await readFile(path.join(REPO, 'dist/butterfly-pwa-0.1.0.jar')));
const controller = spawn('python3', ['scripts/pwa/lab.py', 'control'], { cwd: REPO });
const pending = new Map(); let sequence = 0; let controlError = '';
controller.stderr.on('data', data => { controlError += data.toString(); });
createInterface({ input: controller.stdout }).on('line', line => {
  if (!line.startsWith('PWA-CONTROL:')) return;
  const response = JSON.parse(line.slice(12)); const job = pending.get(response.id);
  if (!job) return;
  clearTimeout(job.timeout); pending.delete(response.id);
  response.ok ? job.resolve() : job.reject(new Error(response.error));
});
controller.on('exit', () => {
  for (const job of pending.values()) { clearTimeout(job.timeout); job.reject(new Error(controlError || 'Lab controller exited')); }
  pending.clear();
});
const run = command => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Lab command timed out: ' + command)); }, 90000);
  pending.set(id, { resolve, reject, timeout });
  controller.stdin.write(JSON.stringify({ id, command }) + '\n');
});
const waitStatus = async enabled => {
  for (let i = 0; i < 30; i++) {
    const response = await fetch(base + '/butterfly-pwa/status');
    if (enabled === null && response.status === 404) return;
    if (response.ok && (await response.json()).enabled === enabled) return;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('Plugin status did not converge');
};
const profile = await mkdtemp(path.join(output, 'profile-'));
const launch = (offline = false) => chromium.launchPersistentContext(profile, { headless: true, executablePath: chromium.executablePath(), offline });
let context;
try {
  await run('install'); await run('probe'); await waitStatus(true);
  context = await launch(); report.browser = context.browser()?.version();
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(base, { waitUntil: 'load' }); assert.equal(response.status(), 200);
  assert.equal(await page.locator('link[rel="manifest"]').count(), 1);
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/butterfly-pwa/sw.js'));
  const manifest = await (await context.request.get(base + '/butterfly-pwa/manifest.webmanifest')).json();
  assert.equal(manifest.scope, '/'); assert.equal(manifest.display, 'standalone'); assert.equal(manifest.start_url, '/');
  for (const icon of manifest.icons) {
    const iconResponse = await context.request.get(base + icon.src); assert.equal(iconResponse.status(), 200);
    const png = await iconResponse.body(); assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), Number(icon.sizes.split('x')[0]));
  }
  assert.equal((await context.request.get(base + '/butterfly-pwa/sw.js')).headers()['service-worker-allowed'], '/');
  report.cases.push('manifest, PNG dimensions, root scope and active worker');
  const postHref = await page.locator('a.title').first().getAttribute('href');
  assert(postHref);
  for (const route of [postHref, '/__layout-probe/head', '/__layout-probe/no-head']) {
    const target = new URL(route, base); assert.equal(target.origin, base);
    assert.equal((await page.goto(target.href)).status(), 200);
    assert.equal(await page.locator('link[rel="manifest"]').count(), 1);
    await page.locator('.pwa-entry').waitFor();
  }
  await page.goto(base);
  report.cases.push('real article and plugin-provided public layouts have one manifest and install entry');
  const session = await context.newCDPSession(page);
  const installability = await session.send('Page.getInstallabilityErrors');
  report.installability = installability;
  assert.deepEqual(installability.installabilityErrors, []);
  for (const [width, height, colorScheme] of [[1440, 1000, 'light'], [1440, 1000, 'dark'], [390, 844, 'light'], [390, 844, 'dark']]) {
    await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme });
    await page.evaluate(dark => window.MainApp.useTheme.setMode(dark ? 'dark' : 'light'), colorScheme === 'dark');
    await page.locator('.pwa-entry').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `entry-${width}-${colorScheme}.png`) });
    assert(await page.locator('.pwa-entry').isVisible());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  report.cases.push('desktop/mobile light/dark entry, no horizontal overflow');
  const cached = await page.evaluate(async () => {
    const result = {};
    for (const key of await caches.keys()) if (key.startsWith('halo-butterfly-pwa-offline-')) result[key] = (await (await caches.open(key)).keys()).map(r => new URL(r.url).pathname);
    return result;
  });
  assert.equal(Object.keys(cached).length, 1); assert.deepEqual(Object.values(cached)[0], ['/butterfly-pwa/offline.html']);
  const freshPage = await context.newPage(); await context.setOffline(true);
  const failed = await freshPage.goto(base + '/a-new-public-page/', { waitUntil: 'load' });
  assert.equal(failed.status(), 503); assert.equal(failed.headers()['x-butterfly-pwa'], 'offline');
  assert(await freshPage.getByRole('heading', { name: '暂时无法连接' }).isVisible());
  await freshPage.setViewportSize({ width: 390, height: 844 }); await freshPage.emulateMedia({ colorScheme: 'dark' });
  await freshPage.screenshot({ path: path.join(output, 'offline-mobile-dark.png') });
  await freshPage.setViewportSize({ width: 1440, height: 1000 }); await freshPage.emulateMedia({ colorScheme: 'light' });
  await freshPage.screenshot({ path: path.join(output, 'offline-desktop-light.png') });
  const privatePage = await context.newPage();
  await assert.rejects(privatePage.goto(base + '/login', { waitUntil: 'load' }));
  await privatePage.close();
  await context.setOffline(false); await freshPage.goto(base);
  assert.equal(await freshPage.locator('.pwa-entry').count(), 1);
  report.cases.push('offline new tab shows 503 fallback; login stays native; network recovery');
  await page.evaluate(async () => { await caches.open('foreign-cache'); await caches.open('halo-butterfly-pwa-offline-old'); });
  // Reinstalling the same worker does not activate again; cleanup is tested on real disable below.
  await run('config-off'); await waitStatus(false); await page.reload();
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).length === 0);
  assert.deepEqual(await page.evaluate(() => caches.keys()), ['foreign-cache']);
  assert.equal(await page.locator('.pwa-entry').count(), 0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('footer, .footer').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, 'entry-disabled.png') });
  report.cases.push('config off unregisters worker, clears only owned caches and removes entry');
  await run('config-on'); await waitStatus(true); await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/butterfly-pwa/sw.js'));
  await run('disable'); await waitStatus(null); await page.reload();
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).length === 0);
  assert.deepEqual(await page.evaluate(() => caches.keys()), ['foreign-cache']);
  report.cases.push('plugin disable removes injected manifest and cleans installed worker');
  await run('enable'); await waitStatus(true); await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/butterfly-pwa/sw.js'));
  await run('uninstall'); await waitStatus(null); await page.reload();
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).length === 0);
  assert.deepEqual(await page.evaluate(() => caches.keys()), ['foreign-cache']);
  report.cases.push('plugin uninstall cleans installed worker and preserves foreign cache');
  assert.deepEqual(errors, []); report.cases.push('no page JavaScript errors');
  await context.close();
  await run('install'); await waitStatus(true);
  context = await launch();
  const installed = await context.newPage(); await installed.goto(base);
  await installed.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/butterfly-pwa/sw.js'));
  await context.close();
  context = await launch(true);
  const reopened = await context.newPage();
  assert.equal((await reopened.goto(base)).status(), 503);
  assert(await reopened.getByRole('heading', { name: '暂时无法连接' }).isVisible());
  await context.setOffline(false); assert.equal((await reopened.reload()).status(), 200);
  report.cases.push('full browser restart while offline retains fallback; reconnect loads current page');
  report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = error.stack; process.exitCode = 1; }
finally {
  controller.stdin.end();
  await context?.close();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
