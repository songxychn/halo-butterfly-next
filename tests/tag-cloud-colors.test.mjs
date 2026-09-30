import assert from 'node:assert/strict';
import test from 'node:test';
import {tagCloudColors} from '../src/js/core/tag-cloud-colors.ts';

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(n => parseInt(n, 16) / 255)
    .map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('every cycled tag/count color meets normal text contrast on both cards', () => {
  const seen = new Set();
  for (let index = 0; index < 1000; index++) {
    const colors = tagCloudColors(index);
    for (const [mode, background] of [['light', '#ffffff'], ['dark', '#121212']]) {
      assert.match(colors[mode], /^#[0-9a-f]{6}$/);
      assert(contrast(colors[mode], background) >= 4.5, `${mode} ${colors[mode]}`);
    }
    seen.add(colors.light);
    assert.notEqual(colors.light, colors.dark);
  }
  assert.equal(seen.size, 6, 'Cloud retains six distinct hues without unbounded random colors');
});
