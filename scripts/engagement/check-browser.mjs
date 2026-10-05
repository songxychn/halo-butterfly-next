/** Focused real-Halo regression; task-owned engines, explicit loopback lab only. */
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve, join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {browserEnvironment, RUNTIME, validateBaseUrl, validatePackage, sha256} from '../browser/support.mjs';

const [baseInput, labInput, outputInput, firstId = 'engagement-both'] = process.argv.slice(2);
if (!labInput || !outputInput) throw new Error('Usage: node scripts/engagement/check-browser.mjs BASE LAB_RUNTIME OUTPUT [highest-ranked-post-name]');
const lab = resolve(labInput), output = resolve(outputInput);
const identity = JSON.parse(await readFile(join(lab, 'lab.json'), 'utf8'));
const base = validateBaseUrl(baseInput, identity);
const installed = JSON.parse(await readFile(join(lab, 'installed-package.json'), 'utf8'));
const artifact = new URL('../../dist/halo-butterfly-next-0.1.0-alpha.3.zip', import.meta.url);
validatePackage(installed, execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), sha256(await readFile(artifact)));
Object.assign(process.env, browserEnvironment());
const require = createRequire(join(RUNTIME, 'deps/node_modules/playwright/package.json'));
const playwright = require('playwright');
assert.equal(require('playwright/package.json').version, '1.63.0');
await mkdir(output, {recursive: true});
const report = {sourceSha: installed.sourceCommit, artifactSha256: installed.sha256, haloVersion: '2.26.1', playwright: '1.63.0', cases: [], limitations: ['Headless touch emulation is not a physical device or real Safari.', 'Optional plugins disabled; no third-party payment request is made.']};
try {
  for (const engine of (process.env.ENGINES || 'chromium,firefox,webkit').split(',')) {
    assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
    const type = playwright[engine];
    const browser = await type.launch({headless: true, ...(engine === 'chromium' ? {executablePath: type.executablePath()} : {})});
    try {
      for (const width of [1440, 390]) for (const mode of ['light', 'dark']) {
        // macOS WebKit follows native Safari keyboard navigation: Option+Tab
        // includes controls without changing the user's system/browser prefs.
        const tabKey = engine === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
        const result = {engine, browserVersion: browser.version(), width, mode, keyboardNavigationKey: tabKey, checks: [], jsErrors: [], failedRequests: []};
        report.cases.push(result);
        const context = await browser.newContext({viewport: {width, height: width === 390 ? 844 : 1000}, hasTouch: width === 390, locale: 'zh-CN', timezoneId: 'Asia/Shanghai'});
        await context.addInitScript(value => localStorage.setItem('halo-butterfly-next.color-scheme', value), mode);
        await context.route('**/*', route => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin === base && (['GET', 'HEAD'].includes(request.method()) || request.url() === base + '/apis/api.halo.run/v1alpha1/trackers/counter')) return route.continue();
          result.failedRequests.push({url: request.url(), error: 'unexpected external/write request blocked'});
          return route.abort();
        });
        const page = await context.newPage();
        page.on('pageerror', error => result.jsErrors.push(error.message));
        page.on('requestfailed', request => result.failedRequests.push({url: request.url(), error: request.failure()?.errorText}));
        const check = async (name, operation) => {result.activeCheck = name; await operation(); result.checks.push(name); delete result.activeCheck;};
        try {
          const response = await page.goto(base + '/archives/preview-1/', {waitUntil: 'domcontentloaded'});
          assert.equal(response.status(), 200);
          await page.waitForSelector('.post-reward[data-reward-bound]');
          const button = page.locator('.reward-button'), panel = page.locator('.reward-main');
          await check('native collapsed disclosure and matching mode', async () => {
            assert.equal(await button.evaluate(el => el.tagName), 'BUTTON');
            assert.equal(await button.getAttribute('aria-expanded'), 'false');
            assert.equal(await panel.isVisible(), false);
            assert.equal(await page.evaluate(() => document.documentElement.dataset.colorScheme), mode);
            assert.equal(await page.locator('.reward-item').count(), 2);
          });
          await check('rank by shared tags before limit, exclude self and duplicates', async () => {
            const names = await page.locator('.relatedPosts-list > a').evaluateAll(els => els.map(el => el.dataset.postName));
            assert.equal(names.length, 3);
            assert.equal(names[0], firstId);
            assert.equal(new Set(names).size, names.length);
            assert.ok(!names.includes('preview-1'));
            assert.equal(await page.locator('.relatedPosts-list > template').count(), 0);
          });
          await button.scrollIntoViewIfNeeded();
          if (width === 1440) await check('hover opens temporarily; Escape dismisses stationary pointer', async () => {
            await page.locator('.relatedPosts .headline').click();
            await button.hover();
            assert.equal(await panel.isVisible(), true);
            await page.keyboard.press('Escape');
            assert.equal(await panel.isVisible(), false);
            await page.mouse.move(0, 0);
          });
          await check('Enter opens, Tab reaches close and link, Escape closes and restores focus', async () => {
            await button.focus(); await page.keyboard.press('Enter');
            assert.equal(await button.getAttribute('aria-expanded'), 'true');
            assert.equal(await panel.isVisible(), true);
            await page.keyboard.press(tabKey);
            assert.equal(await page.evaluate(() => document.activeElement.matches('.reward-close')), true);
            await page.keyboard.press(tabKey);
            assert.equal(await page.evaluate(() => document.activeElement.matches('.reward-item a')), true);
            await page.keyboard.press('Escape');
            assert.equal(await button.getAttribute('aria-expanded'), 'false');
            assert.equal(await panel.isVisible(), false);
            assert.equal(await button.evaluate(el => el === document.activeElement), true);
          });
          await check('Space toggles both ways; close button restores trigger', async () => {
            await page.keyboard.press('Space'); assert.equal(await panel.isVisible(), true);
            await page.keyboard.press('Space'); assert.equal(await panel.isVisible(), false);
            await page.keyboard.press('Enter');
            await page.locator('.reward-close').click();
            assert.equal(await panel.isVisible(), false);
            assert.equal(await button.evaluate(el => el === document.activeElement), true);
          });
          await check('pointer/touch opens and closes; outside dismissal', async () => {
            if (width === 390) {await button.tap(); assert.equal(await panel.isVisible(), true); await button.tap(); assert.equal(await panel.isVisible(), false); await button.tap();}
            else {await button.click();}
            assert.equal(await panel.isVisible(), true);
            await page.locator('.relatedPosts .headline').click();
            assert.equal(await panel.isVisible(), false);
          });
          await check('Tab leaving panel closes without moving focus back', async () => {
            await button.focus(); await page.keyboard.press('Enter');
            await page.locator('.reward-item a').last().focus();
            await page.keyboard.press(tabKey);
            assert.equal(await panel.isVisible(), false);
            assert.equal(await page.evaluate(() => !document.activeElement.closest('.post-reward')), true);
          });
          await button.focus(); await page.keyboard.press('Enter');
          await check('visible QR codes, safe native destinations, no overflow', async () => {
            await page.waitForFunction(() => [...document.querySelectorAll('.reward-item img')].every(img => img.complete && img.naturalWidth > 0));
            const state = await page.evaluate(() => ({
              width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
              bounds: [...document.querySelectorAll('.reward-pop, .reward-close, .reward-item')].map(el => {const r = el.getBoundingClientRect(); return {left:r.left,right:r.right};}),
              links: [...document.querySelectorAll('.reward-item a')].map(el => ({href:el.getAttribute('href'),rel:el.rel,target:el.target,lightbox:el.classList.contains('theme-lightbox-trigger')})),
            }));
            assert.ok(state.scrollWidth <= state.width + 1);
            assert.ok(state.bounds.every(rect => rect.left >= -1 && rect.right <= state.width + 1));
            assert.deepEqual(state.links.map(link => link.href), ['/about-preview/', '/lab/cover.svg']);
            assert.ok(state.links.every(link => link.rel.includes('noopener') && link.target === '_blank' && !link.lightbox));
          });
          await page.screenshot({path: join(output, `${engine}-${width}-${mode}-reward.png`)});
          await page.keyboard.press('Escape');
          await page.locator('.relatedPosts-list').scrollIntoViewIfNeeded();
          await check('selected covers load after mounting inert candidates', async () => {
            await page.waitForFunction(() => [...document.querySelectorAll('.relatedPosts-list img')].every(img => img.complete && img.naturalWidth > 0 && (!img.dataset.lazySrc || img.getAttribute('src') === img.dataset.lazySrc)));
          });
          await page.screenshot({path: join(output, `${engine}-${width}-${mode}-related.png`)});
          assert.deepEqual(result.jsErrors, []);
          assert.deepEqual(result.failedRequests, []);
          result.status = 'passed';
        } catch (error) {result.status = 'failed'; result.error = error.message; result.errorStack = error.stack;}
        finally {await context.close(); await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');}
      }
    } finally {await browser.close();}
  }
  report.status = report.cases.every(item => item.status === 'passed') ? 'passed' : 'failed';
  if (report.status !== 'passed') process.exitCode = 1;
} finally {await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');}
console.log(JSON.stringify({status: report.status, cases: report.cases.map(({engine,width,mode,status,error}) => ({engine,width,mode,status,error}))}, null, 2));
