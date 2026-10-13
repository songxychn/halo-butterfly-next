import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { parseRendererJson, resolveChartTheme, mermaidTheme } from '../src/js/core/body-renderer-data.ts';
import { zoomViewBox } from '../src/js/core/svg-viewer.ts';

test('chart JSON is data only: rejects executable syntax, reserved keys and non-object roots', () => {
  for (const raw of ['(()=>{globalThis.pwned=true})()', '{"__proto__":{"pwned":true}}', '{"options":{"constructor":{}}}', '[]', 'null']) assert.throws(() => parseRendererJson(raw));
  assert.equal(globalThis.pwned, undefined);
  assert.deepEqual(parseRendererJson('{"data":{"labels":["中文 <script>","B"],"datasets":[{"data":[1,2]}]}}').data.labels, ['中文 <script>', 'B']);
});
test('untrusted recursive configuration has bounded size and depth', () => {
  assert.throws(() => parseRendererJson('{"x":"' + 'a'.repeat(100001) + '"}'));
  assert.throws(() => parseRendererJson('{"x":'.repeat(70) + '0' + '}'.repeat(70)));
});
test('theme colors resolve recursively without changing original data or discarding falsy values', () => {
  const original = { data: { datasets: [{ backgroundColor: { 'light-mode': '#123', 'dark-mode': '#abc' }, borderWidth: { 'light-mode': 0, 'dark-mode': 2 } }] }, options: { display: { 'light-mode': false, 'dark-mode': true } } };
  const before = JSON.stringify(original);
  assert.equal(resolveChartTheme(original, 'light').data.datasets[0].borderWidth, 0);
  assert.equal(resolveChartTheme(original, 'light').options.display, false);
  assert.equal(resolveChartTheme(original, 'dark').data.datasets[0].backgroundColor, '#abc');
  assert.equal(JSON.stringify(original), before);
});
test('Mermaid uses known themes and preserves a safe per-mode fallback', () => {
  assert.equal(mermaidTheme('forest', 'light'), 'forest');
  assert.equal(mermaidTheme('<script>', 'dark'), 'dark');
});
test('SVG zoom anchors the requested point and preserves aspect ratio', () => {
  assert.deepEqual(zoomViewBox([10,20,200,100], .5, .25,.75), [35,57.5,100,50]);
  assert.deepEqual(zoomViewBox([10,20,200,100], 1), [10,20,200,100]);
});
