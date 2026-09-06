import { readFile, mkdir, writeFile, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { sha256, readJson, writeJson, requestPolicy, responseFailure, finishPage, comparableAsset, validatePackage } from '../browser/support.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const options = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, all) => i % 2 ? pairs : [...pairs, [value, all[i + 1]]], []));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const git = (...args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8' }).trim();
const OWNER = 'halo-butterfly-next-plugin-lab';
export const canonical = value => JSON.stringify(Array.isArray(value) ? value.map(x => JSON.parse(canonical(x))) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))])) : value);
export function disabledApiUnavailable(status, location) {
  return status === 404 || (status === 302 && location === '/login?authentication_required');
}

export function validateTarget(marker, owner, runtime) {
  assert(marker?.owner === 'halo-butterfly-next-comparison' && marker.schema === 1, 'Comparison marker required');
  assert(owner?.owner === OWNER && owner.runtime === runtime && JSON.stringify(owner.ports) === JSON.stringify(marker.ports), 'P+ owner/ports mismatch');
  assert(Number.isInteger(marker.ports.halo) && Number.isInteger(marker.ports.hexo) && marker.ports.halo !== marker.ports.hexo && Object.values(marker.ports).every(x => x >= 1024 && x <= 65535), 'Invalid isolated ports');
  return Object.fromEntries(Object.entries(marker.ports).map(([name, port]) => [name, `http://127.0.0.1:${port}`]));
}

async function settle(page) {
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Font readiness timed out')), 10000))]));
  // Move through real scroll positions so lazy content is requested without modifying CSS.
  for (let i = 0; i < 8; i++) {
    const end = await page.evaluate(index => { scrollTo(0, index * innerHeight * .8); return scrollY + innerHeight >= document.documentElement.scrollHeight; }, i);
    await page.waitForTimeout(180);
    if (end) break;
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(() => document.getAnimations().every(a => a.effect?.getComputedTiming().iterations === Infinity || a.playState === 'finished'), null, { timeout: 6000 }).catch(() => {});
  await page.waitForFunction(() => [...document.images].filter(img => { const r = img.getBoundingClientRect(); return r.width && r.height && r.left < innerWidth && r.right > 0 && r.top < innerHeight && r.bottom > 0 && img.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }); }).every(img => img.complete && img.naturalWidth > 0 && (!img.dataset.lazySrc || new URL(img.currentSrc).pathname === new URL(img.dataset.lazySrc, location.href).pathname)), null, { timeout: 8000 });
}

async function inspectPage(browser, base, route, variant, output, index, packagePath, expectedCount) {
  const result = { baseUrl: base, path: route.path, kind: route.kind, viewport: variant.viewport, mode: variant.mode, expectedCount, failures: [], resources: [], jsErrors: [], consoleErrors: [], blockedRequests: [], requestFailures: [], allowedWrites: [], interactions: [] };
  const context = await browser.newContext({ viewport: variant.viewport, colorScheme: variant.mode, timezoneId: 'Asia/Shanghai', locale: 'zh-CN', serviceWorkers: 'block', acceptDownloads: false, storageState: { cookies: [], origins: [{ origin: base, localStorage: [{ name: 'halo-butterfly-next.color-scheme', value: variant.mode }, { name: 'theme', value: JSON.stringify({ value: variant.mode, expiry: Date.now() + 86400000 }) }] }] } });
  const pending = [];
  await context.route('**/*', async r => {
    const req = r.request(), policy = requestPolicy(req.url(), req.method(), base);
    if (policy === 'blocked') { result.blockedRequests.push({ url: req.url(), method: req.method() }); return r.abort('blockedbyclient'); }
    if (policy === 'visit-counter') result.allowedWrites.push({ url: req.url(), method: req.method(), bodySha256: sha256(req.postData() || '') });
    return r.continue();
  });
  await context.routeWebSocket('**/*', socket => { result.blockedRequests.push({ url: socket.url(), method: 'WebSocket' }); socket.close(); });
  const page = await context.newPage(); page.setDefaultTimeout(9000);
  page.on('pageerror', error => result.jsErrors.push({ message: error.message, stack: error.stack }));
  page.on('console', entry => { if (entry.type() === 'error') result.consoleErrors.push(entry.text()); });
  page.on('requestfailed', request => result.requestFailures.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => pending.push((async () => {
    const type = response.request().resourceType();
    const item = { url: response.url(), status: response.status(), resourceType: type, contentType: response.headers()['content-type'] || '' };
    item.failure = responseFailure(item.status, item.contentType, type);
    if (type === 'document' && route.expectedStatus === item.status) item.failure = null;
    try {
      if (!['document', 'stylesheet', 'script', 'image', 'font', 'fetch', 'xhr'].includes(type)) return;
      const body = await response.body(); item.sha256 = sha256(body); item.bytes = body.length;
      const prefix = '/themes/halo-butterfly-next/assets/', pathname = new URL(item.url).pathname;
      if (pathname.startsWith(prefix) && item.status === 200) {
        const bytes = execFileSync('unzip', ['-p', packagePath, 'templates/assets/' + decodeURIComponent(pathname.slice(prefix.length))], { maxBuffer: 40 * 1024 * 1024 });
        item.packageSha256 = sha256(bytes);
        if (!comparableAsset(bytes, type).equals(comparableAsset(body, type))) item.failure = 'Installed asset differs from declared package';
      }
    } catch (error) { item.failure = 'Resource body check: ' + error.message; }
    result.resources.push(item);
  })()));
  try {
    const response = await page.goto(base + route.path, { waitUntil: 'domcontentloaded' });
    result.httpStatus = response.status(); result.finalUrl = page.url();
    if (result.httpStatus !== (route.expectedStatus || 200)) result.failures.push('Unexpected page HTTP status');
    if (result.httpStatus === 200) {
      await settle(page);
      result.dom = await page.evaluate(({ selector, kind }) => ({ title: document.title, h1: [...document.querySelectorAll('h1')].map(x => x.textContent), count: document.querySelectorAll(selector).length,
        texts: [...document.querySelectorAll(selector)].map(x => x.textContent.trim() || x.getAttribute('alt')),
        links: [...document.querySelectorAll('main a,.main a,#article-container a')].map(x => ({ text: x.textContent.trim(), href: x.getAttribute('href') })),
        images: [...document.querySelectorAll(selector + ' img')].map(x => ({ src: x.currentSrc, alt: x.alt, naturalWidth: x.naturalWidth })),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        activeFiniteAnimations: document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity && a.playState !== 'finished').length,
        infiniteAnimations: document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations === Infinity).length,
        colorScheme: document.documentElement.getAttribute('data-color-scheme') || document.documentElement.getAttribute('data-theme'), kind }), route);
      if (expectedCount !== null && result.dom.count !== expectedCount) result.failures.push(`Rendered content count ${result.dom.count}, expected ${expectedCount}`);
      if (route.site === 'halo' && route.allowedTexts && result.dom.texts.some(text => !route.allowedTexts.some(expected => text.includes(expected)))) result.failures.push('Rendered content text is outside the expected fixture subset');
      if (result.dom.horizontalOverflow) result.failures.push('Horizontal page overflow');
      if (result.dom.colorScheme !== variant.mode) result.failures.push('Actual page color scheme differs from requested scenario');
      if (result.dom.activeFiniteAnimations) result.failures.push('Finite animations did not settle');
      if (route.requireNext && !result.dom.links.some(x => x.href && new URL(x.href, base).href === base + route.requireNext)) result.failures.push('No rendered next-page link to ' + route.requireNext);
      if (route.kind === 'photos' && route.site === 'halo' && result.dom.count > 0) {
        try {
          const trigger = page.locator('.content [data-fancybox]').first(); await trigger.click();
          await page.locator('.fancybox__container').waitFor({ state: 'visible' });
          await page.keyboard.press('Escape'); await page.locator('.fancybox__container').waitFor({ state: 'detached' });
          result.interactions.push({ name: 'lightbox-open-escape-close', result: 'passed' });
        } catch (error) { result.failures.push('Photo lightbox: ' + error.message); }
      }
    }
  } catch (error) { result.failures.push(error.message); }
  try {
    const html = await page.content(); await writeFile(path.join(output, index + '.html'), html, { flag: 'wx' }); result.htmlSha256 = sha256(html);
    const screenshot = path.join(output, index + '.png'); await page.screenshot({ path: screenshot, fullPage: true, timeout: 15000 }); result.screenshot = { file: path.basename(screenshot), sha256: sha256(await readFile(screenshot)), diagnosticOnly: result.failures.length > 0 };
  } catch (error) { result.failures.push('Artifact capture: ' + error.message); }
  await finishPage(result, pending, () => context.close());
  if (result.screenshot) result.screenshot.diagnosticOnly = result.status !== 'passed';
  return result;
}

function routesFor(state, stage) {
  const shape = state.resources || {}, counts = Object.fromEntries(Object.entries(shape).map(([k, values]) => [k, values.length]));
  const result = ['links', 'photos', 'moments'].flatMap(kind => [
    { site: 'halo', kind, path: '/' + kind, selector: { links: '.main > .content .groups a.link', photos: '.main > .content .imgs img', moments: '.main > .content .list > .item' }[kind], count: Math.min(counts[kind] || 0, { links: Infinity, photos: 20, moments: 10 }[kind]), ...(stage === 'disabled' ? { expectedStatus: 404 } : {}) },
    { site: 'hexo', kind, path: '/' + kind + '/', selector: { links: '.flink-list-item', photos: '.gallery-container .item', moments: '.shuoshuo-item' }[kind], count: Math.min(counts[kind] || 0, kind === 'links' ? Infinity : 10) }
  ]);
  if (stage !== 'disabled' && (counts.photos || 0) > 20) {
    result.find(x => x.site === 'halo' && x.kind === 'photos').requireNext = '/photos?page=2';
    result.push({ site: 'halo', kind: 'photos', path: '/photos?page=2', selector: '.content .imgs img', count: counts.photos - 20 });
  }
  if (stage !== 'disabled' && (counts.moments || 0) > 10) {
    result.find(x => x.site === 'halo' && x.kind === 'moments').requireNext = '/moments/page/2';
    result.push({ site: 'halo', kind: 'moments', path: '/moments/page/2', selector: '.content .list > .item', count: counts.moments - 10 });
  }
  if (stage !== 'disabled' && (counts.photogroups || 0) > 1) result.push({ site: 'halo', kind: 'photos', path: '/photos?group=pplus-group-a', selector: '.content .imgs img', count: shape.photos.filter(x => x.spec.groupName === 'pplus-group-a').length });
  for (const route of result) {
    const items = (shape[route.kind] || []).filter(x => !route.path.includes('group=pplus-group-a') || x.spec.groupName === 'pplus-group-a');
    route.allowedTexts = items.map(x => route.kind === 'moments' ? x.spec.content.html.replace(/<[^>]*>/g, '') : x.spec.displayName);
  }
  return result;
}

async function main() {
  for (const name of ['--lab-runtime', '--browser-runtime', '--theme-package', '--theme-source-sha']) assert(options[name], name + ' required');
  assert(!process.env.SELENIUM_REMOTE_URL, 'Remote browser connections prohibited');
  const runtime = await realpath(options['--lab-runtime']), browserRuntime = await realpath(options['--browser-runtime']);
  const marker = await readJson(path.join(runtime, 'lab.json')), owner = await readJson(path.join(runtime, 'plugins-owner.json'));
  const bases = validateTarget(marker, owner, runtime);
  for (const name of ['halo', 'hexo']) {
    const processState = await readJson(path.join(runtime, name + '-process.json'));
    assert(execFileSync('ps', ['-p', String(processState.pid), '-o', 'command='], { encoding: 'utf8' }).includes(processState.identity), 'Owned process is not running');
  }
  const browserOwner = await readJson(path.join(browserRuntime, 'owner.json'));
  assert(browserOwner.owner === 'halo-butterfly-next-browser-matrix' && browserOwner.schema === 1, 'Pinned browser runtime owner required');
  const installation = await readJson(path.join(browserRuntime, 'installation.json'));
  const pinned = await readJson(path.join(REPO, 'fixtures/browser/package.json'));
  assert(installation.version === pinned.dependencies.playwright && installation.lockSha256 === sha256(await readFile(path.join(REPO, 'fixtures/browser/pnpm-lock.yaml'))), 'Browser install lock mismatch');
  const actualPlaywright = await readJson(path.join(browserRuntime, 'deps/node_modules/playwright/package.json'));
  assert(actualPlaywright.version === pinned.dependencies.playwright, 'Actual Playwright package differs from lock');
  const packagePath = await realpath(options['--theme-package']), packageHash = sha256(await readFile(packagePath));
  const installed = await readJson(path.join(runtime, 'installed-package.json'));
  validatePackage(installed, options['--theme-source-sha'], packageHash);
  assert(git('cat-file', '-t', options['--theme-source-sha']) === 'commit', 'Theme source declaration is not a local repository commit');
  const lock = await readJson(path.join(REPO, 'fixtures/plugins/versions.json'));
  assert(owner.lockSha256 === sha256(canonical(lock)), 'Plugin lock identity mismatch');
  for (const plugin of lock.plugins) assert(sha256(await readFile(path.join(runtime, 'halo/data/plugins', `${plugin.name}-${plugin.version}.jar`))) === plugin.sha256, 'Installed plugin JAR differs from lock');
  const output = path.join(runtime, 'plugin-evidence', new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8));
  await mkdir(path.join(output, 'tmp'), { recursive: true });
  const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(browserRuntime, 'browsers'), PLAYWRIGHT_SKIP_BROWSER_GC: '1', TMPDIR: path.join(output, 'tmp') };
  Object.assign(process.env, { PLAYWRIGHT_BROWSERS_PATH: env.PLAYWRIGHT_BROWSERS_PATH, PLAYWRIGHT_SKIP_BROWSER_GC: '1' });
  const playwright = await import(pathToFileURL(path.join(browserRuntime, 'deps/node_modules/playwright/index.mjs')));
  const executable = await realpath(playwright.chromium.executablePath());
  assert(executable.startsWith(path.join(browserRuntime, 'browsers') + path.sep), 'Browser executable outside owned cache');
  const browser = await playwright.chromium.launch({ channel: 'chromium', headless: true, env });
  const stage = options['--stage'] || owner.scenario;
  assert(['empty', 'normal', 'populated', 'disabled'].includes(stage), 'Explicit valid fixture stage required');
  assert(stage === 'disabled' || stage === owner.scenario, 'Stage differs from owned fixture content');
  assert(!options['--profile'] || ['smoke', 'full'].includes(options['--profile']), 'Invalid diagnostic profile');
  const report = { schema: 1, startedAt: new Date().toISOString(), stage, runner: { sourceCommit: git('rev-parse', 'HEAD'), workingTreeClean: !git('status', '--porcelain'), playwright: installation.version, lockSha256: installation.lockSha256 },
    product: { sourceCommit: options['--theme-source-sha'], sha256: packageHash }, browser: { name: 'Playwright Chromium', version: browser.version(), executableSha256: sha256(await readFile(executable)), headless: true },
    platform: { os: os.type(), release: os.release(), arch: os.arch() }, plugins: lock.plugins, target: bases, api: [], pages: [], failures: [], contractAcceptance: false,
    limitations: ['First contract diagnostic only. No complete PLG-01/04/06 acceptance.', 'No actual stable Safari/Firefox or physical-device coverage.', 'Absent rendered state, below-minimum plugin versions, broken media/long content, permission interactions and comment/content/SEO combinations remain untested.', 'Same-origin reads and exact public visit-counter POST only; synthetic counters may increase. Other writes, external origins and WebSockets blocked.'] };
  try {
    for (const [kind, apiPath] of [['links', '/apis/api.link.halo.run/v1alpha1/links?page=1&size=100'], ['photos', '/apis/api.photo.halo.run/v1alpha1/photos?page=1&size=100'], ['moments', '/apis/api.moment.halo.run/v1alpha1/moments?page=1&size=100']]) {
      const response = await fetch(bases.halo + apiPath, { redirect: 'manual', signal: AbortSignal.timeout(30000) }), text = await response.text();
      let body; try { body = JSON.parse(text); } catch {}
      const expected = owner.resources[kind], actual = body?.items;
      const failures = [];
      if (stage === 'disabled') { if (!disabledApiUnavailable(response.status, response.headers.get('location'))) failures.push('Disabled API is not unavailable or has an unexpected redirect'); }
      else if (response.status !== 200 || !Array.isArray(actual) || body.total !== expected.length) failures.push('Public API status/total differs from fixture');
      else for (const item of expected) {
        const found = actual.find(x => x.metadata.name === item.metadata.name);
        const keys = kind === 'moments' ? ['content', 'owner', 'releaseTime', 'visible', 'tags'] : ['displayName', 'url', 'groupName', ...(kind === 'links' ? ['logo', 'description'] : ['cover', 'description', 'tags'])];
        if (!found || keys.some(key => canonical(found.spec[key]) !== canonical(item.spec[key]))) failures.push('Public model mismatch: ' + item.metadata.name);
      }
      report.api.push({ kind, path: apiPath, status: response.status, location: response.headers.get('location'), sha256: sha256(text), body, failures });
    }
    const variants = options['--profile'] === 'smoke' ? [{ viewport: { width: 1440, height: 1000 }, mode: 'light' }] : [{ width: 1440, height: 1000 }, { width: 390, height: 844 }].flatMap(viewport => ['light', 'dark'].map(mode => ({ viewport, mode })));
    for (const route of routesFor(owner, stage)) for (const variant of variants) {
      const result = await inspectPage(browser, bases[route.site], route, variant, output, String(report.pages.length).padStart(3, '0'), packagePath, route.expectedStatus === 404 ? null : route.count);
      report.pages.push(result); console.log(route.site, route.path, variant.viewport.width, variant.mode, result.status);
    }
  } catch (error) {
    report.failures.push(error.message); throw error;
  } finally {
    await browser.close(); report.finishedAt = new Date().toISOString(); report.status = report.failures.length || report.api.some(x => x.failures.length) || report.pages.some(x => x.status !== 'passed') ? 'diagnostic-findings' : 'passed-with-limitations';
    await writeJson(path.join(output, 'report.json'), report); console.log('P+ evidence:', path.join(output, 'report.json'));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error('P+ diagnosis error:', error.message); process.exitCode = 1; });
