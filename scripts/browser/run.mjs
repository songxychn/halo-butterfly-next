import { readFile, mkdir, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { observeReloadRequests } from './reload-requests.mjs';
import { observeSearchPage } from '../search-comment/diagnostics.mjs';
import { REPO, FIXTURE, RUNTIME, ENGINES, ROUTES, COUNTER_PATH, ownRuntime, browserEnvironment, validateBaseUrl, validatePackage, responseFailure, requestPolicy, comparableAsset, boundedError, finishPage, readJson, writeJson, writeProgress, sha256 } from './support.mjs';

const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (!['--lab-runtime', '--theme-package', '--theme-source-sha', '--engines'].includes(process.argv[i]) || !process.argv[i + 1]) throw new Error('Use --lab-runtime PATH --theme-package ZIP --theme-source-sha FULL_SHA [--engines chromium,firefox,webkit], with explicit BASE_URL');
  if (options[process.argv[i]]) throw new Error('Duplicate option');
  options[process.argv[i]] = process.argv[i + 1];
}
const git = (...args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8' }).trim();
const message = boundedError;
const assert = (condition, text) => { if (!condition) throw new Error(text); };

async function settle(page) {
  let phase = 'fonts-and-loading';
  try {
    await page.waitForFunction(() => document.fonts.status === 'loaded' && !document.body.classList.contains('loading'), null, { timeout: 15000 });
    phase = 'finite-animations';
    await page.waitForFunction(() => document.getAnimations().every(animation => {
      const timing = animation.effect?.getComputedTiming();
      return timing?.iterations === Infinity || !Number.isFinite(timing?.endTime) || ['finished', 'idle'].includes(animation.playState);
    }), null, { timeout: 15000 });
    phase = 'visible-images';
    await page.waitForFunction(() => [...document.images].every(image => {
      const r = image.getBoundingClientRect(), s = getComputedStyle(image);
      if (s.display === 'none' || s.visibility !== 'visible' || r.width <= 0 || r.height <= 0 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return true;
      const lazy = image.getAttribute('data-lazy-src');
      return image.complete && image.naturalWidth > 0 && (!lazy || image.currentSrc === new URL(lazy, location.href).href);
    }), null, { timeout: 15000 });
  } catch (error) {
    error.readinessFailure = { phase };
    let timer;
    try {
      error.readinessFailure.state = await Promise.race([page.evaluate(() => ({
        readyState: document.readyState, fontStatus: document.fonts.status,
        loading: document.body.classList.contains('loading'),
        fonts: [...document.fonts].map(font => ({family: font.family, status: font.status})),
        finiteAnimations: document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => ({playState: animation.playState, timing: animation.effect?.getComputedTiming()})),
        visibleImages: [...document.images].filter(image => { const r = image.getBoundingClientRect(), style = getComputedStyle(image); return style.display !== 'none' && style.visibility === 'visible' && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }).map(image => ({src: image.currentSrc, lazy: image.getAttribute('data-lazy-src'), complete: image.complete, width: image.naturalWidth, height: image.naturalHeight}))
      })), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Readiness snapshot timed out')), 2000); })]);
    } catch (snapshotError) { error.readinessFailure.snapshotError = message(snapshotError); }
    finally { clearTimeout(timer); }
    throw error;
  }
  return page.evaluate(() => ({
    fontStatus: document.fonts.status,
    ignoredInfiniteAnimations: document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations === Infinity).length,
    visibleImages: [...document.images].filter(image => { const r = image.getBoundingClientRect(), s = getComputedStyle(image); return s.display !== 'none' && s.visibility === 'visible' && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }).map(image => ({ src: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight }))
  }));
}

async function keyboardChecks(page, width, requests) {
  const checks = [];
  if (width === 390) {
    await page.locator('.nav .bars').focus();
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.querySelector('.side-bar')?.classList.contains('active'));
    const open = await page.locator('.nav .bars').getAttribute('aria-expanded');
    assert(open === 'true', 'Mobile menu did not expose expanded state after Space');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.side-bar')?.classList.contains('active'));
    assert(await page.evaluate(() => document.activeElement?.classList.contains('bars')), 'Escape did not return focus to menu control');
    checks.push({ name: 'mobile-space-open-escape-close-focus', result: 'passed' });
  }
  const initial = await page.getAttribute('html', 'data-color-scheme');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => {
    const button = document.querySelector('#rightside-config');
    if (!button) return false;
    const r = button.getBoundingClientRect();
    return r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && Number(getComputedStyle(button.closest('#rightside')).opacity) > 0;
  });
  await page.locator('#rightside-config').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#rightside-config-hide')?.classList.contains('show'));
  await settle(page);
  const control = page.locator('#darkmode');
  assert(await control.isVisible(), 'Theme mode control is hidden after opening settings');
  const box = await control.boundingBox(), viewport = page.viewportSize();
  assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, 'Theme mode control is outside viewport');
  await control.focus();
  await page.keyboard.press('Enter');
  const changed = initial === 'light' ? 'dark' : 'light';
  await page.waitForFunction(mode => document.documentElement.dataset.colorScheme === mode, changed);
  await requests.reload(() => page.reload({ waitUntil: 'domcontentloaded' }));
  await settle(page);
  assert(await page.getAttribute('html', 'data-color-scheme') === changed, 'Theme mode did not survive reload');
  checks.push({ name: 'settings-and-mode-keyboard-enter-and-storage-reload', result: 'passed', before: initial, after: changed });
  return checks;
}

async function codeCollapseChecks(page) {
  const block = page.locator('.code-toolbar').first();
  const button = block.locator('.code-expander');
  const original = await block.locator('pre code').textContent();
  assert(await button.getAttribute('aria-expanded') === 'true', 'Fixture code must start expanded');
  await button.click();
  assert(await button.getAttribute('aria-expanded') === 'false', 'Code did not collapse');
  assert(!await block.locator('pre').isVisible(), 'Collapsed code body remains visible');
  await page.mouse.move(0, 0);
  await page.keyboard.press('Tab');
  assert(await block.evaluate(element => !element.matches(':hover') && !element.matches(':focus-within')), 'Toolbar visibility check must not retain hover or focus');
  await page.waitForTimeout(350); // Let Prism's real opacity transition finish.
  const toolbar = await block.locator('.toolbar').evaluate(element => {
    const box = element.getBoundingClientRect(), parent = element.parentElement.getBoundingClientRect();
    return { opacity: getComputedStyle(element).opacity, height: box.height,
      contained: box.top >= parent.top && box.bottom <= parent.bottom };
  });
  assert(toolbar.opacity === '1' && toolbar.height > 0 && toolbar.contained, 'Collapsed toolbar is hidden or clipped');
  await button.click({ timeout: 5000 }); // Real hit-testing; no forced click or DOM dispatch.
  assert(await button.getAttribute('aria-expanded') === 'true' && await block.locator('pre').isVisible(), 'Pointer cannot reopen collapsed code');
  await button.focus();
  await page.keyboard.press('Enter');
  assert(await button.getAttribute('aria-expanded') === 'false', 'Enter did not collapse code');
  await page.keyboard.press('Space');
  assert(await button.getAttribute('aria-expanded') === 'true' && await block.locator('pre').isVisible(), 'Space cannot reopen collapsed code');
  assert(await block.locator('pre code').textContent() === original, 'Collapse changed code content');
  return [{ name: 'code-collapse-pointer-keyboard-roundtrip', result: 'passed', toolbar }];
}

async function main() {
  for (const name of ['--lab-runtime', '--theme-package', '--theme-source-sha']) assert(options[name], `${name} is required`);
  const labRuntime = await realpath(options['--lab-runtime']);
  const base = validateBaseUrl(process.env.BASE_URL, await readJson(path.join(labRuntime, 'lab.json')));
  const installedPath = path.join(labRuntime, 'installed-package.json');
  const installed = await readJson(installedPath);
  const packagePath = await realpath(options['--theme-package']);
  const packageHash = sha256(await readFile(packagePath));
  validatePackage(installed, options['--theme-source-sha'], packageHash);
  assert(git('cat-file', '-t', options['--theme-source-sha']) === 'commit', 'Theme source SHA does not identify a repository commit');
  const engines = options['--engines']?.split(',') || ENGINES;
  assert(engines.length && new Set(engines).size === engines.length && engines.every(name => ENGINES.includes(name)), 'Invalid or duplicate engine selection');
  await ownRuntime();
  Object.assign(process.env, browserEnvironment());
  const fixture = await readJson(path.join(FIXTURE, 'package.json'));
  const installation = await readJson(path.join(RUNTIME, 'installation.json'));
  assert(installation.version === fixture.dependencies.playwright && installation.lockSha256 === sha256(await readFile(path.join(FIXTURE, 'pnpm-lock.yaml'))), 'Run browser/install.mjs again: fixture/install lock differs');
  const actual = await readJson(path.join(RUNTIME, 'deps/node_modules/playwright/package.json'));
  assert(actual.version === fixture.dependencies.playwright, 'Installed package version differs from fixture');
  const playwright = await import(pathToFileURL(path.join(RUNTIME, 'deps/node_modules/playwright/index.mjs')));
  const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8);
  const output = path.join(RUNTIME, 'runs', id);
  await mkdir(output);
  const report = {
    schema: 1, runId: id, startedAt: new Date().toISOString(),
    runner: { sourceCommit: git('rev-parse', 'HEAD'), workingTreeClean: !git('status', '--porcelain'), playwright: actual.version, packageManager: fixture.packageManager, lockSha256: installation.lockSha256, browserRegistry: installation.engines },
    theme: { sourceCommit: options['--theme-source-sha'], packageSha256: packageHash, packageName: path.basename(packagePath), attribution: 'Caller declaration matched to local lab installation record; source-to-build proof remains separate' },
    platform: { type: os.type(), release: os.release(), version: os.version(), arch: os.arch(), node: process.version, ...(process.platform === 'darwin' ? { macOS: execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim() } : {}) },
    target: { baseUrl: base, fixtureProfile: 'comparison lab core routes; plugin profile not certified', allowedWrite: { method: 'POST', path: COUNTER_PATH, purpose: 'Normal public page visit count in the owned synthetic lab; counts may increase' } },
    engines: [], expectedPagesPerEngine: ROUTES.length * 4, omittedEngines: ENGINES.filter(name => !engines.includes(name)), contractAcceptance: false,
    limitations: [
      'Playwright Chromium/Firefox/WebKit builds are not branded stable Chrome/Firefox/Safari; WebKit is not actual Safari and viewport emulation is not a physical device.',
      'Core ten routes only. P+ plugins, full supported interactions, touch devices and manual visual/a11y judgment remain untested; BROWSER-04 is not completed by this smoke suite.',
      'Same-origin GET/HEAD plus the exact public Halo visit-counter POST are allowed. Synthetic visit counts may increase. All other writes, WebSockets and external resources are blocked; broader analytics/external services remain untested.',
      'Screenshots await finite animations and visible images without CSS injection. Infinite animations are counted, not stopped; offscreen lazy images are not claimed loaded.',
      'Playwright response-body hashes describe decoded browser API bytes, not wire compression bytes. CSS/JS package comparison removes only an optional UTF-8 BOM on either side; original hashes remain recorded.',
      'Keyboard mode/mobile-menu checks run on the home route; exhaustive submenu focus containment remains a separate navigation contract.'
    ]
  };
  const snapshot = async () => {
    await writeProgress(output, report.engines.reduce((sum, engine) => sum + engine.pages.length, 0), { runId: report.runId, engines: report.engines.map(engine => ({ name: engine.name, status: engine.status, pages: engine.pages.length, failedPages: engine.pages.filter(page => page.status === 'failed').length, error: engine.error })) });
  };
  const expectedAsset = new Map();
  function assetBytes(url) {
    const name = decodeURIComponent(new URL(url).pathname);
    const prefix = '/themes/halo-butterfly-next/assets/';
    if (!name.startsWith(prefix)) return null;
    const entry = 'templates/assets/' + name.slice(prefix.length);
    if (!expectedAsset.has(entry)) expectedAsset.set(entry, execFileSync('unzip', ['-p', packagePath, entry], { maxBuffer: 30 * 1024 * 1024 }));
    return expectedAsset.get(entry);
  }
  for (const name of engines) {
    const engine = { name, distribution: 'Playwright bundled automation build', status: 'running', pages: [] };
    report.engines.push(engine);
    let browser;
    try {
      const executable = await realpath(playwright[name].executablePath());
      assert(executable.startsWith(path.join(RUNTIME, 'browsers') + path.sep), 'Browser executable escaped task runtime');
      engine.executableSha256 = sha256(await readFile(executable));
      browser = await playwright[name].launch({ headless: true, ...(name === 'chromium' ? { channel: 'chromium' } : {}), timeout: 30000, env: browserEnvironment() });
      engine.version = browser.version();
    } catch (error) {
      engine.status = 'unavailable'; engine.error = message(error); await snapshot();
      console.log(name, 'unavailable:', engine.error); continue;
    }
    try {
      for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) for (const mode of ['light', 'dark']) for (const route of ROUTES) {
        const result = { path: route, viewport, mode, status: 'running', resources: [], allowedWrites: [], blockedRequests: [], requestFailures: [], jsErrors: [], failures: [] };
        engine.pages.push(result);
        const context = await browser.newContext({ viewport, colorScheme: mode, reducedMotion: 'no-preference', locale: 'zh-CN', timezoneId: 'Asia/Shanghai', serviceWorkers: 'block', acceptDownloads: false, storageState: { cookies: [], origins: [{ origin: base, localStorage: [{ name: 'halo-butterfly-next.color-scheme', value: mode }] }] } });
        const pending = [];
        await context.route('**/*', async requestRoute => {
          const request = requestRoute.request(), policy = requestPolicy(request.url(), request.method(), base);
          if (policy === 'blocked') {
            result.blockedRequests.push({ url: request.url(), method: request.method() });
            return requestRoute.abort('blockedbyclient');
          }
          if (policy === 'visit-counter') result.allowedWrites.push({ url: request.url(), method: request.method(), purpose: 'Halo public visit counter', bodySha256: sha256(request.postData() || '') });
          return requestRoute.continue();
        });
        await context.routeWebSocket('**/*', socket => { result.blockedRequests.push({ url: socket.url(), method: 'WEBSOCKET' }); socket.close(); });
        const page = await context.newPage();
        const diagnostics = observeSearchPage(page, `${name}-${viewport.width}-${mode}-${route}`);
        result.diagnostics = diagnostics.report;
        page.setDefaultTimeout(15000);
        page.on('pageerror', error => result.jsErrors.push({ message: message(error), stack: String(error.stack || '').slice(0, 5000) }));
        const requests = observeReloadRequests(page, result);
        page.on('response', response => pending.push((async () => {
          const type = response.request().resourceType(), contentType = response.headers()['content-type'] || '';
          const item = { url: response.url(), type, status: response.status(), contentType, contentEncoding: response.headers()['content-encoding'] || null };
          result.resources.push(item);
          requests.response(response.request(), item);
          const failure = responseFailure(item.status, contentType, type);
          if (failure) item.failure = failure;
          if (['stylesheet', 'script', 'image', 'font', 'media'].includes(type) && response.status() === 200) {
            let body;
            try { body = await response.body(); }
            catch (error) { requests.captureError(response.request(), item, error); return; }
            requests.bodyComplete(response.request());
            item.sha256 = sha256(body);
            const expected = assetBytes(item.url);
            if (expected) {
              item.packageAssetSha256 = sha256(expected);
              item.comparableBodySha256 = sha256(comparableAsset(body, type));
              item.comparablePackageSha256 = sha256(comparableAsset(expected, type));
              if (item.comparableBodySha256 !== item.comparablePackageSha256) item.failure = 'Response asset differs from declared installed theme package';
            }
          }
        })().catch(error => result.failures.push('Resource capture: ' + message(error)))));
        try {
          const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
          assert(response?.status() === 200 && new URL(page.url()).origin === base && new URL(page.url()).pathname === route, 'Core route status, origin or pathname mismatch');
          result.httpStatus = response.status();
          assert(!result.jsErrors.length, 'Page script failed before readiness');
          result.readiness = await settle(page);
          result.dom = await page.evaluate(() => ({ title: document.title, titleCount: document.querySelectorAll('title').length, themeRoot: !!document.querySelector('#Butterfly'), mode: document.documentElement.dataset.colorScheme, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1, documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, desktopMenuLinks: document.querySelectorAll('.nav .menu a').length, mobileMenuLinks: document.querySelectorAll('.side-bar menu a').length, userAgent: navigator.userAgent }));
          assert(result.dom.themeRoot && result.dom.titleCount === 1 && result.dom.title, 'Core route did not render a unique theme document/title');
          assert(result.dom.mode === mode, 'Theme mode differs from context storage state');
          assert(!result.dom.horizontalOverflow, 'Horizontal overflow detected');
          assert(result.dom.desktopMenuLinks > 0 && result.dom.mobileMenuLinks > 0, 'Rendered navigation is empty');
          const filename = `${name}-${viewport.width}-${mode}-${ROUTES.indexOf(route)}.png`;
          const bytes = await page.screenshot({ path: path.join(output, filename), fullPage: false, animations: 'allow' });
          result.screenshot = { path: filename, sha256: sha256(bytes) };
          if (route === '/') result.keyboard = await keyboardChecks(page, viewport.width, requests);
          if (route === '/archives/preview-1/') result.codeCollapse = await codeCollapseChecks(page);
        } catch (error) {
          result.failures.push(message(error));
          if (error.readinessFailure) result.readinessFailure = error.readinessFailure;
          result.diagnostics.failure = await diagnostics.snapshot();
          if (!result.screenshot) {
            try {
              const filename = `${name}-${viewport.width}-${mode}-${ROUTES.indexOf(route)}-diagnostic.png`;
              const bytes = await page.screenshot({ path: path.join(output, filename), fullPage: false, animations: 'allow', timeout: 5000 });
              result.screenshot = { path: filename, sha256: sha256(bytes), diagnosticOnly: true, readinessCertified: false };
            } catch (captureError) { result.screenshotError = message(captureError); }
          }
        }
        await diagnostics.finish(); // Bounded final state before the context closes.
        await finishPage(result, pending, () => context.close(), 5000, () => requests.exemptions());
        await writeJson(path.join(output, `${name}-${viewport.width}-${mode}-${ROUTES.indexOf(route)}.json`), result);
        console.log(`${name} ${viewport.width} ${mode} ${route} ${result.status}`);
        await snapshot();
      }
      engine.status = engine.pages.length === report.expectedPagesPerEngine && engine.pages.every(page => page.status === 'passed') ? 'passed' : 'failed';
    } catch (error) { engine.status = 'failed'; engine.error = message(error); }
    finally { await browser.close(); }
  }
  const finalInstalled = await readJson(installedPath);
  report.installationRecordUnchanged = JSON.stringify(finalInstalled) === JSON.stringify(installed);
  report.finishedAt = new Date().toISOString();
  report.result = !report.installationRecordUnchanged || report.engines.some(engine => engine.status === 'failed') ? 'failed' : report.omittedEngines.length || report.engines.some(engine => engine.status !== 'passed') ? 'incomplete' : 'passed-core-smoke';
  await writeJson(path.join(output, 'report.json'), report);
  console.log(JSON.stringify({ report: path.join(output, 'report.json'), result: report.result, contractAcceptance: false }));
  process.exitCode = report.result === 'passed-core-smoke' ? 0 : report.result === 'incomplete' ? 2 : 1;
}

main().catch(error => { console.error('Browser matrix failed:', message(error)); process.exitCode = 1; });
