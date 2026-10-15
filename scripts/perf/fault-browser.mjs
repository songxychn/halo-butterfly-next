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
  assert(['--lab-runtime', '--package', '--source-sha', '--profile', '--output'].includes(process.argv[i]) && process.argv[i + 1] && !args[process.argv[i]]);
  args[process.argv[i]] = process.argv[i + 1];
}
assert.equal(Object.keys(args).length, 5);
assert(['official', 'external', 'ondemand', 'pace-hang'].includes(args['--profile']));
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
const report = { schema: 1, candidate: installed, profile: args['--profile'], startedAt: new Date().toISOString(), toolSha256: sha256(await readFile(fileURLToPath(import.meta.url))), runnerHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), cases: [], limitations: ['Injected failures are expected and recorded; this is not a resource-completeness or provider feature pass.', 'Headless 390px light mode only; not physical phones/Safari or all configurations.', 'Official plugin injection remains intact; failed plugin resources do not certify math/comment functionality.', 'On-demand scope covers enabled Mermaid/ChartJS absent on homepage then present with matching content; no claim for all body features.'] };
const save = () => writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
for (const engine of ['chromium', 'firefox', 'webkit']) {
  const browser = await pw[engine].launch({ headless: true, ...(engine === 'chromium' ? { channel: 'chromium' } : {}) });
  try {
    for (const fault of args['--profile'] === 'external' ? ['503', 'hang'] : args['--profile'] === 'pace-hang' ? ['hang'] : ['503']) {
      const row = { engine, version: browser.version(), fault, injected: [], blocked: [], errors: [], startedAt: new Date().toISOString() };
      report.cases.push(row);
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', locale: 'zh-CN' });
      if (args['--profile'] === 'pace-hang') await context.addInitScript(() => {
        window.__paceFaultTrace = [];
        window.__paceFaultSnapshot = label => {
          const api = window.Pace, state = window[Symbol.for('halo-butterfly-next.pace')];
          const bars = [...document.querySelectorAll('.pace, .pace-progress')].map(node => { const css = getComputedStyle(node), box = node.getBoundingClientRect(); return { className: node.className, display: css.display, visibility: css.visibility, opacity: css.opacity, width: box.width, height: box.height, visible: css.display !== 'none' && css.visibility !== 'hidden' && Number(css.opacity) > 0 && box.width > 0 && box.height > 0 && box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight }; });
          return { label, at: Date.now(), performanceMs: performance.now(), readyState: document.readyState, active: document.documentElement?.classList.contains('theme-pace-active') || false, apiPresent: !!api, running: api?.running ?? null, restartOnRequestAfter: api?.options?.restartOnRequestAfter ?? null, stateEnabled: state?.enabled ?? null, stateReady: state?.ready ?? null, bodyLoading: document.body?.classList.contains('loading') ?? null, bars };
        };
        let previous = '';
        const record = label => {
          const row = window.__paceFaultSnapshot(label);
          const key = JSON.stringify([row.readyState, row.active, row.running, row.stateReady, row.bars.map(bar => [bar.className, bar.visible])]);
          if (key !== previous) { previous = key; window.__paceFaultTrace.push(row); }
        };
        new MutationObserver(() => record('DOM mutation')).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
        document.addEventListener('readystatechange', () => record('readystatechange'));
      });
      const ledger = loadingRequestLedger();
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        const official = url.origin === base && /^\/plugins\/(PluginCommentWidget|plugin-katex)\//.test(url.pathname);
        const provider = ['https://static.addtoany.com', 'https://www.googletagmanager.com'].includes(url.origin);
        if (args['--profile'] === 'official' && official || ['external', 'pace-hang'].includes(args['--profile']) && provider) {
          row.injected.push({ url: url.href, fault, at: Date.now() });
          if (fault === 'hang') { await gate; return route.abort(); }
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
        if (['external', 'pace-hang'].includes(args['--profile'])) {
          await page.waitForFunction(() => !!document.querySelector('[data-share-status]')?.textContent?.trim());
          row.shareStatus = await page.locator('[data-share-status]').textContent();
          row.fallbackAt = Date.now();
          row.fallbackLinks = await page.locator('[data-share-provider] a').evaluateAll(nodes => nodes.map(a => a.href));
          assert(row.fallbackLinks.length >= 4 && row.fallbackLinks.every(url => url.startsWith('https://www.addtoany.com/add_to/')));
          assert(row.injected.some(x => x.url.startsWith('https://static.addtoany.com/')));
          assert(row.injected.some(x => x.url.startsWith('https://www.googletagmanager.com/')));
          row.analytics = await page.evaluate(() => ({ ready: window[Symbol.for('halo-butterfly-next.manual-analytics')]?.ready, dataLayerCount: window.dataLayer?.length }));
          assert.equal(row.analytics.ready, false);
          if (args['--profile'] === 'pace-hang') {
            await page.waitForFunction(() => window.__paceFaultTrace.some(x => x.active && x.running === true && x.stateEnabled === true && x.stateReady === true));
            row.paceStart = await page.evaluate(() => window.__paceFaultTrace.find(x => x.active && x.running === true && x.stateEnabled === true && x.stateReady === true));
            row.paceBeforeWatchdog = await page.evaluate(() => window.__paceFaultSnapshot('after core controls and SDK timeout'));
            assert.equal(row.paceBeforeWatchdog.active, true, 'Pace must actually be active before observing watchdog');
            assert(row.paceBeforeWatchdog.bars.some(x => x.visible), 'Pace progress DOM must visibly exist before watchdog');
            const remaining = 35000 - (Date.now() - row.paceStart.at);
            assert(remaining > 0, 'Pace observation already exceeded bounded window');
            await page.waitForFunction(() => {
              const s = window.__paceFaultSnapshot('watchdog poll');
              return s.apiPresent && !s.active && s.running === false && s.stateReady === false && s.restartOnRequestAfter === false && s.bars.every(x => !x.visible);
            }, null, { timeout: remaining, polling: 100 });
            row.paceStopped = await page.evaluate(() => window.__paceFaultSnapshot('watchdog stopped'));
            row.paceTrace = await page.evaluate(() => window.__paceFaultTrace);
            row.watchdogElapsedMs = row.paceStopped.at - row.paceStart.at;
            assert(row.watchdogElapsedMs >= 29000 && row.watchdogElapsedMs <= 35000, 'Expected original 30-second watchdog, not an early absent bar');
            row.heldAfterWatchdog = ledger.snapshot().filter(x => ['https://static.addtoany.com', 'https://www.googletagmanager.com'].includes(new URL(x.url).origin));
            assert(row.heldAfterWatchdog.some(x => x.url.startsWith('https://static.addtoany.com/')) && row.heldAfterWatchdog.some(x => x.url.startsWith('https://www.googletagmanager.com/')));
            assert(row.heldAfterWatchdog.every(x => x.state === 'pending' && x.status === undefined), 'SDKs must remain held through Pace completion');
            await page.evaluate(() => scrollTo(0, 0));
            await page.locator('.nav .bars').click();
            assert.equal(await page.locator('.nav .bars').getAttribute('aria-expanded'), 'true');
            await page.keyboard.press('Escape');
            await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
            await page.locator('#darkmode').click();
            await page.waitForFunction(() => document.documentElement.dataset.colorScheme === 'light');
            assert.equal(await page.locator('article.render').isVisible(), true);
            assert((await page.locator('article.render').innerText()).includes('两站使用同一份版本化内容。'));
            row.coreAfterWatchdog = { bodyReadable: true, menuOperable: true, modeChanged: true, snapshot: await page.evaluate(() => window.__paceFaultSnapshot('after final core controls')) };
          }

        } else if (args['--profile'] === 'official') {
          assert(row.injected.some(x => x.url.includes('/plugins/PluginCommentWidget/')));
          assert(row.injected.some(x => x.url.includes('/plugins/plugin-katex/')));
          row.officialMarkup = await page.evaluate(() => ({ resources: [...document.querySelectorAll('script[src],link[href]')].map(n => n.src || n.href).filter(x => /\/plugins\/(PluginCommentWidget|plugin-katex)\//.test(x)), commentHosts: document.querySelectorAll('[data-comment-lazy]').length }));
          assert(row.officialMarkup.resources.length >= 2);
        } else {
          row.optionalRequests = ledger.snapshot().filter(x => /mermaid|chartjs|body-renderer/.test(new URL(x.url).pathname));
          assert.equal(row.optionalRequests.length, 0);
          row.config = await page.evaluate(() => MainApp.conf);
          const positiveResponse = await page.goto(base + '/archives/perf03-demand-20261016/', { waitUntil: 'domcontentloaded', timeout: 20000 });
          assert.equal(positiveResponse.status(), 200, 'Published positive control must return 200');
          await page.waitForSelector('.theme-render-output svg');
          await page.waitForSelector('.theme-render-output canvas');
          row.positiveRequests = ledger.snapshot().filter(x => /renderers\/(mermaid|chartjs)\.min\.js/.test(new URL(x.url).pathname));
          assert(row.positiveRequests.some(x => x.url.includes('/renderers/mermaid.min.js')));
          assert(row.positiveRequests.some(x => x.url.includes('/renderers/chartjs.min.js')));
        }
        assert.deepEqual(row.blocked, []);
        assert.deepEqual(row.errors, []);
        row.pass = true;
      } catch (error) { row.pass = false; row.error = String(error.stack || error); }
      finally {
        if (args['--profile'] === 'pace-hang') row.paceTrace = await page.evaluate(() => window.__paceFaultTrace).catch(error => ({captureError: error.message}));
        row.beforeClose = ledger.snapshot();
        await save(); // Intentional held requests recorded before teardown aborts.
        release();
        await boundedDiagnostic(() => context.close(), 5000, 'Fault context close');
        row.finishedAt = new Date().toISOString();
        await save();
        console.log(engine, args['--profile'], fault, row.pass ? 'PASS' : 'FAIL');
      }
    }
  } finally { await boundedDiagnostic(() => browser.close(), 5000, 'Fault browser close'); }
}
report.installationRecordUnchanged = (await readFile(path.join(lab, 'installed-package.json'))).equals(installedBytes);
report.pass = report.installationRecordUnchanged && report.cases.length === (args['--profile'] === 'external' ? 6 : 3) && report.cases.every(x => x.pass);
report.finishedAt = new Date().toISOString();
await save();
if (!report.pass) process.exitCode = 1;
