import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
const target = new URL(process.argv[2]);
assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname), 'Only local lab URLs are allowed');
target.searchParams.set('chapter-test', 'kept');
const reportPath = process.argv[3] || join(tmpdir(), 'article-anchor-browser-result.json');
mkdirSync(dirname(reportPath), {recursive: true});
const session = `article-anchors-${process.pid}`;
function command(args, input) {
  const result = spawnSync('agent-browser', ['--session', session, '--json', ...args], { encoding: 'utf8', input, timeout: 45000 });
  if (result.status !== 0) throw new Error(`${args[0]}: ${result.stderr || result.stdout}`);
  const output = JSON.parse(result.stdout);
  if (!output.success) throw new Error(JSON.stringify(output));
  return output.data;
}
function evaluate(js) { return command(['eval', '--stdin'], js).result; }
function wait(expression) { command(['wait', '--fn', expression]); }
const report = { target: target.href, checks: [] };
try {
  command(['open', target.href]);
  wait("document.querySelectorAll('.aside-toc .toc-link').length >= 2 && document.querySelectorAll('article.render .heading-anchor').length >= 2");
  const initial = evaluate(`(() => ({ ids: [...document.querySelectorAll('article.render h1,article.render h2,article.render h3')].map(h=>h.id), hash: location.hash, config: {auto: MainApp.conf.anchor_auto_update, click: MainApp.conf.anchor_click_to_scroll}, query: location.search }))()`);
  assert.equal(initial.config.auto, true);
  assert.equal(initial.config.click, true);
  assert.ok(initial.ids.length >= 2);
  assert.ok(initial.ids.every(Boolean));
  assert.equal(new Set(initial.ids).size, initial.ids.length);
  report.checks.push('unique heading IDs and enabled anchor config');
  evaluate(`(() => { window.__chapterIds = ${JSON.stringify(initial.ids)}; document.querySelector('.aside-toc .toc-link').click(); return location.hash; })()`);
  wait(`decodeURIComponent(location.hash.slice(1)) === ${JSON.stringify(initial.ids[0])} && document.activeElement.id === ${JSON.stringify(initial.ids[0])}`);
  report.checks.push('TOC click updates URL and focuses heading');
  evaluate(`document.getElementById(${JSON.stringify(initial.ids[1])}).querySelector('.heading-anchor').click()`);
  wait(`decodeURIComponent(location.hash.slice(1)) === ${JSON.stringify(initial.ids[1])} && document.activeElement.id === ${JSON.stringify(initial.ids[1])}`);
  assert.equal(evaluate('location.search'), initial.query);
  report.checks.push('heading link navigates and preserves query');
  command(['back']);
  wait(`decodeURIComponent(location.hash.slice(1)) === ${JSON.stringify(initial.ids[0])}`);
  report.checks.push('browser back restores previous chapter');
  command(['reload']);
  wait(`document.querySelector('article.render .heading-anchor') && decodeURIComponent(location.hash.slice(1)) === ${JSON.stringify(initial.ids[0])}`);
  assert.deepEqual(evaluate("[...document.querySelectorAll('article.render h1,article.render h2,article.render h3')].map(h=>h.id)"), initial.ids);
  report.checks.push('reload preserves chapter IDs and URL');
  const beforeScroll = evaluate(`(() => { const h = document.getElementById(${JSON.stringify(initial.ids[1])}); const historyLength = history.length; window.scrollTo({top: h.getBoundingClientRect().top + scrollY - 79, behavior: 'instant'}); return historyLength; })()`);
  wait(`decodeURIComponent(location.hash.slice(1)) === ${JSON.stringify(initial.ids[1])}`);
  assert.equal(evaluate('history.length'), beforeScroll);
  report.checks.push('scroll updates chapter without adding history entries');
  command(['screenshot', reportPath.endsWith('.json') ? reportPath.slice(0, -5) + '.png' : reportPath + '.png']);
  const boundaries = evaluate(`(() => {
    const article = document.querySelector('article.render');
    const heading = article.querySelector('h1,h2,h3');
    const external = document.createElement('a'); external.href='https://example.invalid/external#chapter'; external.textContent='external'; heading.append(external);
    let intercepted;
    const observe = e => { intercepted = e.defaultPrevented; e.preventDefault(); };
    document.addEventListener('click', observe, {once:true});
    external.dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true,button:0})); external.remove();
    return { externalIntercepted: intercepted, captionDisplay: [...article.querySelectorAll('.theme-photofigcaption')].map(c=>getComputedStyle(c).display), permalinkWidth: article.querySelector('.heading-anchor').getBoundingClientRect().width, headingLabel: document.querySelector('.aside-toc .toc-link').textContent };
  })()`);
  assert.equal(boundaries.externalIntercepted, false);
  assert.ok(boundaries.permalinkWidth > 5, 'heading permalink must have a visible click target');
  assert.ok(boundaries.captionDisplay.every(display => display === 'block'));
  assert.ok(!boundaries.headingLabel.endsWith('#'));
  report.checks.push('external links not hijacked, captions block, clean TOC labels');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = String(error); process.exitCode = 1;
} finally {
  try { command(['close']); } catch (error) {
    report.status = 'failed'; report.cleanupError = String(error); process.exitCode = 1;
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
