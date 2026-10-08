import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parseAllDocuments } from 'yaml';
import { headingSlug, ensureHeadingIds, hashId, localAnchorId } from '../src/js/core/article-anchor.ts';

test('heading IDs are deterministic, retain authored IDs and avoid existing document IDs', () => {
  const headings = [
    { id: 'author-anchor', textContent: 'Title' },
    { id: '', textContent: '你好 世界!' },
    { id: '', textContent: '你好 世界!' },
    { id: '', textContent: '***' },
  ];
  const article = {
    querySelectorAll: () => headings,
    ownerDocument: { querySelectorAll: () => [{ id: '你好-世界' }, ...headings.filter(h => h.id)] },
  };
  ensureHeadingIds(article);
  assert.deepEqual(headings.map(h => h.id), ['author-anchor', '你好-世界-1', '你好-世界-2', 'section']);
  ensureHeadingIds(article);
  assert.deepEqual(headings.map(h => h.id), ['author-anchor', '你好-世界-1', '你好-世界-2', 'section']);
  assert.equal(headingSlug(' cafe\u0301 heading '), 'café-heading');
});

test('chapter links decode Unicode and malformed hashes without claiming external links', () => {
  const current = 'https://example.com/post?a=1';
  assert.equal(localAnchorId('#%E7%AB%A0%E8%8A%82', current), '章节');
  assert.equal(localAnchorId('https://example.com/post?a=1#part', current), 'part');
  for (const href of ['https://other.com/post?a=1#part', '/other?a=1#part', '/post?a=2#part', 'javascript:alert(1)', '#']) {
    assert.equal(localAnchorId(href, current), null, href);
  }
  assert.equal(hashId('#bad%zz'), 'bad%zz');
  assert.equal(hashId('#a%2Fb%3Fc'), 'a/b?c');
});

test('article and page override forms preserve literal false and inherit separately', async () => {
  const docs = parseAllDocuments(await readFile(new URL('../annotation-setting.yaml', import.meta.url), 'utf8')).map(doc => doc.toJSON());
  for (const kind of ['Post', 'SinglePage']) {
    const schema = docs.find(doc => doc.spec.targetRef.kind === kind).spec.formSchema;
    for (const key of ['toc', 'toc_number', 'toc_expand', 'toc_style_simple', ...(kind === 'Post' ? ['copyright', 'noticeOutdate'] : [])]) {
      const field = schema.find(node => node.name === key);
      assert.equal(field.value, 'inherit', `${kind}.${key} default`);
      assert.deepEqual(field.options.map(option => option.value), ['inherit', 'true', 'false'], `${kind}.${key} options`);
    }
  }
});
