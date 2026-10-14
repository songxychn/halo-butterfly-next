import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {initializeImageLoading} from '../src/js/core/image-loading.ts';
import {disposePage} from '../src/js/core/page-lifecycle.ts';

/** Model the observed cross-browser IDL difference without changing the content attribute. */
function authorImage(attribute, missingValue, inArticle = true) {
  const attrs = new Map([['src', '/author.svg'], ['srcset', '/author.svg 1x, /author-2x.svg 2x'], ['sizes', '100vw']]);
  if (attribute !== null) attrs.set('loading', attribute);
  const image = new EventTarget();
  Object.assign(image, {dataset: {}, complete: true, naturalWidth: 32,
    classList: {add() {}, remove() {}}, closest: () => inArticle ? {} : null,
    hasAttribute: key => attrs.has(key), getAttribute: key => attrs.get(key) ?? null,
    removeAttribute: key => attrs.delete(key)});
  Object.defineProperty(image, 'loading', {
    get: () => ['eager', 'lazy'].includes(attrs.get('loading')?.toLowerCase()) ? attrs.get('loading').toLowerCase() : missingValue,
    set: value => attrs.set('loading', value),
  });
  return {image, attrs};
}

function runImage(attribute, missingValue, config = {}, inArticle = true) {
  const beforeWindow = globalThis.window, beforeDocument = globalThis.document;
  const {image, attrs} = authorImage(attribute, missingValue, inArticle);
  try {
    globalThis.window = {};
    globalThis.document = {querySelectorAll: () => [image]};
    initializeImageLoading(config);
    initializeImageLoading(config); // duplicate initialization must retain the author/source contract.
    assert.equal(attrs.get('src'), '/author.svg');
    assert.equal(attrs.get('srcset'), '/author.svg 1x, /author-2x.svg 2x');
    assert.equal(attrs.get('sizes'), '100vw');
    return attrs.get('loading') ?? null;
  } finally {
    disposePage();
    globalThis.window = beforeWindow; globalThis.document = beforeDocument;
  }
}

test('native loading enhances missing/invalid author hints independently of browser IDL defaults', () => {
  for (const defaultValue of ['auto', 'eager']) {
    for (const attr of [null, '', 'invalid', ' eager ']) {
      assert.equal(runImage(attr, defaultValue), 'lazy', `${defaultValue}: ${JSON.stringify(attr)}`);
    }
  }
});

test('explicit author eager is case-insensitive and preserved; lazy remains lazy', () => {
  for (const defaultValue of ['auto', 'eager']) {
    for (const attr of ['eager', 'EAGER', 'EaGeR']) assert.equal(runImage(attr, defaultValue), attr);
    for (const attr of ['lazy', 'LAZY']) assert.equal(runImage(attr, defaultValue), 'lazy');
  }
});

test('disabled and post-only exclusions retain authored loading and responsive source attributes', () => {
  for (const defaultValue of ['auto', 'eager']) {
    for (const attr of [null, 'EAGER', 'lazy']) {
      assert.equal(runImage(attr, defaultValue, {lazyload_enable: false}), attr);
      assert.equal(runImage(attr, defaultValue, {lazyload_field: 'post'}, false), attr);
    }
  }
});
