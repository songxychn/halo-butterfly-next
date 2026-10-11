import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { mathEnabled, mathSource, blockMath, copyMathText } from '../src/js/core/math.ts';

test('formula settings retain defaults, literal false, and explicit page overrides', () => {
  for (const value of [undefined, null, '', 'inherit']) assert.equal(mathEnabled(value), true);
  for (const value of [false, 'false']) assert.equal(mathEnabled(value), false);
  for (const value of [true, 'true']) assert.equal(mathEnabled(value, false), true);
  assert.equal(mathEnabled(undefined, false), false);
});

test('TeX annotation is authoritative, preserves whitespace, and never falls back to rendered glyphs', () => {
  const source = ' \\frac{1}{2}\n\\text{中文 <script>} ';
  const rendered = { querySelector: selector => selector.startsWith('annotation') ? {textContent:source} : {}, matches: () => true };
  assert.equal(mathSource(rendered), source);
  assert.equal(mathSource({querySelector: selector => selector.startsWith('annotation') ? null : {}, matches: () => true}), null);
  assert.equal(mathSource({querySelector: () => null, matches: () => false}), null);
  const raw = {querySelector: () => null, matches: selector => selector !== 'math,.katex-display', getAttribute: () => '', textContent:'fallback'};
  assert.equal(mathSource(raw), '');
});

test('display detection follows explicit wrappers and MathML, never formula text', () => {
  assert.equal(blockMath({ matches: selector => selector.includes('math[display="block"]') }), true);
  assert.equal(blockMath({ matches: () => false }), false);
});

test('clipboard copies exact TeX and denial is reported without parsing or throwing', async () => {
  let captured;
  const doc = {defaultView: {navigator: {clipboard: {writeText: async value => {captured=value;}}}}};
  const source = '<img src=x> \\tag{7}';
  assert.equal(await copyMathText(source, doc), true);
  assert.equal(captured, source);
  doc.defaultView.navigator.clipboard.writeText = async () => {throw new Error('denied');};
  assert.equal(await copyMathText(source, doc), false);
});
