/** Focus regression against the official plugin in an owned synthetic Halo lab. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { REPO, RUNTIME, ENGINES, ownRuntime, browserEnvironment, validateBaseUrl, validatePackage, sha256, readJson } from '../browser/support.mjs';
import { observeSearchPage } from './diagnostics.mjs';

const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const name = process.argv[i];
  assert(['--lab-runtime', '--theme-package', '--theme-source-sha', '--output'].includes(name) && process.argv[i + 1] && !options[name], 'Invalid arguments');
  options[name] = process.argv[i + 1];
}
for (const name of ['--lab-runtime', '--theme-package', '--theme-source-sha', '--output']) assert(options[name], name + ' required');
const runtime = await realpath(options['--lab-runtime']);
const base = validateBaseUrl(process.env.BASE_URL, await readJson(path.join(runtime, 'lab.json')));
await readJson(path.join(runtime, 'seed.json'));
const installed = await readJson(path.join(runtime, 'installed-package.json'));
validatePackage(installed, options['--theme-source-sha'], sha256(await readFile(options['--theme-package'])));
const lock = await readJson(path.join(REPO, 'fixtures/search-comment/versions.json'));
const plugin = lock.plugins.find(p => p.name === 'PluginSearchWidget');
assert(plugin);
const authPath = path.join(runtime, 'plugin-auth.private.json');
assert.equal((await stat(authPath)).mode & 0o077, 0, 'Synthetic session must be private');
const auth = await readJson(authPath);
await ownRuntime();
Object.assign(process.env, browserEnvironment());
const playwright = await import(pathToFileURL(path.join(RUNTIME, 'deps/node_modules/playwright/index.mjs')));
assert.equal((await readJson(path.join(RUNTIME, 'deps/node_modules/playwright/package.json'))).version, '1.63.0');
const output = path.resolve(options['--output']);
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output);
const report = {
  schema: 1, startedAt: new Date().toISOString(),
  runnerSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  runnerFileSha256: sha256(await readFile(new URL(import.meta.url))),
  workingTreeClean: !execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  theme: installed, plugin, browsers: {}, checks: [], diagnostics: [], contractAcceptance: false,
  limitations: ['Pinned headless Chromium/Firefox/WebKit; not actual Safari, physical devices, soft keyboards or screen readers.', 'Additional triggers and unavailable-trigger states are browser DOM fixtures; no server content or settings are changed.', 'Focus regression only; complete PLG-01/02 and page-resource acceptance remain separate.'],
};
const save = () => writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
async function check(name, fn, diagnostics) {
  try {
    const detail = await fn();
    report.checks.push({ name, result: 'passed', detail });
    console.log('PASS', name);
  } catch (error) {
    report.checks.push({ name, result: 'failed', error: error.message, ...(diagnostics ? { diagnostic: await diagnostics.snapshot() } : {}) });
    console.log('FAIL', name, error.message.slice(0, 160));
  }
  await save();
}
async function settled(page, open) {
  await page.waitForFunction(expected => document.querySelector('search-modal')?.open === expected, open);
  await page.locator('search-modal').evaluate(element => element.updateComplete);
}
async function returned(trigger) {
  await trigger.page().waitForFunction(element => document.activeElement === element, await trigger.elementHandle(), { timeout: 5000 });
}
try {
  for (const engine of ENGINES) {
    let browser;
    try {
      browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' ? { channel: 'chromium' } : {}) });
      report.browsers[engine] = browser.version();
      const admin = await browser.newContext({ storageState: { cookies: auth.cookies, origins: [] } });
      const response = await admin.request.get(base + '/apis/plugin.halo.run/v1alpha1/plugins/' + plugin.name);
      assert(response.ok(), 'Plugin inventory read failed');
      const actual = await response.json();
      assert.equal(actual.spec.version, plugin.version);
      assert.equal(actual.status.phase, 'STARTED');
      assert.equal(actual.spec.enabled, true);
      assert.equal(sha256(await readFile(path.join(runtime, 'halo/data/plugins', plugin.name + '-' + plugin.version + '.jar'))), plugin.sha256);
      await admin.close();
      for (const width of [1440, 390]) for (const mode of ['light', 'dark']) {
        const name = `${engine}-${width}-${mode}`;
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, colorScheme: mode, locale: 'zh-CN', storageState: { cookies: [], origins: [{ origin: base, localStorage: [{ name: 'halo-butterfly-next.color-scheme', value: mode }] }] } });
        await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
        const page = await context.newPage();
        page.setDefaultTimeout(12000);
        page.setDefaultNavigationTimeout(30000);
        const diagnostics = observeSearchPage(page, name);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
          await page.waitForFunction(expected => document.documentElement.dataset.colorScheme === expected && typeof window.SearchWidget?.open === 'function', mode);
          await page.locator('.nav').evaluate(async element => {
            getComputedStyle(element).opacity;
            await Promise.all(element.getAnimations({ subtree: true })
              .filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
              .map(animation => animation.finished.catch(() => {})));
          });
          const trigger = page.locator('.nav a[title="搜索"]');
          const input = page.getByPlaceholder('输入关键词以搜索');
          const opened = async () => {
            await input.waitFor(); await settled(page, true);
            await page.waitForFunction(element => element.getRootNode().activeElement === element, await input.elementHandle(), { timeout: 5000 });
          };
          const open = async () => { await trigger.focus(); await page.keyboard.press('Enter'); await opened(); };
          await check(name + '-escape-focus-return', async () => {
            await open(); await page.keyboard.press('Escape'); await settled(page, false); await returned(trigger);
            await page.screenshot({ path: path.join(output, name + '-focus.png') });
          }, diagnostics);
          await check(name + '-backdrop-focus-return', async () => {
            await open(); await page.locator('search-modal .modal__layer').click({ position: { x: 5, y: 5 } }); await settled(page, false); await returned(trigger);
          }, diagnostics);
          await check(name + '-repeated-open-close', async () => {
            for (let i = 0; i < 3; i++) { await open(); await page.keyboard.press('Escape'); await settled(page, false); await returned(trigger); }
            await page.keyboard.press('Escape'); await returned(trigger);
            return { repetitions: 3, closedEscapePreservesFocus: true };
          }, diagnostics);
          await check(name + '-multiple-triggers', async () => {
            await page.evaluate(() => {
              const button = document.createElement('button'); button.id = 'focus-fixture'; button.textContent = '合成搜索入口';
              button.onclick = () => window.SearchWidget.open(); document.body.prepend(button);
            });
            const other = page.locator('#focus-fixture');
            await other.focus(); await page.keyboard.press('Enter'); await opened(); await page.keyboard.press('Escape'); await settled(page, false); await returned(other);
            await open(); await page.keyboard.press('Escape'); await settled(page, false); await returned(trigger);
          }, diagnostics);
          await check(name + '-batched-close-reopen', async () => {
            await open();
            await page.evaluate(() => { document.querySelector('search-modal').close(); window.SearchWidget.open(); });
            await opened();
            await page.keyboard.press('Escape'); await settled(page, false); await returned(trigger);
          }, diagnostics);
          for (const unavailable of ['hidden', 'removed']) await check(name + '-trigger-' + unavailable, async () => {
            const other = page.locator('#focus-fixture');
            await other.focus(); await page.keyboard.press('Enter'); await opened();
            await other.evaluate((element, state) => state === 'removed' ? element.remove() : element.hidden = true, unavailable);
            await page.keyboard.press('Escape'); await settled(page, false);
            assert(await page.evaluate(() => document.activeElement?.id !== 'focus-fixture'), 'Focus restored to unavailable trigger');
            if (unavailable === 'hidden') await other.evaluate(element => element.hidden = false);
            await open(); await page.keyboard.press('Escape'); await settled(page, false); await returned(trigger);
          }, diagnostics);
          await check(name + '-result-navigation', async () => {
            await open(); await input.fill('排版');
            await page.locator('search-modal h2').filter({ hasText: '排版' }).waitFor();
            await Promise.all([page.waitForURL(url => url.pathname.replace(/\/$/, '') === '/archives/preview-1', { waitUntil: 'domcontentloaded' }), input.press('Enter')]);
            await page.locator('h1').filter({ hasText: 'Butterfly 对照：排版与交互' }).waitFor();
            return { pathname: new URL(page.url()).pathname };
          }, diagnostics);
          assert.deepEqual(errors, [], 'Uncaught page errors');
        } catch (error) {
          report.checks.push({ name: name + '-page', result: 'failed', error: error.message, diagnostic: await diagnostics.snapshot() });
        } finally {
          await diagnostics.finish(); report.diagnostics.push(diagnostics.report); await context.close(); await save();
        }
      }
    } catch (error) {
      report.checks.push({ name: engine + '-setup', result: 'failed', error: error.message });
    } finally { if (browser) await browser.close(); await save(); }
  }
} finally {
  report.finishedAt = new Date().toISOString();
  report.result = report.checks.some(check => check.result === 'failed') || report.checks.length !== ENGINES.length * 4 * 8 ? 'failed' : 'passed-tested-scope';
  await save();
}
process.exitCode = report.result === 'failed' ? 1 : 0;
