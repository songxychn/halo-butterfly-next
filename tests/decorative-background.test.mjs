import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {decorativeBackground, initializeFooterBackground} from '../src/js/core/decorative-background.ts';

function environment(run) {
  const saved = Object.fromEntries(['document', 'window', 'CSS'].map(key => [key, globalThis[key]]));
  const classes = new Set();
  const footer = {dataset: {footerBackground:'true', footerMask:'false'}, style:{}, classList: {
    add: name => classes.add(name), toggle: (name,on) => on ? classes.add(name) : classes.delete(name),
  }};
  globalThis.document = {baseURI:'https://blog.example/posts/a', createElement: () => ({style:{}}), querySelector: () => footer};
  globalThis.CSS = {supports: (key,value) => key === 'background' && ['red', 'linear-gradient(red, blue)'].includes(value)};
  globalThis.window = {MainApp:{conf:{above_background:'red', above_background_fallback:'/default.webp'}}};
  try {run(footer, classes);} finally {for(const [key,value] of Object.entries(saved)) value === undefined ? delete globalThis[key] : globalThis[key]=value;}
}

test('colors and gradients stay CSS values without an image request candidate', () => environment(() => {
  for (const value of ['red','linear-gradient(red, blue)']) assert.deepEqual(decorativeBackground(value), {css:value});
  assert.equal(decorativeBackground('/cover.webp').image, '/cover.webp');
  for(const value of ['', 'false', 'true', 'javascript:alert(1)', 'file:///secret', 'https://user:pass@example.test/x']) assert.equal(decorativeBackground(value), undefined);
}));

test('footer inheritance uses current page first and global fallback second; mask remains explicit', () => environment((footer, classes) => {
  initializeFooterBackground();
  assert.equal(footer.style.background, 'red');
  assert.equal(classes.has('footer--bg'),true);
  assert.equal(classes.has('footer--mask'),false);
  window.MainApp.conf.above_background='';footer.dataset.footerMask='true';
  initializeFooterBackground();
  assert.match(footer.style.background, /default.webp/);
  assert.equal(classes.has('footer--mask'),true);
}));
