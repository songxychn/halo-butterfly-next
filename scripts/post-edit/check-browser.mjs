import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';

// Use an isolated, synthetic Halo session state file; never print its contents.
const [url, state, expected, output, width = '1440', height = '1000'] = process.argv.slice(2);
const target = new URL(url);
assert.equal(target.hostname, '127.0.0.1', 'Only the local synthetic lab is allowed');
assert.ok(['present', 'absent'].includes(expected));
assert.ok(output?.endsWith('.json'));
mkdirSync(dirname(output), {recursive: true});
const session = `post-edit-check-${process.pid}`;
const report = {url: target.href, expected, checks: []};
function command(args, input) {
  const result = spawnSync('agent-browser', ['--session', session, '--json', ...args], {
    encoding: 'utf8', input, timeout: 40000,
  });
  if (result.status !== 0) throw new Error(`${args[0]}: ${result.stderr || result.stdout}`);
  const response = JSON.parse(result.stdout);
  if (!response.success) throw new Error(response.error);
  return response.data;
}
const evaluate = js => command(['eval', '--stdin'], js).result;
try {
  const open = ['open', target.href];
  if (state !== '-') open.unshift('--state', state);
  command(open);
  command(['set', 'viewport', width, height]);
  command(['wait', '--fn', "!!window.MainApp?.useCommon && (!document.querySelector('article.render') || !!window.MainApp.modules.Render) && !document.querySelector('template[data-post-edit]')"]);
  report.browser = evaluate('navigator.userAgent');
  report.entry = evaluate(`(() => {
    const link = document.querySelector('.post-edit-link');
    return {count: document.querySelectorAll('.post-edit-link').length, href:link?.getAttribute('href'), target:link?.target,
      rel:link?.rel, label:link?.getAttribute('aria-label'), title:document.querySelector('h1.post-title')?.textContent,
      permissionRequests:performance.getEntriesByType('resource').filter(x=>x.name.endsWith('/users/-/permissions')).length,
      colorScheme:document.documentElement.dataset.colorScheme,
      overflow:document.documentElement.scrollWidth>innerWidth,
      viewport:{width:innerWidth,height:innerHeight}};
  })()`);
  assert.equal(report.entry.count, expected === 'present' ? 1 : 0);
  assert.equal(report.entry.overflow, false);
  report.checks.push('expected visibility, no duplicate entry or pending template');
  if (expected === 'present') {
    assert.equal(new URL(report.entry.href, target).pathname, '/console/posts/editor');
    assert.ok(new URL(report.entry.href, target).searchParams.get('name'));
    assert.equal(report.entry.target, '_blank');
    assert.ok(report.entry.rel.includes('noopener'));
    assert.ok(report.entry.rel.includes('noreferrer'));
    assert.equal(report.entry.permissionRequests, 1);
    evaluate("document.querySelector('.post-edit-link').focus()");
    report.focus = evaluate(`(() => {
      const a=document.activeElement,r=a.getBoundingClientRect();
      return {edit:a.matches('.post-edit-link'),outline:getComputedStyle(a).outlineStyle,width:r.width,height:r.height};
    })()`);
    assert.ok(report.focus.edit && report.focus.outline !== 'none');
    assert.ok(report.focus.width >= 24 && report.focus.height >= 24);
    report.checks.push('new-tab attributes, one permission read, visible focus and 24px target');
    command(['press', 'Enter']);
    command(['wait', '--fn', `document.title.includes('文章编辑') && [...document.querySelectorAll('input')].some(x=>x.value===${JSON.stringify(report.entry.title)})`]);
    report.editor = evaluate('({url:location.href,title:document.title,opener:window.opener===null})');
    assert.equal(report.editor.url, new URL(report.entry.href, target).href);
    assert.ok(report.editor.opener);
    const tabs = command(['tab', 'list']).tabs;
    assert.ok(tabs.some(tab => tab.url === target.href));
    report.checks.push('Enter opens the correct real editor and preserves the reading tab');
    command(['tab', tabs.find(tab => tab.url === target.href).tabId]);
  }
  // Optional cover regression checks. White/long-title variants only alter this
  // isolated browser DOM, after checking the real article's editor identity.
  if (process.env.POST_COVER_CHECK === '1' && evaluate("!!document.querySelector('.post .header .above')")) {
    report.cover = evaluate(`(() => {
      const above=document.querySelector('.post .header .above'), info=above.querySelector('.above-info'),
        title=info.querySelector('.post-title'), meta=info.querySelector('.post-meta');
      const white=${process.env.POST_COVER_WHITE === '1'}, long=${process.env.POST_COVER_LONG === '1'};
      if(white){above.style.setProperty('background-image','none','important');above.style.backgroundColor='#fff';}
      if(long) title.textContent='用于检查手机换行的长文章标题：中英文排版 Butterfly '.repeat(5);
      const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
      const m=getComputedStyle(meta),t=getComputedStyle(title),g=getComputedStyle(info,'::before'),mask=getComputedStyle(above,'::before');
      return {white,long,above:rect(above),info:rect(info),title:rect(title),meta:rect(meta),
        nav:rect(document.querySelector('.header .nav')),maskEnabled:document.querySelector('#Butterfly').classList.contains('mask-header'),
        metadataBackground:m.backgroundColor,metadataPadding:m.padding,metadataRadius:m.borderRadius,metadataColor:m.color,titleColor:t.color,
        fade:g.backgroundImage,fadeInset:g.inset,fadeZIndex:g.zIndex,fadePointerEvents:g.pointerEvents,maskColor:mask.backgroundColor,
        alignment:getComputedStyle(info).textAlign,overflow:document.documentElement.scrollWidth>innerWidth};
    })()`);
    const c = report.cover;
    assert.equal(c.metadataBackground, 'rgba(0, 0, 0, 0)');
    assert.equal(c.metadataPadding, '0px');
    assert.equal(c.metadataRadius, '0px');
    assert.ok(Math.abs(c.above.bottom-c.info.bottom-30)<1, 'info stays 30px above cover bottom');
    assert.ok(c.info.y>=c.nav.bottom, 'wrapped text must not overlap navigation');
    assert.equal(c.info.width,c.above.width, 'fade spans the full cover width');
    assert.ok(c.title.y>=c.info.y && c.meta.bottom<=c.info.bottom);
    assert.equal(c.overflow,false);
    if(c.maskEnabled){
      assert.match(c.fade,/linear-gradient/);
      assert.equal(c.fadeInset,'-100px 0px -30px');
      assert.equal(c.fadePointerEvents,'none');
      assert.equal(c.fadeZIndex,'-1');
      assert.equal(c.metadataColor,'rgb(255, 255, 255)');
      assert.equal(c.titleColor,'rgb(255, 255, 255)');
      const alpha=value=>Number(value.match(/rgba\([^)]*,\s*([\d.]+)\)/)[1]);
      const fadeAlpha=Math.min(...[...c.fade.matchAll(/rgba\([^)]*\)/g)].map(x=>alpha(x[0])).filter(x=>x>0)),maskAlpha=alpha(c.maskColor);
      const channel=(1-fadeAlpha)*(1-maskAlpha), linear=channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;
      c.whiteCoverContrast=1.05/(linear+.05);
      assert.ok(c.whiteCoverContrast>=4.5);
    } else assert.equal(c.fade,'none', 'mask switch disables the added fade');
    report.checks.push('no metadata badge, bottom layout, full-width fade, wrapped text/viewport bounds, enabled-mask white-cover contrast');
  }
  report.screenshot = output.replace(/\.json$/, '.png');
  command(['screenshot', report.screenshot]);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = String(error); process.exitCode = 1;
} finally {
  try { command(['close']); } catch { report.cleanupFailed = true; process.exitCode = 1; }
  writeFileSync(output, JSON.stringify(report, null, 2)+'\n');
  console.log(JSON.stringify(report, null, 2));
}
