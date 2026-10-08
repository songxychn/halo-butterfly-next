import assert from 'node:assert/strict';
import {test} from 'bun:test';
import * as sass from 'sass';
import postcss from 'postcss';

const css = postcss.parse(sass.compile(new URL('../src/scss/page/post.scss', import.meta.url).pathname, {
  loadPaths: ['node_modules'], logger: sass.Logger.silent,
}).css);
const scope = '.post .header .above .post-meta';
function declarations(selector) {
  const result = {};
  css.walkRules(rule => {
    if (rule.selectors.includes(selector)) rule.walkDecls(d => { result[d.prop] = d.value; });
  });
  return result;
}
function rgb(value) {
  if (/^#[\da-f]{3}$/i.test(value)) return [...value.slice(1)].map(v => parseInt(v + v, 16)).concat(1);
  const values = value.match(/[\d.]+/g).map(Number);
  return values.length === 3 ? [...values, 1] : values;
}
function composite(foreground, background) {
  return foreground.slice(0, 3).map((v, i) => v * foreground[3] + background[i] * (1 - foreground[3]));
}
function luminance(channels) {
  return channels.map(v => {
    v /= 255;
    return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
}

test('compiled article metadata surface meets 4.5:1 over white with header mask on or off in both modes', () => {
  const surface = declarations(scope);
  const foreground = rgb(surface['--post-meta-color']);
  const background = rgb(surface['background-color']);
  assert.equal(foreground[3], 1, 'small metadata must not inherit translucent dark-mode text');
  const masks = [0];
  css.walkDecls('--above-mask-color', decl => masks.push(rgb(decl.value)[3]));
  assert(masks.length >= 3, 'must exercise light and dark mask tokens plus disabled mask');
  for (const maskAlpha of masks) {
    const backdrop = composite(background, composite([0, 0, 0, maskAlpha], [255, 255, 255]));
    const ratio = (luminance(foreground.slice(0, 3)) + .05) / (luminance(backdrop) + .05);
    assert(ratio >= 4.5, `metadata contrast ${ratio} with mask alpha ${maskAlpha}`);
  }
});

test('metadata links retain readable hover and visible keyboard focus; surface is confined to article cover', () => {
  assert.equal(declarations(scope).display, 'inline-block');
  assert.equal(declarations(scope)['box-sizing'], 'border-box');
  assert.equal(declarations('.post-meta')['max-width'], '100%');
  assert.equal(declarations(scope + ' a').color, 'var(--post-meta-color)');
  assert.equal(declarations(scope + ' .lk')['text-decoration'], 'underline');
  assert.equal(declarations(scope + ' .lk:hover').color, 'var(--post-meta-color)');
  assert.equal(declarations(scope + ' .lk:hover')['text-decoration-thickness'], '2px');
  assert.equal(declarations(scope + ' .lk:focus-visible').outline, '2px solid currentColor');
  assert.equal(declarations(scope + ' .lk:focus-visible')['outline-offset'], '2px');
  assert.equal(declarations('.post .content > .post-info .post-meta').color, 'var(--post-info-meta-color)');
  assert.equal(declarations('.post .content > .post-info .post-meta')['background-color'], undefined);
});
