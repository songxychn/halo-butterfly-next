/** Headless, task-owned Playwright only. Never connects to a user's browser. */
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {REPO, RUNTIME, ENGINES, validateBaseUrl, browserEnvironment, requestPolicy, sha256} from '../browser/support.mjs';
import {contrastRatio} from './contrast.mjs';
import {contextOptions, withinDeadline, fallbackMessages, footerSettled} from './browser-support.mjs';
const fallback = fallbackMessages(await readFile(path.join(REPO, 'i18n/default.properties'), 'utf8'));

const runtime = path.resolve(process.env.LAB_RUNTIME || '');
assert.ok(runtime.startsWith(path.join(REPO, '.runtime') + path.sep), 'Explicit task runtime required');
const marker = JSON.parse(await readFile(path.join(runtime, 'lab.json')));
const base = validateBaseUrl(process.env.BASE_URL, marker);
const plan = JSON.parse(await readFile(process.env.FEED_BROWSER_PLAN));
assert.equal(plan.owner, 'halo-butterfly-next-feed-sitemap-browser');
assert.equal(plan.base, base);
const output = path.resolve(plan.output);
assert.ok(output.startsWith(runtime + path.sep));
await mkdir(output, {recursive: true});
Object.assign(process.env, browserEnvironment(RUNTIME));
const engines = await import(pathToFileURL(path.join(RUNTIME, 'deps/node_modules/playwright/index.mjs')).href);
const report = {schema: 1, phase: plan.phase, base, expected: plan.expected,
  startedAt: new Date().toISOString(), timeoutMs: 30000, cleanupTimeoutMs: 5000,
  runnerHead: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: REPO, encoding: 'utf8'}).trim(),
  runnerSha256: sha256(await readFile(new URL(import.meta.url))),
  supportSha256: sha256(await readFile(new URL('./browser-support.mjs', import.meta.url))),
  browserSupportSha256: sha256(await readFile(new URL('../browser/support.mjs', import.meta.url))),
  contrastSha256: sha256(await readFile(new URL('./contrast.mjs', import.meta.url))),
  fallbackCatalogSha256: sha256(await readFile(path.join(REPO, 'i18n/default.properties'))),
  package: plan.package, activeTheme: plan.activeTheme, cases: [], failures: []};
const xml = ['/rss.xml', '/sitemap.xml'];
const persist = () => writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');

async function inspect(page, expected, white = false) {
  if (white) {
    // PJAX completion follows synchronous App reentry, but CSS transitions may
    // still interpolate from transparent to the newly applied opaque plate.
    await page.waitForFunction(footerSettled, null, {timeout: 30000});
  }
  const state = await page.evaluate(() => {
    const links = [...document.querySelectorAll('head link[rel="alternate"][type="application/rss+xml"], head link[rel="sitemap"]')].map(el => ({rel: el.rel, href: el.href, type: el.type}));
    const anchors = [...document.querySelectorAll('.footer-subscription a')].map(el => {
      const css = getComputedStyle(el), box = el.getBoundingClientRect();
      return {href: el.href, text: el.textContent.trim(), color: css.color, background: css.backgroundColor,
        opacity: css.opacity, width: box.width, height: box.height};
    });
    const footer = document.querySelector('.footer');
    return {links, anchors, language: document.documentElement.lang, scheme: document.documentElement.dataset.colorScheme,
      overflow: document.documentElement.scrollWidth > innerWidth + 1, footerBackground: getComputedStyle(footer).backgroundImage,
      footerMask: footer.classList.contains('footer--mask'), footerImage: footer.classList.contains('footer--bg')};
  });
  const routes = [expected.rss ? '/rss.xml' : null, expected.sitemap ? '/sitemap.xml' : null].filter(Boolean);
  assert.deepEqual(state.links.map(x => new URL(x.href).pathname).sort(), [...routes].sort(), 'head links must be unique');
  assert.deepEqual(state.anchors.map(x => new URL(x.href).pathname).sort(), [...routes].sort(), 'footer links must be unique');
  for (const anchor of state.anchors) {
    assert.equal(new URL(anchor.href).origin, base);
    assert.ok(anchor.width > 0 && anchor.height >= 44, 'visible accessible target');
    assert.ok(anchor.text);
    if (white) {
      assert.equal(anchor.opacity, '1');
      anchor.contrast = contrastRatio(anchor.color, anchor.background);
      assert.ok(anchor.contrast >= 4.5, 'footer text contrast must meet 4.5:1 on its opaque plate');
    }
  }
  assert.equal(state.overflow, false);
  if (white) {
    assert.equal(state.footerImage, true); assert.equal(state.footerMask, false);
    assert.ok(state.footerBackground.includes(plan.whitePath), 'actual configured white image applied');
  }
  return state;
}

async function contextCase(browser, engine, label, options, action) {
  const started = Date.now();
  let context, page, timedOut = false;
  const item = {engine, version: browser.version(), label, options, startedAt: new Date(started).toISOString(), timeoutMs: 30000, result: 'running', phase: 'new-context'};
  const errors = [], blocked = [], whiteResponses = [];
  report.cases.push(item); await persist();
  const step = async (name, operation) => {
    item.phase = name; await persist();
    if (timedOut) throw new Error('Case already timed out');
    return operation();
  };
  try {
    await withinDeadline(async () => {
      context = await browser.newContext(contextOptions(options, base));
      // A late newContext resolution after the deadline must not leak a context.
      if (timedOut) {await context.close(); return;}
      context.setDefaultTimeout(30000); context.setDefaultNavigationTimeout(30000);
      await step('request-policy', () => context.route('**/*', route => {
        const request = route.request();
        if (requestPolicy(request.url(), request.method(), base) === 'blocked') {
          blocked.push({url: request.url(), method: request.method()}); return route.abort();
        }
        return route.continue();
      }));
      page = await step('new-page', () => context.newPage());
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => {if (new URL(response.url()).pathname === plan.whitePath) whiteResponses.push({status: response.status(), contentType: response.headers()['content-type']});});
      const response = await step('initial-navigation', () => page.goto(base + '/?language=en', {waitUntil: 'networkidle', timeout: 30000}));
      assert.equal(response.status(), 200);
      if (options.javaScriptEnabled !== false) await step('app-ready', () => page.waitForFunction(() => window.MainApp?.useCommon && !document.body.classList.contains('loading')));
      const actual = await step('scenario-assertions', () => action(page, context));
      if (timedOut) throw new Error('Case completed after its deadline');
      item.actual = actual;
      assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
      if (options.javaScriptEnabled !== false) {
        assert.ok(whiteResponses.length > 0, 'Configured white footer image must actually load');
        assert.ok(whiteResponses.every(response => response.status === 200 && response.contentType?.startsWith('image/svg+xml')), 'White footer image request failed');
      }
      if (timedOut) throw new Error('Case completed after its deadline');
      item.result = 'passed';
    }, 30000, () => `${engine}/${label}/${item.phase}`, () => {timedOut = true;});
  } catch (error) {
    item.result = 'failed'; item.error = error.message;
    item.timeout = timedOut; item.url = page?.url();
    report.failures.push(engine + '/' + label + ': ' + error.message);
  } finally {
    item.errors = errors; item.blocked = blocked; item.whiteResponses = whiteResponses;
    item.executionMs = Date.now() - started; item.finishedAt = new Date().toISOString();
    // Cleanup is separately bounded; it is not evidence that a timed-out case passed.
    if (context) {
      try {await withinDeadline(() => context.close(), 5000, 'Context cleanup');}
      catch (error) {item.cleanupError = error.message; item.result = 'failed'; report.failures.push(engine + '/' + label + ': ' + error.message);}
    }
    await persist();
  }
  if ((timedOut && !context) || item.cleanupError) throw new Error('Browser teardown required after incomplete context lifecycle');
}

try {
  for (const engine of ENGINES) {
    const browser = await engines[engine].launch({headless: true, ...(engine === 'chromium' ? {channel: 'chromium'} : {})});
    try {
      const combinations = plan.full ? [[1440, 'light'], [1440, 'dark'], [390, 'light'], [390, 'dark']] : [[390, 'light']];
      for (const [width, mode] of combinations) {
        await contextCase(browser, engine, `visible-${width}-${mode}`, {viewport: {width, height: 900}, colorScheme: mode}, async page => {
          const state = await inspect(page, plan.expected, true);
          assert.equal(state.scheme, mode);
          await page.locator('.footer').scrollIntoViewIfNeeded();
          await page.screenshot({path: path.join(output, `${engine}-${width}-${mode}.png`)});
          if (plan.full) {
            state.nativeXml = [];
            for (const route of xml) {
              await page.goto(base + '/?language=en', {waitUntil: 'networkidle'});
              await page.waitForFunction(() => window.MainApp?.useCommon);
              const requests = [];
              const listener = request => {if (new URL(request.url()).pathname === route) requests.push({type: request.resourceType(), navigation: request.isNavigationRequest()});};
              page.on('request', listener);
              const anchor = page.locator(`.footer-subscription a[href="${route}"]`);
              await anchor.hover(); await anchor.focus();
              await page.waitForTimeout(100);
              assert.deepEqual(requests, [], 'hover/focus must not prefetch XML');
              const responsePromise = page.waitForResponse(r => new URL(r.url()).pathname === route && r.request().isNavigationRequest());
              await anchor.click();
              const response = await responsePromise;
              assert.equal(response.status(), 200);
              assert.ok(/(?:application|text)\/(?:rss\+)?xml/.test(response.headers()['content-type']));
              assert.deepEqual(requests, [{type: 'document', navigation: true}], 'XML must navigate natively, never fetch/PJAX');
              page.off('request', listener); state.nativeXml.push({route, requests});
            }
          }
          return state;
        });
      }
      await contextCase(browser, engine, 'native-reentry', {viewport: {width: 1440, height: 900}}, async page => {
        await page.goto(base + '/archives/', {waitUntil: 'networkidle'});
        await page.waitForFunction(() => window.MainApp?.useCommon);
        await page.evaluate(() => {window.__feedDocumentToken = 'source';});
        await page.locator('.nav-title a[href="/"]').click();
        await page.waitForURL(base + '/');
        await page.waitForFunction(() => window.MainApp?.useCommon);
        assert.equal(await page.evaluate(() => window.__feedDocumentToken), undefined, 'navigation must load a new document');
        const state = await inspect(page, plan.expected, true);
        await page.goBack(); await page.waitForURL(base + '/archives/');
        await page.waitForFunction(() => window.MainApp?.useCommon);
        await inspect(page, plan.expected, true);
        await page.goForward(); await page.waitForURL(base + '/');
        await page.waitForFunction(() => window.MainApp?.useCommon);
        await inspect(page, plan.expected, true);
        return {...state, navigationMode: 'native', historyRoundTrip: true};
      });
      if (plan.full) {
        for (const width of [1440, 390]) {
          await contextCase(browser, engine, 'no-js-' + width, {viewport: {width, height: 900}, javaScriptEnabled: false}, async page => inspect(page, plan.expected));
        }
        await contextCase(browser, engine, 'fallback-English', {viewport: {width: 390, height: 900}, locale: 'fr-FR'}, async page => {
          await page.goto(base + '/?language=fr', {waitUntil: 'networkidle'});
          const state = await inspect(page, plan.expected, true);
          assert.equal(state.language, 'en');
          assert.deepEqual(state.anchors.map(x => x.text), [fallback['ui.rssSubscribe'], fallback['ui.sitemap']]);
          assert.equal(await page.locator('.footer-subscription').getAttribute('aria-label'), fallback['ui.subscriptionLinks']);
          return state;
        });
      }
    } finally {await withinDeadline(() => browser.close(), 5000, 'Browser cleanup');}
  }
} finally {await persist();}
assert.deepEqual(report.failures, [], 'Browser acceptance failed; see report.json');
console.log(JSON.stringify({phase: plan.phase, cases: report.cases.length, report: path.join(output, 'report.json')}));
