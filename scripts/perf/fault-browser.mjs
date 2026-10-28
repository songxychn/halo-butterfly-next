/** Bounded fault injection on an explicitly owned loopback Halo; never sends provider traffic. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { RUNTIME, browserEnvironment, validatePackage, sha256 } from '../browser/support.mjs';
import { ownedDiagnosticLab, boundedDiagnostic, loadingRequestLedger } from '../browser/loading-diagnostics.mjs';
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  assert(['--lab-runtime', '--package', '--source-sha', '--profile', '--output', '--positive-path'].includes(process.argv[i]) && process.argv[i + 1] && !args[process.argv[i]]);
  args[process.argv[i]] = process.argv[i + 1];
}
for (const key of ['--lab-runtime', '--package', '--source-sha', '--profile', '--output']) assert(args[key], 'Missing ' + key);
if (args['--positive-path']) assert(/^\/archives\/[a-z0-9-]+\/$/.test(args['--positive-path']), 'Positive control must be a local article path');
assert(['official', 'ondemand'].includes(args['--profile']));
const lab = await ownedDiagnosticLab(args['--lab-runtime'], process.env.BASE_URL);
const base = new URL(process.env.BASE_URL).origin;
const installedBytes = await readFile(path.join(lab, 'installed-package.json'));
const installed = JSON.parse(installedBytes);
validatePackage(installed, args['--source-sha'], sha256(await readFile(args['--package'])));
const output = path.resolve(args['--output']);
assert(output.startsWith(lab + path.sep));
await mkdir(output); // Never replace an earlier batch.
Object.assign(process.env, browserEnvironment());
const pw = await import(pathToFileURL(path.join(RUNTIME, 'deps/node_modules/playwright/index.mjs')));
const report = { schema: 1, candidate: installed, profile: args['--profile'], startedAt: new Date().toISOString(), toolSha256: sha256(await readFile(fileURLToPath(import.meta.url))), runnerHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), cases: [], limitations: ['Injected failures are expected and recorded; this is not a resource-completeness or provider feature pass.', 'Headless 390px light mode only; not physical phones/Safari or all configurations.', 'Official plugin injection remains intact; failed plugin resources do not certify math/comment functionality.', `On-demand scope covers enabled Mermaid/ChartJS${args['--positive-path'] ? '/ABCJS' : ''} absent on homepage then present with matching content; no claim for all body features.`] };
const save = () => writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
for (const engine of ['chromium', 'firefox', 'webkit']) {
  const browser = await pw[engine].launch({ headless: true, ...(engine === 'chromium' ? { channel: 'chromium' } : {}) });
  try {
    for (const fault of ['503']) {
      const row = { engine, version: browser.version(), fault, injected: [], blocked: [], errors: [], startedAt: new Date().toISOString() };
      report.cases.push(row);
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', locale: 'zh-CN' });
      const ledger = loadingRequestLedger();
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        const official = url.origin === base && /^\/plugins\/(PluginCommentWidget|plugin-katex)\//.test(url.pathname);
        if (args['--profile'] === 'official' && official) {
          row.injected.push({ url: url.href, fault, at: Date.now() });
          return route.fulfill({ status: 503, contentType: 'text/plain', body: 'Owned synthetic unavailable resource' });
        }
        if (url.origin !== base) { row.blocked.push(url.href); return route.abort(); }
        return route.continue();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('request', request => ledger.start(request));
      page.on('response', response => { const x = ledger.get(response.request()); if (x) x.status = response.status(); });
      page.on('requestfinished', request => ledger.finish(request));
      page.on('requestfailed', request => ledger.finish(request, request.failure()?.errorText || 'failed'));
      page.on('pageerror', error => row.errors.push(error.message));
      try {
        const target = args['--profile'] === 'ondemand' ? '/' : '/archives/preview-2/';
        const response = await page.goto(base + target, { waitUntil: 'commit', timeout: 20000 });
        assert.equal(response.status(), 200);
        await page.waitForFunction(() => !!window.MainApp?.useCommon && !document.body.classList.contains('loading'));
        row.readyAt = Date.now();
        assert.equal(await page.locator(args['--profile'] === 'ondemand' ? '.above-title' : 'article.render').isVisible(), true);
        if (args['--profile'] !== 'ondemand') { row.bodyText = await page.locator('article.render').innerText(); assert(row.bodyText.includes('固定合成文章') && row.bodyText.includes('两站使用同一份版本化内容。')); }
        await page.locator('.nav .bars').click();
        assert.equal(await page.locator('.nav .bars').getAttribute('aria-expanded'), 'true');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.nav .bars').getAttribute('aria-expanded'), 'false');
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        await page.locator('#rightside-config').click();
        await page.locator('#darkmode').click();
        await page.waitForFunction(() => document.documentElement.dataset.colorScheme === 'dark');
        row.core = { bodyReadable: true, loadingCleared: true, menuOperable: true, modeChanged: true };
        if (args['--profile'] === 'official') {
          assert(row.injected.some(x => x.url.includes('/plugins/PluginCommentWidget/')));
          assert(row.injected.some(x => x.url.includes('/plugins/plugin-katex/')));
          row.officialMarkup = await page.evaluate(() => ({ resources: [...document.querySelectorAll('script[src],link[href]')].map(n => n.src || n.href).filter(x => /\/plugins\/(PluginCommentWidget|plugin-katex)\//.test(x)), commentHosts: document.querySelectorAll('#post-comment .comment-wrap').length }));
          assert(row.officialMarkup.resources.length >= 2);
        } else {
          row.optionalRequests = ledger.snapshot().filter(x => /mermaid|chartjs|abcjs|body-renderer/.test(new URL(x.url).pathname));
          assert.equal(row.optionalRequests.length, 0);
          row.config = await page.evaluate(() => MainApp.conf);
          const positiveResponse = await page.goto(base + (args['--positive-path'] || '/archives/perf03-demand-20261016/'), { waitUntil: 'domcontentloaded', timeout: 20000 });
          assert.equal(positiveResponse.status(), 200, 'Published positive control must return 200');
          await page.waitForSelector('.theme-render-output svg');
          await page.waitForSelector('.theme-render-output canvas');
          if (args['--positive-path']) await page.waitForSelector('#fixture-score .theme-render-output svg');
          row.positiveRequests = ledger.snapshot().filter(x => /renderers\/(mermaid|chartjs|abcjs)\.min\.js/.test(new URL(x.url).pathname));
          assert(row.positiveRequests.some(x => x.url.includes('/renderers/mermaid.min.js')));
          assert(row.positiveRequests.some(x => x.url.includes('/renderers/chartjs.min.js')));
          if (args['--positive-path']) assert(row.positiveRequests.some(x => x.url.includes('/renderers/abcjs.min.js')));
        }
        assert.deepEqual(row.blocked, []);
        assert.deepEqual(row.errors, []);
        row.pass = true;
      } catch (error) { row.pass = false; row.error = String(error.stack || error); }
      finally {
        row.beforeClose = ledger.snapshot();
        await save(); // Preserve failure evidence before teardown.
        await boundedDiagnostic(() => context.close(), 5000, 'Fault context close');
        row.finishedAt = new Date().toISOString();
        await save();
        console.log(engine, args['--profile'], fault, row.pass ? 'PASS' : 'FAIL');
      }
    }
  } finally { await boundedDiagnostic(() => browser.close(), 5000, 'Fault browser close'); }
}
report.installationRecordUnchanged = (await readFile(path.join(lab, 'installed-package.json'))).equals(installedBytes);
report.pass = report.installationRecordUnchanged && report.cases.length === 3 && report.cases.every(x => x.pass);
report.finishedAt = new Date().toISOString();
await save();
if (!report.pass) process.exitCode = 1;
