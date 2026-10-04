/** Exercise generated page bundles in owned headless browsers without a Halo deployment. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {browserEnvironment, RUNTIME} from '../browser/support.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
Object.assign(process.env, browserEnvironment());
const playwright = await import(pathToFileURL(path.join(RUNTIME, 'deps/node_modules/playwright/index.mjs')));
const config = await readFile(path.join(root, 'templates/views/config.html'), 'utf8');
const startup = config.match(/<script id="baseScript"[^>]*>([\s\S]*?)<\/script>/)[1]
  .replace('style_mode: /*[[${theme.config.style.mode}]]*/ null', "style_mode: 'dark'");
assert(!startup.includes('@theme-bootstrap'));
const entries = {
  index: ['Pagination'], category: ['Pagination'], tag: ['Pagination'], archives: ['Pagination'],
  categories: [], tags: [], links: [], plugin: [], error404: [],
  post: ['Render', 'codeBlock', 'AmplifyImg'], single: ['Render', 'codeBlock', 'AmplifyImg'],
  photos: ['AmplifyImg'], moments: ['AmplifyImg'],
};
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#367"/></svg>';
function fixture(entry, loading) {
  const data = entry === 'archives' ? [{year: 2026, months: [{month: 9, posts: [1, 2]}]}] : [{postCount: 2, spec: {displayName: '开发'}}];
  return `<!doctype html><html><head><meta charset="utf-8"><script>${startup}</script>
  <style>.nav{display:flex;width:100%;height:60px;box-sizing:border-box}.menu{display:flex;width:180px}.controls{width:40px}.mask{position:fixed;inset:0;background:#0008;z-index:2}#mobile-navigation{position:fixed;z-index:3;background:white;inset:0 0 0 auto;width:280px}.chart{width:500px;height:300px}</style></head>
  <body class="loading"><div id="Butterfly"><header class="header"><nav class="nav"><div class="nav-title"><a href="/">Home</a></div><ul class="menu"><li><button class="menu-toggle" aria-controls="submenu">Menu</button><ul id="submenu"><li><a href="/">Item</a></li></ul></li></ul><div class="controls"><button class="bars" aria-expanded="false">Open</button></div></nav></header><div id="mobile-navigation" hidden inert tabindex="-1"><button class="side-bar-close">Close</button><div class="bar"><a href="/">Page</a></div></div><div class="mask" hidden></div>
  <main class="main ${entry}"><section class="content"><div class="chart"></div><div class="equinox"><a class="link" data-postcount="2">Types</a></div>${['post', 'single'].includes(entry) ? '<article class="render"><h1>Title</h1><pre><code class="language-javascript">const value = 1;</code></pre></article>' : ''}<img src="/fixture.svg" alt="Fixture"></section><aside class="aside"><div class="is-sticky"><div class="aside-toc"><div class="toc"></div></div></div></aside></main></div>
  <script>Object.assign(window.MainApp.conf, {enable_above:false,enable_webInfo:false,enable_h_icon:false,enable_subtitle:false,total:2,page:1,totalPages:1,hasNext:false,hasPrevious:false,nextUrl:'',prevUrl:'',enable_code:true,enable_code_copy:true,enable_code_expander:'false'});window.MainApp.data=${JSON.stringify(data)};window.MainApp.prismSource='/assets/plugins/prism/prism.min.js';</script>
  <script src="/assets/plugins/loading/${loading}.min.js"></script><script defer src="/assets/js/${entry}.min.js"></script></body></html>`;
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/favicon.ico') {res.statusCode = 204; res.end(); return;}
    if (url.pathname === '/fixture.svg') {res.setHeader('Content-Type', 'image/svg+xml'); res.end(svg); return;}
    if (url.pathname.startsWith('/assets/')) {
      const file = path.resolve(root, 'templates', '.' + url.pathname);
      assert(file.startsWith(path.join(root, 'templates/assets') + path.sep));
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/css');
      res.end(await readFile(file)); return;
    }
    const entry = url.searchParams.get('entry');
    assert(Object.hasOwn(entries, entry));
    res.setHeader('Content-Type', 'text/html');
    res.end(fixture(entry, url.searchParams.get('loading') || 'circle'));
  } catch {res.statusCode = 404; res.end('Not found');}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const checks = [];
let browser;
try {
  for (const engine of ['chromium', 'firefox', 'webkit']) {
    browser = await playwright[engine].launch({headless: true, ...(engine === 'chromium' ? {channel: 'chromium'} : {})});
    for (const [entry, modules] of Object.entries(entries)) {
      for (const width of [1280, 390]) {
        const context = await browser.newContext({viewport: {width, height: 900}});
        const errors = [];
        await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
        const loading = ['circle', 'cross_line', 'dot', 'hourglass'][checks.length % 4];
        await page.goto(`${base}/?entry=${entry}&loading=${loading}`);
        await page.waitForFunction(() => window.MainApp.useCommon && !document.body.classList.contains('loading'));
        assert.deepEqual(await page.evaluate(() => Object.keys(window.MainApp.modules).sort()), modules.sort(), `${engine}/${entry}/${width}`);
        assert.equal(await page.locator('html').getAttribute('data-color-scheme'), 'dark');
        if (width === 390) {
          await page.locator('.bars').click();
          assert.equal(await page.locator('.bars').getAttribute('aria-expanded'), 'true');
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('.bars').getAttribute('aria-expanded'), 'false');
        } else {
          await page.locator('.menu-toggle').focus();
          await page.keyboard.press('Enter');
          assert.equal(await page.locator('#submenu').evaluate(el => el.hidden), false);
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('#submenu').evaluate(el => el.hidden), true);
        }
        if (['archives', 'categories', 'tags'].includes(entry)) await page.waitForSelector('.chart canvas');
        if (['post', 'single'].includes(entry)) await page.waitForSelector('.code-toolbar');
        assert.deepEqual(errors, [], `${engine}/${entry}/${width}`);
        checks.push({engine, entry, width, loading, status: 'passed'});
        await context.close();
      }
    }
    await browser.close(); browser = null;
    console.log(`${engine}: 26 generated-page checks passed`);
  }
  const output = path.join(root, '.runtime/ts-migration/browser-smoke.json');
  await mkdir(path.dirname(output), {recursive: true});
  await writeFile(output, JSON.stringify({checks, limitation: 'Synthetic documents; not a deployed Halo theme acceptance.'}, null, 2) + '\n');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
