import { readFile } from 'node:fs/promises';
import {test} from 'bun:test';
import assert from 'node:assert/strict';

function luminance(hex) {
  return hex.match(/[\da-f]{2}/gi).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
}
for (const [mode, backgrounds] of [['light', ['#fafafa']], ['dark', ['#282c34', '#171717']]]) {
  test(`default One ${mode} code text keeps 4.5:1 contrast`, async () => {
    const css = (await readFile(new URL(`../src/plugins/prism/themes/prism-one-${mode}.css`, import.meta.url), 'utf8'))
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const colors = new Set([...css.matchAll(/(?:^|[;{\s])color:\s*(#[\da-f]{6})\s*;/gi)].map(match => match[1]));
    assert.ok(colors.size >= 8, 'Check the actual default token palette');
    for (const foreground of colors) for (const background of backgrounds) {
      const [a, b] = [foreground, background].map(luminance).sort((a, b) => b - a);
      assert.ok((a + .05) / (b + .05) >= 4.5, `${foreground} against ${background}`);
    }
    assert.doesNotMatch(css, /opacity:\s*(?:0?\.\d+)/, 'Do not silently lower token contrast using opacity');
  });
}
