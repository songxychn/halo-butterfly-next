// Independent headless engines only; never attach to an existing browser.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { REPO, RUNTIME, browserEnvironment, requestPolicy, responseFailure, validateBaseUrl } from '../browser/support.mjs';

const manifest = JSON.parse(await readFile(process.argv[2], 'utf8'));
const lab = process.env.LAB_RUNTIME;
if (!lab) throw new Error('Explicit LAB_RUNTIME is required');
const identity = JSON.parse(await readFile(path.join(lab, 'lab.json'), 'utf8'));
validateBaseUrl(manifest.halo, identity);
if (manifest.hexo !== `http://127.0.0.1:${identity.ports.hexo}`) throw new Error('Reference origin differs from lab ownership');
Object.assign(process.env, browserEnvironment());
const playwright = await import(pathToFileURL(path.join(RUNTIME, 'deps/node_modules/playwright/index.mjs')));
const observations = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function inspect(browser, target, viewport, mode, label, route = '/') {
  const failures = [], requests = new Set(), errors = [];
  const context = await browser.newContext({ viewport, colorScheme: mode });
  await context.route('**/*', async intercepted => {
    const request = intercepted.request();
    if (requestPolicy(request.url(), request.method(), target) === 'blocked') {
      failures.push(`Blocked request: ${request.method()} ${request.url()}`);
      await intercepted.abort();
    } else await intercepted.continue();
  });
  await context.addInitScript(({ mode }) => {
    localStorage.setItem('halo-butterfly-next.color-scheme', mode);
    localStorage.setItem('theme', JSON.stringify({ value: mode, expiry: Date.now() + 86400000 }));
  }, { mode });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  page.on('request', request => requests.add(request));
  page.on('requestfinished', request => requests.delete(request));
  page.on('requestfailed', request => { requests.delete(request); failures.push(`${request.url()}: ${request.failure()?.errorText}`); });
  page.on('response', response => {
    const failure = responseFailure(response.status(), response.headers()['content-type'] || '', response.request().resourceType());
    if (failure) failures.push(`${response.url()}: ${failure}`);
  });
  let metrics;
  try {
    const response = await page.goto(target + route, { waitUntil: 'load', timeout: 30000 });
    assert(response.status() === 200, `Document HTTP ${response.status()}`);
    await page.waitForFunction(() => document.fonts.status === 'loaded' && !document.body.classList.contains('loading'), null, { timeout: 15000 });
    const selector = target === manifest.halo ? '.essay' : '#recent-posts';
    await page.locator(selector).evaluate(root => window.scrollTo(0, root.getBoundingClientRect().top + window.scrollY - 70));
    await page.waitForFunction(selector => [...document.querySelectorAll(`${selector} img`)].every(img => {
      const box = img.getBoundingClientRect();
      return box.bottom <= 0 || box.top >= innerHeight || img.complete && img.naturalWidth > 0;
    }), selector, { timeout: 15000 });
    await page.waitForTimeout(300); // Real card/loading transitions and ResizeObserver layout.
    metrics = await page.locator(selector).evaluate((root, halo) => {
      const rect = element => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; };
      const style = (element, pseudo) => { const css = getComputedStyle(element, pseudo); return { position: css.position, order: css.order, fontSize: css.fontSize, lineHeight: css.lineHeight, padding: css.padding, color: css.color, background: css.backgroundColor, filter: css.backdropFilter, transform: css.transform, clamp: css.webkitLineClamp }; };
      return { className: root.className, layout: root.dataset.indexLayout, root: rect(root), overflow: document.documentElement.scrollWidth - innerWidth,
        mode: halo ? document.documentElement.dataset.colorScheme : document.documentElement.dataset.theme,
        masonryScript: !!document.querySelector('#masonryScript'),
        cards: [...root.querySelectorAll(halo ? ':scope > .item' : ':scope > .recent-post-item')].map(card => {
          const cover = card.querySelector(halo ? ':scope > .cover' : ':scope > .post_cover');
          const info = card.querySelector(halo ? ':scope > .info' : ':scope > .recent-post-info');
          const title = info.querySelector(halo ? '.title' : '.article-title');
          const excerpt = info.querySelector(halo ? '.excerpt' : '.content');
          return { rect: rect(card), style: style(card), cover: cover && { rect: rect(cover), style: style(cover), overlay: style(cover, ':before') },
            info: { rect: rect(info), style: style(info) }, title: title.textContent.trim(), href: title.href, titleStyle: style(title), excerpt: excerpt && { text: excerpt.textContent.trim(), style: style(excerpt) } };
        }) };
    }, target === manifest.halo);
    assert(metrics.cards.length > 0, 'No rendered articles');
    assert(metrics.overflow <= 1, `Viewport overflow ${metrics.overflow}px`);
    assert(metrics.mode === mode, `Mode ${metrics.mode} differs from ${mode}`);
    if (!manifest.baseline && target === manifest.halo && route === '/') {
      assert(metrics.layout === String(manifest.expectedLayout), `Layout ${metrics.layout} differs from ${manifest.expectedLayout}`);
      assert(metrics.masonryScript === [6, 7].includes(manifest.expectedLayout), 'Conditional masonry script differs');
      assert(metrics.cards.every(card => !!card.excerpt === !manifest.noExcerpt), 'Excerpt compatibility differs');
      assert(metrics.cards.every(card => !!card.cover === !manifest.noCover), 'Cover switch differs');
    }
    for (let i = 0; i < metrics.cards.length; i++) for (let j = i + 1; j < metrics.cards.length; j++) {
      const a = metrics.cards[i].rect, b = metrics.cards[j].rect;
      assert(!(Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1), `Cards ${i}/${j} overlap`);
    }
    await page.screenshot({ path: path.join(manifest.output, `${label}.png`) });
    assert(!errors.length, `JavaScript errors: ${errors.join('; ')}`);
  } catch (error) { failures.push(String(error.message)); }
  if (requests.size) failures.push(`Pending before close: ${[...requests].map(r => r.url()).join(', ')}`);
  await context.close();
  return { target: target === manifest.halo ? 'halo' : 'hexo', route, viewport, mode, metrics, failures, result: failures.length ? 'failed' : 'passed' };
}

for (const engine of manifest.engines) {
  const browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' ? { channel: 'chromium' } : {}), env: browserEnvironment() });
  try {
    for (const [size, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } })) for (const mode of ['light', 'dark']) {
      const halo = await inspect(browser, manifest.halo, viewport, mode, `${engine}-${size}-${mode}-halo`);
      halo.engine = engine;
      observations.push(halo);
      if (!manifest.baseline) {
        const hexo = await inspect(browser, manifest.hexo, viewport, mode, `${engine}-${size}-${mode}-hexo`);
        hexo.engine = engine;
        observations.push(hexo);
        if (halo.metrics && hexo.metrics) {
          try {
            const a = halo.metrics.cards[0], b = hexo.metrics.cards[0];
            if (a.cover && b.cover) {
              assert(Math.abs(a.cover.rect.height - b.cover.rect.height) <= 1, `Upstream cover height ${b.cover.rect.height}, Halo ${a.cover.rect.height}`);
              assert(Math.abs(a.cover.rect.width / a.rect.width - b.cover.rect.width / b.rect.width) <= .01, 'Upstream cover proportion differs');
              assert(a.info.style.position === b.info.style.position, 'Upstream information positioning differs');
              assert(a.info.style.padding === b.info.style.padding, `Upstream padding ${b.info.style.padding}, Halo ${a.info.style.padding}`);
              assert(a.titleStyle.fontSize === b.titleStyle.fontSize && a.titleStyle.lineHeight === b.titleStyle.lineHeight, 'Upstream title typography differs');
              if ([5, 7].includes(manifest.expectedLayout)) assert(a.cover.overlay.background === b.cover.overlay.background && a.cover.overlay.filter === b.cover.overlay.filter, 'Upstream overlay differs');
            }
          } catch (error) { halo.failures.push(error.message); halo.result = 'failed'; }
        }
      }
    }
    if (!manifest.baseline && manifest.name === 'layout-6' && engine === 'chromium') {
      for (const width of [768, 769, 2000]) {
        const observation = await inspect(browser, manifest.halo, { width, height: 1000 }, 'light', `chromium-breakpoint-${width}`);
        observation.engine = engine;
        if (observation.metrics) {
          const first = observation.metrics.cards[0];
          const columns = observation.metrics.cards.filter(c => Math.abs(c.rect.y - first.rect.y) <= 1).length;
          if (columns !== (width <= 768 ? 1 : width >= 2000 ? 3 : 2)) { observation.failures.push(`Unexpected ${columns} columns at ${width}px`); observation.result = 'failed'; }
        }
        observations.push(observation);
      }
      for (const route of ['/page/2/', '/categories/development/', '/tags/butterfly/']) {
        const observation = await inspect(browser, manifest.halo, { width: 1440, height: 1000 }, 'light', `chromium-route-${route.replaceAll('/', '_')}`, route);
        observation.engine = engine;
        if (observation.metrics && route !== '/page/2/' && (observation.metrics.layout || observation.metrics.masonryScript)) { observation.failures.push('Home layout leaked into taxonomy'); observation.result = 'failed'; }
        observations.push(observation);
      }
    }
  } finally { await browser.close(); }
}
await writeFile(path.join(manifest.output, 'report.json'), JSON.stringify({ ...manifest, observations }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ case: manifest.name, observations: observations.length, failures: observations.filter(x => x.result !== 'passed').map(x => ({ engine: x.engine, target: x.target, viewport: x.viewport, mode: x.mode, failures: x.failures })) }));
if (observations.some(x => x.result !== 'passed')) process.exitCode = 1;
