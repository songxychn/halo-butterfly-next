/** Headless, task-owned Playwright only. Never connects to a user's browser. */
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {REPO, RUNTIME, ENGINES, validateBaseUrl, browserEnvironment, requestPolicy} from '../browser/support.mjs';
import {contrastRatio} from './contrast.mjs';

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
const report = {schema: 1, phase: plan.phase, base, expected: plan.expected, cases: [], failures: []};
const xml = ['/rss.xml', '/sitemap.xml'];
const persist = () => writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');

async function inspect(page, expected, white = false) {
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
  const context = await browser.newContext({...options, storageState: {cookies: [], origins: [{origin: base,
    localStorage: [{name: 'halo-butterfly-next.color-scheme', value: options.colorScheme || 'light'}]}]}});
  const item = {engine, version: browser.version(), label, options, result: 'failed'};
  const errors = [], blocked = [], whiteResponses = [];
  try {
    await context.route('**/*', route => {
      const request = route.request();
      if (requestPolicy(request.url(), request.method(), base) === 'blocked') {
        blocked.push({url: request.url(), method: request.method()}); return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {if (new URL(response.url()).pathname === plan.whitePath) whiteResponses.push({status: response.status(), contentType: response.headers()['content-type']});});
    const response = await page.goto(base + '/?language=en', {waitUntil: 'networkidle', timeout: 30000});
    assert.equal(response.status(), 200);
    if (options.javaScriptEnabled !== false) await page.waitForFunction(() => window.MainApp?.useCommon && !document.body.classList.contains('loading'));
    item.actual = await action(page, context);
    assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
    if (options.javaScriptEnabled !== false) {
      assert.ok(whiteResponses.length > 0, 'Configured white footer image must actually load');
      assert.ok(whiteResponses.every(response => response.status === 200 && response.contentType?.startsWith('image/svg+xml')), 'White footer image request failed');
    }
    item.result = 'passed';
  } catch (error) {
    item.error = error.message; report.failures.push(engine + '/' + label + ': ' + error.message);
  } finally {
    item.errors = errors; item.blocked = blocked; item.whiteResponses = whiteResponses;
    await context.close(); report.cases.push(item); await persist();
  }
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
      await contextCase(browser, engine, 'pjax-reentry', {viewport: {width: 1440, height: 900}}, async page => {
        await page.goto(base + '/archives/', {waitUntil: 'networkidle'});
        await page.waitForFunction(() => window.MainApp?.useCommon);
        const token = await page.evaluate(() => {window.__feedPjaxToken = Math.random().toString(36); window.__feedPjaxComplete = 0;
          document.addEventListener('pjax:complete', () => window.__feedPjaxComplete++); return window.__feedPjaxToken;});
        await page.locator('.nav-title a[href="/"]').click();
        await page.waitForURL(base + '/');
        await page.waitForFunction(() => window.__feedPjaxComplete === 1);
        assert.equal(await page.evaluate(() => window.__feedPjaxToken), token, 'same document must survive PJAX');
        const state = await inspect(page, plan.expected, true);
        await page.goBack(); await page.waitForURL(base + '/archives/');
        await page.waitForFunction(() => window.__feedPjaxComplete === 2);
        await inspect(page, plan.expected, true);
        await page.goForward(); await page.waitForURL(base + '/');
        await page.waitForFunction(() => window.__feedPjaxComplete === 3);
        await inspect(page, plan.expected, true);
        return {...state, pjaxEvents: 3, sameDocument: true};
      });
      if (plan.full) {
        for (const width of [1440, 390]) {
          await contextCase(browser, engine, 'no-js-' + width, {viewport: {width, height: 900}, javaScriptEnabled: false}, async page => inspect(page, plan.expected));
        }
        await contextCase(browser, engine, 'fallback-English', {viewport: {width: 390, height: 900}, locale: 'fr-FR'}, async page => {
          await page.goto(base + '/?language=fr', {waitUntil: 'networkidle'});
          const state = await inspect(page, plan.expected, true);
          assert.equal(state.language, 'en');
          assert.deepEqual(state.anchors.map(x => x.text), ['RSS feed', 'Sitemap']);
          assert.equal(await page.locator('.footer-subscription').getAttribute('aria-label'), 'Subscription and sitemap');
          return state;
        });
      }
    } finally {await browser.close();}
  }
} finally {await persist();}
assert.deepEqual(report.failures, [], 'Browser acceptance failed; see report.json');
console.log(JSON.stringify({phase: plan.phase, cases: report.cases.length, report: path.join(output, 'report.json')}));
