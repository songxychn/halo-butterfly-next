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
