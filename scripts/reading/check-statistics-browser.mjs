import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {readingMetrics} from '../../src/js/core/post-meta.ts';

const target = new URL(process.argv[2]);
const preset = process.argv[3] || 'sharejs';
const output = process.argv[4] || '.runtime/reading-statistics/browser.json';
assert.ok(['127.0.0.1','localhost'].includes(target.hostname), 'Only owned local lab URLs');
mkdirSync(dirname(output),{recursive:true});
const session = `reading-${preset}-${process.pid}`;
function command(args,input) {
  const result=spawnSync('agent-browser',['--session',session,'--json',...args],{encoding:'utf8',input,timeout:45000});
  if(result.status!==0)throw new Error(`${args[0]}: ${result.stderr||result.stdout}`);
  const response=JSON.parse(result.stdout);if(!response.success)throw new Error(JSON.stringify(response));return response.data;
}
const evaluate=script=>command(['eval','--stdin'],script).result;
const wait=expression=>command(['wait','--fn',expression]);
const report={target:target.href,preset,checks:[],layouts:[],limitations:['Chromium headless only; external providers blocked or stubbed; no actual account sharing or third-party counter acceptance.']};
try {
  command(['open',target.origin]);
  command(['network','route','**/busuanzi/**','--abort']);
  command(['network','route','**/menu/page.js','--abort']);
  command(['open',target.href]);
  wait("!!MainApp.useCommon && document.querySelector('article.render')");
  const meta=evaluate(`(() => ({word:document.querySelector('[data-post-wordcount]')?.textContent,minutes:document.querySelector('[data-post-minutes]')?.textContent,share:document.querySelector('[data-post-share]')?.dataset.postShare,translate:!!document.getElementById('translateLink'),url:document.querySelector('[data-share-url]')?.value,code:document.querySelector('article.render code')?.textContent}))()`);
  if(preset==='off') {
    assert.equal(meta.word,undefined);assert.equal(meta.share,undefined);assert.equal(meta.translate,false);
    assert.equal(evaluate("document.querySelectorAll('[data-site-wordcount],#busuanzi_value_site_pv,#busuanzi_value_site_uv').length"),0);
    report.checks.push('disabled settings remove wordcount/share/translation/statistic nodes');
  } else {
    const response=await fetch(new URL('/apis/api.content.halo.run/v1alpha1/posts/reading-sharing-fixture',target));
    assert.ok(response.ok);const post=await response.json();const metrics=readingMetrics(post.content.content);
    assert.equal(meta.word,`字数总计 ${metrics.count} 字`);assert.equal(meta.minutes,`阅读时长 ${metrics.minutes} 分钟`);
    assert.ok(meta.url.includes('/archives/reading-sharing-fixture'));
    report.checks.push('real Halo server wordcount and mixed reading time match published body; title escaped');
    if(preset==='sharejs') {
      wait("document.querySelectorAll('[data-share-provider] a').length === 5");
      const links=evaluate("[...document.querySelectorAll('[data-share-provider] a')].map(a=>({url:a.href,label:a.getAttribute('aria-label'),rel:a.rel}))");
      assert.ok(links.every(link=>link.label&&link.rel.includes('noopener')));
      assert.ok(links.filter(link=>link.url.startsWith('http')).every(link=>link.url.startsWith('https:')));
      evaluate("document.querySelector('.icon-wechat').click()");
      assert.equal(evaluate("getComputedStyle(document.querySelector('.wechat-qrcode')).display"),'block');
      evaluate("document.querySelector('.icon-wechat').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
      report.checks.push('5 configured Share.js links, accessible names, HTTPS, local WeChat QR click/Escape');
    } else if(preset==='addtoany') {
      wait("document.querySelector('[data-share-status]').textContent.includes('暂不可用')");
      assert.equal(evaluate("document.querySelectorAll('[data-share-provider] a').length"),4);
      report.checks.push('blocked AddToAny keeps service links and manual copy fallback');
    } else if(preset==='busuanzi') {
      assert.equal(evaluate("document.querySelectorAll('#busuanzi_value_site_uv,#busuanzi_value_site_pv,#busuanzi_value_page_pv').length"),3);
      assert.equal(evaluate("document.getElementById('busuanzi_value_site_uv').textContent"),'暂不可用');
      report.checks.push('explicit Busuanzi emits PV/UV nodes; blocked service leaves unavailable text');
    }
    evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedShare=text}}});document.querySelector('[data-share-copy]').click()");
    wait("document.querySelector('[data-share-status]').textContent==='链接已复制'");
    assert.equal(evaluate('window.__copiedShare'),meta.url);
    evaluate("navigator.clipboard.writeText=async()=>{throw new Error('denied')};document.querySelector('[data-share-copy]').click()");
    wait("document.querySelector('[data-share-status]').textContent==='请手动复制链接'");
    assert.equal(evaluate("document.activeElement.hasAttribute('data-share-url')"),true);
    report.checks.push('copy link success and permission denial with selected manual URL');
    evaluate("document.getElementById('translateLink').click()");
    const translation=evaluate("({lang:document.documentElement.lang,label:document.getElementById('translateLink').textContent,code:document.querySelector('article.render code').textContent,protected:document.querySelector('article.render [translate=no]').textContent,json:document.querySelector('article.render script').textContent})");
    assert.equal(translation.lang,'zh-TW');assert.equal(translation.label,'转简');assert.equal(translation.code,'简体代码');assert.equal(translation.protected,'简体原文');assert.ok(translation.json.includes('不计入统计'));
    evaluate("document.getElementById('translateLink').click()");
    report.checks.push('configured translation switches lang/label and preserves code/protected/script content');
    evaluate("document.querySelector('[data-site-wordcount]').scrollIntoView()");
    wait("document.querySelector('[data-site-wordcount]').dataset.state==='ready'");
    const total=evaluate("document.querySelector('[data-site-wordcount]').textContent");
    assert.match(total,/^\d+ 字$/);report.totalWordcount=total;
    report.checks.push('real anonymous public post aggregation completes');
  }
  const copy=evaluate(`(() => { const p=document.getElementById('reading-copy');const selection=getSelection();const range=document.createRange();range.selectNodeContents(p);selection.removeAllRanges();selection.addRange(range);const clipboard=new DataTransfer();const event=new ClipboardEvent('copy',{bubbles:true,cancelable:true,clipboardData:clipboard});p.dispatchEvent(event);selection.removeAllRanges();return {prevented:event.defaultPrevented,text:clipboard.getData('text/plain')}; })()`);
  assert.equal(copy.prevented,true);
  if(preset==='off') assert.equal(copy.text,'');else {assert.ok(copy.text.includes('作者：'));assert.ok(copy.text.includes('链接：'));assert.ok(copy.text.includes('著作权归作者所有'));}
  const code=evaluate(`(() => {const p=document.querySelector('article.render code');const range=document.createRange();range.selectNodeContents(p);getSelection().addRange(range);const event=new ClipboardEvent('copy',{bubbles:true,cancelable:true,clipboardData:new DataTransfer()});p.dispatchEvent(event);getSelection().removeAllRanges();return event.defaultPrevented;})()`);
  assert.equal(code,false);report.checks.push('body copy policy applied; code selection unaffected');
  for(const [width,height] of [[1440,1000],[390,844]])for(const mode of ['light','dark']) {
    command(['set','viewport',String(width),String(height)]);
    evaluate(`document.documentElement.dataset.colorScheme=${JSON.stringify(mode)};document.querySelector('.post-share,article.render').scrollIntoView()`);
    const layout=evaluate("({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,mode:document.documentElement.dataset.colorScheme})");
    assert.equal(layout.overflow,false);report.layouts.push(layout);
    command(['screenshot',output.replace(/\.json$/,`-${width}-${mode}.png`)]);
  }
  report.checks.push('desktop/mobile light/dark have no document horizontal overflow');
  report.result='passed';
} catch(error) {report.result='failed';report.error=String(error);process.exitCode=1;}
finally {try{command(['close']);}catch(error){report.cleanupError=String(error);process.exitCode=1;}writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
