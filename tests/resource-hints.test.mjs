import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {preconnectResource} from '../src/js/core/resource-hints.ts';

function fixture() {
  const nodes = [];
  const document = {baseURI: 'https://site.test/post',
    head: {querySelectorAll: () => nodes, append: node => nodes.push(node)},
    createElement: () => ({dataset: {}, crossOrigin: null, hasAttribute: key => false})};
  return {document, nodes};
}
test('preconnect excludes local, insecure, credentialed and malformed URLs', () => {
  const {document, nodes} = fixture();
  for (const url of ['/assets/main.js', 'https://site.test/a', 'http://other.test/a',
    'https://name:secret@other.test/a', 'javascript:alert(1)', 'https://bad.test/<img>', '', null]) {
    assert.equal(preconnectResource(url, document), false);
  }
  assert.equal(nodes.length, 0);
});
test('preconnect deduplicates per origin and CORS mode and strips paths and queries', () => {
  const {document, nodes} = fixture();
  assert(preconnectResource('https://cdn.test:443/a.js?private=value', document));
  assert.equal(preconnectResource('https://cdn.test/b.css', document), false);
  assert(preconnectResource('https://cdn.test/font.woff2', document, true));
  assert.equal(preconnectResource('https://cdn.test/other.woff2', document, true), false);
  assert.deepEqual(nodes.map(node => [node.href, node.crossOrigin]), [
    ['https://cdn.test', null], ['https://cdn.test', 'anonymous']]);
});
test('preconnect bounds new origins without breaking CORS hints for an existing origin', () => {
  const {document, nodes} = fixture();
  for (let i = 0; i < 6; i++) assert(preconnectResource(`https://cdn${i}.test/a`, document));
  assert.equal(preconnectResource('https://overflow.test/a', document), false);
  assert(preconnectResource('https://cdn0.test/font', document, true));
  assert.equal(nodes.length, 7);
});
test('unavailable DOM and malformed existing hints cannot break resource loading', () => {
  assert.equal(preconnectResource('https://cdn.test/a', {}), false);
  const {document, nodes} = fixture(); nodes.push({href: 'https://['});
  assert.equal(preconnectResource('https://cdn.test/a', document), false);
});
