import {verifiedHaloVersion} from '../browser/support.mjs';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { REPO, RUNTIME, browserEnvironment, sha256 } from '../browser/support.mjs';

const edges = process.argv.includes('--edges');
const actual = process.argv.includes('--halo');
const transport = process.argv.includes('--close-upstream');
const engines = process.argv.find(x=>x.startsWith('--engines='))?.slice(10).split(',') || ['chromium','firefox','webkit'];
assert.ok(engines.every(x=>['chromium','firefox','webkit'].includes(x)));
const label = process.argv.find(x => x.startsWith('--label='))?.slice(8) || 'run-' + Date.now();
const output = path.join(REPO, '.runtime/body-renderers/runs', label);
assert.match(label,/^[a-zA-Z0-9-]+$/);
await mkdir(output, { recursive: true });
const fixtures = JSON.parse(execFileSync('python3', ['-c', 'import sys,json;sys.path.insert(0,"scripts/body-renderers");import lab;good,bad=lab.content();print(json.dumps({"good":good,"bad":bad}))'], { cwd: REPO, encoding: 'utf8' }));
const settings = { mermaid: { enable: true, code_write: true, zoom_pan: true, open_in_new_tab: true, theme: { light: 'default', dark: 'dark' } }, chartjs: { enable: true }, abcjs: { enable: true } };
const built = await Bun.build({ entrypoints: [path.join(REPO, 'src/js/core/body-renderers.ts')], target: 'browser', format: 'esm' });
assert.equal(built.success, true);
const moduleText = await built.outputs[0].text();
let server, base;
if (actual) {
  const marker = JSON.parse(await readFile(path.join(REPO, '.runtime/body-renderers/halo-lab/lab.json')));
  assert.equal(marker.owner, 'halo-butterfly-next-comparison'); assert.equal(marker.ports.halo, 18531);
  const installed=JSON.parse(await readFile(path.join(REPO,'.runtime/body-renderers/halo-lab/installed-package.json')));
  assert.equal(installed.sha256,sha256(await readFile(path.join(REPO,'dist/halo-butterfly-next-0.1.0-alpha.4.zip'))),'installed package differs from current ZIP');
  base = 'http://127.0.0.1:' + marker.ports.halo;
  if (transport) {
    server=createServer((req,res)=>{
      if (!['GET','HEAD'].includes(req.method) && !(req.method==='POST' && req.url==='/apis/api.halo.run/v1alpha1/trackers/counter')) {res.writeHead(405).end();return;}
      const upstream=httpRequest({hostname:'127.0.0.1',port:marker.ports.halo,path:req.url,method:req.method,agent:false,headers:{...req.headers,host:'127.0.0.1:'+marker.ports.halo,connection:'close'}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
      upstream.on('error',()=>res.writeHead(502).end()); req.pipe(upstream);
    });
    await new Promise(resolve=>server.listen(18533,'127.0.0.1',resolve));base='http://127.0.0.1:18533';
  }
} else {
  server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/missing/renderers/')) { res.writeHead(404).end(); return; }
    if (url.pathname.startsWith('/empty-api/renderers/')) { res.setHeader('Content-Type','text/javascript'); res.end('// no adapter'); return; }
    if (url.pathname.startsWith('/themes/halo-butterfly-next/assets/')) {
      const relative = url.pathname.slice('/themes/halo-butterfly-next/assets/'.length);
      if (relative.includes('..')) { res.writeHead(404).end(); return; }
      try { res.setHeader('Content-Type', relative.endsWith('.css') ? 'text/css' : 'text/javascript'); res.end(await readFile(path.join(REPO, 'templates/assets', relative))); }
      catch { res.writeHead(404).end(); }
      return;
    }
    if (url.pathname === '/harness.mjs') { res.setHeader('Content-Type', 'text/javascript'); res.end(moduleText); return; }
    const config = structuredClone(settings);
    if (url.pathname === '/disabled') for (const group of Object.values(config)) group.enable = false;
    if (url.pathname === '/controls-off') { config.mermaid.zoom_pan = false; config.mermaid.open_in_new_tab = false; }
    const resources = ['/fallback','/missing-api'].includes(url.pathname) ? {option:Object.fromEntries(['mermaid','chartjs','abcjs_basic_js'].map((key,i)=>[key, (url.pathname === '/fallback' ? '/missing' : '/empty-api')+'/renderers/'+['mermaid','chartjs','abcjs'][i]+'.min.js']))} : {};
    let markup = url.pathname === '/errors' ? fixtures.bad : url.pathname === '/empty' ? '<h2>无图表</h2><p>普通正文</p>' : fixtures.good;
    if (url.pathname === '/abreast') markup = markup.replace('class="chartjs-container"','class="chartjs-container chartjs-abreast"');
    if (url.pathname === '/security') markup += '<div class="mermaid-wrap"><pre class="mermaid-src" hidden>%%{init: {securityLevel: "loose"}}%%\ngraph TD;A--&gt;B</pre></div><div class="chartjs-container"><pre class="chartjs-src" hidden>{"constructor":{},"type":"bar"}</pre></div>';
    res.setHeader('Content-Type', 'text/html;charset=utf-8');
    res.end(`<!doctype html><html data-color-scheme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/themes/halo-butterfly-next/assets/css/post.min.css"><style>body{margin:0}main{max-width:900px;margin:auto;padding:20px}article.render{width:100%;min-width:0}</style></head><body><main><article class="render">${markup}</article></main><script>window.MainApp={conf:{assets_link:'/themes/halo-butterfly-next/assets/'},resources:${JSON.stringify(resources)},version:'fixture'};</script><script type="module">import {enhanceBodyRenderers} from '/harness.mjs';window.__enhance=()=>enhanceBodyRenderers(document.querySelector('article.render'),${JSON.stringify(config)});window.__cleanup=window.__enhance();</script></body></html>`);
  });
  await new Promise(resolve => server.listen(18532, '127.0.0.1', resolve)); base = 'http://127.0.0.1:18532';
}
const env = browserEnvironment(); Object.assign(process.env, env);
const pw = createRequire(path.join(RUNTIME, 'deps/package.json'))('playwright');
const report = { startedAt: new Date().toISOString(), transport: transport ? 'diagnostic proxy with upstream Connection: close' : 'native', kind: actual ? 'Halo ' + await verifiedHaloVersion(path.join(REPO,'.runtime/body-renderers/halo-lab')) : 'isolated browser fixture', sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO, encoding: 'utf8' }).trim(), fixtureSha256:sha256(JSON.stringify(fixtures)), packageSha256: sha256(await readFile(path.join(REPO, 'dist/halo-butterfly-next-0.1.0-alpha.4.zip'))), results: [] };
const save = () => writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
let failed = false;
for (const engine of engines) {
  const browser = await pw[engine].launch({ headless: true, env, ...(engine === 'chromium' ? { channel: 'chromium' } : {}) });
  (report.browserVersions ??= {})[engine]=browser.version();
  try {
    for (const width of [1440, 390]) for (const mode of ['light','dark']) {
      const routes = actual ? ['/archives/body-charts/', '/body-charts-page/', '/archives/body-charts-off/', '/archives/body-charts-errors/'] : edges ? ['/fallback','/missing-api','/unavailable','/abreast','/security','/nojs'] : ['/', '/empty', '/disabled', '/errors', '/controls-off'];
      for (const route of routes) {
        const result = { phase: 'initial', engine, width, mode, route, errors: [], requests: [], status: 'running' }; report.results.push(result);
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, locale: 'zh-CN', colorScheme: mode, hasTouch: width === 390, javaScriptEnabled: route !== '/nojs' });
        context.setDefaultTimeout(15000);
        const page = await context.newPage();
        const pending = new Set();
        page.on('request',r=>pending.add(r.url()));page.on('requestfinished',r=>pending.delete(r.url()));page.on('requestfailed',r=>pending.delete(r.url()));
        page.on('pageerror', error => result.errors.push(error.message));
        page.on('request', request => { if (request.url().includes('/renderers/')) result.requests.push(request.url()); });
        await page.addInitScript(mode => localStorage.setItem('halo-butterfly-next.color-scheme', mode), mode);
        try {
          if (route === '/unavailable') await page.route('**/renderers/*.min.js',r=>r.abort());
          assert.equal((await page.goto(base + route, { waitUntil: 'domcontentloaded' })).status(), 200);
          if (route === '/nojs') {
            assert.equal(result.requests.length,0);
            for (const selector of ['.mermaid-src','.chartjs-src','.abc-music-sheet']) assert.equal(await page.locator(selector).first().isVisible(),true);
            result.status='passed'; continue;
          }
          await page.waitForFunction(() => window.MainApp?.conf);
          await page.evaluate(mode => { if (window.MainApp.useTheme) window.MainApp.useTheme.setMode(mode); else document.documentElement.dataset.colorScheme = mode; }, mode);
          if (route === '/unavailable') {
            await page.waitForFunction(()=>document.querySelectorAll('[data-render-state=failed]').length===6);
            assert.equal(await page.locator('.theme-render-block > details[open]').count(),6);
            await page.unroute('**/renderers/*.min.js'); await page.getByRole('button',{name:'重试',exact:true}).first().click();
          }
          if (route === '/security') await page.waitForFunction(()=>document.querySelectorAll('[data-render-state=failed]').length===2);
          const off = route.includes('off/') || route === '/disabled';
          const errors = route.includes('errors');
          const empty = route === '/empty';
          if (empty) { await page.waitForTimeout(300); assert.equal(result.requests.length, 0); }
          else if (off) {
            await page.waitForFunction(() => document.querySelectorAll('[data-render-state="disabled"]').length === 6);
            assert.equal(result.requests.length, 0); assert.equal(await page.locator('.theme-render-output svg,.theme-render-output canvas').count(), 0);
            assert.equal(await page.locator('.theme-render-source[hidden]').count(), 0);
          } else if (errors) {
            await page.waitForFunction(() => document.querySelectorAll('[data-render-state="failed"]').length === 3, {}, { timeout: 45000 });
            assert.equal(await page.locator('.theme-render-block details[open]').count(), 3); assert.equal(await page.locator('button:visible').filter({hasText:'重试'}).count(), 3);
            assert.equal(await page.evaluate(() => Object.prototype.polluted), undefined);
          } else {
            await page.waitForFunction(() => document.querySelectorAll('[data-render-state="rendered"]').length === 6, {}, { timeout: 45000 });
            assert.equal(await page.locator('.theme-render-output > svg').count(), 4);
            assert.ok((await page.locator('#fixture-mermaid .theme-render-output svg text').allTextContents().then(x=>x.join(' '))).includes('开始'), 'Mermaid visible labels');
            await page.waitForTimeout(350);
            assert.equal(await page.locator('.theme-render-output canvas').count(),2, 'editor must preserve rendered code inputs');
            assert.equal(await page.getByText('错误: Language', {exact:false}).count(),0);
            assert.equal(await page.locator('.theme-render-output canvas').count(), 2);
            assert.equal(await page.locator('#fixture-score .abcjs-note').count() > 0, true);
            assert.equal(new Set(result.requests).size, ['/fallback','/missing-api'].includes(route) ? 6 : 3);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'viewport overflow');
            const svg = page.locator('#fixture-mermaid .theme-render-output > svg');
            const initial = await svg.getAttribute('viewBox');
            if (route === '/controls-off') { assert.equal(await page.locator('#fixture-mermaid').getByRole('button',{name:'放大',exact:true}).count(), 0); assert.equal(await page.locator('#fixture-mermaid').getByRole('link',{name:'新页查看'}).count(), 0); }
            else {
              await page.locator('#fixture-mermaid').getByRole('button',{name:'放大',exact:true}).click(); assert.notEqual(await svg.getAttribute('viewBox'), initial);
              await svg.focus(); await page.keyboard.press('ArrowRight'); const moved = await svg.getAttribute('viewBox'); assert.notEqual(moved, initial);
              await page.keyboard.press('Home'); assert.equal(await svg.getAttribute('viewBox'), initial);
              const point = await svg.boundingBox(); await page.mouse.move(point.x + point.width/2, point.y + point.height/2); await page.mouse.down(); await page.mouse.move(point.x + point.width/2 + 30, point.y + point.height/2 + 10); await page.mouse.up(); assert.notEqual(await svg.getAttribute('viewBox'), initial);
              const popupWait = context.waitForEvent('page'); await page.locator('#fixture-mermaid').getByRole('link',{name:'新页查看'}).click(); const popup = await popupWait; await popup.waitForLoadState(); assert.ok(popup.url().startsWith('blob:')); assert.equal(await popup.locator('svg').count(), 1); assert.equal(await popup.evaluate(() => window.opener), null); await popup.close();
            }
            const toggle = page.locator('#fixture-chart .theme-render-output').getByRole('button',{name:'访问量',exact:true});
            await toggle.click(); assert.equal(await toggle.getAttribute('aria-pressed'),'false');
            await page.evaluate(() => { window.__copied=[]; Object.defineProperty(navigator,'clipboard',{ configurable:true, value:{writeText:async value=>window.__copied.push(value)} }); });
            await page.locator('#fixture-score').getByRole('button',{name:'复制源码',exact:true}).click(); assert.ok((await page.evaluate(()=>window.__copied[0])).includes('X:1'));
            await page.evaluate(() => navigator.clipboard.writeText=async()=>{throw new Error('denied');}); await page.locator('#fixture-score').getByRole('button',{name:'复制源码',exact:true}).click(); assert.ok((await page.locator('#fixture-score > [role=status]').textContent()).includes('复制失败'));
            const downloadWait = page.waitForEvent('download'); await page.locator('#fixture-score').getByRole('button',{name:'下载 SVG',exact:true}).click(); assert.equal((await downloadWait).suggestedFilename(), 'abcjs.svg');
            await page.locator('#fixture-chart .theme-render-output summary').click(); assert.equal(await page.locator('#fixture-chart table').innerText().then(text=>text.includes('12')),true);
            await page.screenshot({ path: path.join(output, `${engine}-${width}-${mode}-${route.includes('page')?'page':route==='/'?'fixture':'post'}.png`), fullPage:true });
            result.phase='theme';
            for (let i = 0; i < 3; i++) {
              const next = i % 2 ? mode : mode === 'light' ? 'dark' : 'light';
              await page.evaluate(next => { if (window.MainApp.useTheme) window.MainApp.useTheme.setMode(next); else document.documentElement.dataset.colorScheme=next; }, next);
              await page.waitForFunction(() => document.querySelectorAll('[data-render-state="rendered"]').length===6 && document.querySelectorAll('.theme-render-output > svg').length===4);
              assert.equal(await toggle.getAttribute('aria-pressed'),'false');
            }
            if (!actual && !edges) {
              result.phase='lifecycle';
              for (let i=0;i<5;i++) { await page.evaluate(()=>{window.__cleanup(); window.__cleanup=window.__enhance();}); await page.waitForFunction(()=>document.querySelectorAll('[data-render-state="rendered"]').length===6 && document.querySelectorAll('.theme-render-output > svg').length===4); }
              assert.equal(new Set(result.requests).size,3);
              await page.evaluate(()=>window.__cleanup()); assert.equal(await page.locator('.theme-render-output').count(),0);
            }
            assert.ok((await page.locator('article.render').textContent()).includes('const untouched = true;'));
          }
          assert.deepEqual(result.errors,[]); result.status='passed';
        } catch (error) { result.status='failed'; result.pendingRequests=[...pending]; result.failure=error.message; result.state=await page.evaluate(()=>Array.from(document.querySelectorAll('[data-render-state]')).map(x=>({kind:x.dataset.themeRenderer,state:x.dataset.renderState,text:x.querySelector('[role=status]')?.textContent}))).catch(()=>[]); failed=true; await page.screenshot({path:path.join(output,'failed-'+report.results.length+'.png'),fullPage:true}).catch(()=>{}); }
        finally { await context.close(); await save(); }
        console.log(engine, width, mode, route, result.status, result.failure || '');
      }
    }
  } finally { await browser.close(); }
}
server?.close(); report.completedAt=new Date().toISOString(); await save();
if(failed) process.exitCode=1;
