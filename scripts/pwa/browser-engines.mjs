import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO, RUNTIME, browserEnvironment } from '../browser/support.mjs';

Object.assign(process.env, browserEnvironment());
const engines = await import(path.join(RUNTIME, 'deps/node_modules/playwright/index.mjs'));
const base = 'http://127.0.0.1:18097';
const owner = JSON.parse(await readFile(path.join(REPO, '.runtime/pwa-lab/pwa-owner.json')));
assert.equal(owner.owner, 'halo-butterfly-next-pwa'); assert.equal(owner.halo, 18097);
const report = { testedAt: new Date().toISOString(), cases: [], limitations: ['Automation engines are not native Safari or physical devices; OS installation is not tested.'] };
for (const name of ['firefox', 'webkit']) {
  let browser;
  const result = { engine: name, result: 'failed' };
  try {
    browser = await engines[name].launch({ headless: true }); result.version = browser.version();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    assert.equal((await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 })).status(), 200);
    await page.locator('.pwa-entry').waitFor();
    assert.equal(await page.locator('link[rel="manifest"]').count(), 1);
    await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/butterfly-pwa/sw.js'));
    await context.setOffline(true);
    const offline = await context.newPage();
    assert.equal((await offline.goto(base + '/offline-browser-check/', { timeout: 20000 })).status(), 503);
    assert(await offline.getByRole('heading', { name: '暂时无法连接' }).isVisible());
    await offline.screenshot({ path: path.join(REPO, `.runtime/pwa-lab/browser/offline-${name}.png`) });
    await context.setOffline(false);
    assert.equal((await offline.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 })).status(), 200);
    result.result = 'passed';
  } catch (error) { result.error = error.message; process.exitCode = 1; }
  finally { await browser?.close(); report.cases.push(result); }
}
await writeFile(path.join(REPO, '.runtime/pwa-lab/browser/engines.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
