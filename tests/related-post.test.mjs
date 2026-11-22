import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  capRelatedPosts,
  rankRelatedPosts,
  renderRelatedPosts,
  resolveDateType,
  resolveEnable,
  resolveLimit,
} from '../src/js/core/related-post.ts';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

function makeList(names) {
  const widget = { removed: false, remove() { widget.removed = true; } };
  const list = { children: [] };
  list.children = names.map(name => {
    const node = {
      removed: false,
      getAttribute(key) { return key === 'data-post-name' ? name : null; },
      remove() {
        node.removed = true;
        list.children = list.children.filter(item => !item.removed);
      },
    };
    return node;
  });
  list.querySelectorAll = () => list.children.filter(item => !item.removed);
  list.closest = () => widget;
  return { list, widget };
}

test('related_post defaults and option resolvers', () => {
  assert.equal(defaults.post.related_post.enable, true);
  assert.equal(defaults.post.related_post.limit, 6);
  assert.equal(defaults.post.related_post.date_type, 'created');
  assert.equal(resolveEnable(false), false);
  assert.equal(resolveEnable('false'), false);
  assert.equal(resolveEnable(undefined), true);
  assert.equal(resolveLimit(0), 6);
  assert.equal(resolveLimit(-1), 6);
  assert.equal(resolveLimit('8'), 8);
  assert.equal(resolveDateType('created'), 'created');
  assert.equal(resolveDateType('updated'), 'updated');
  assert.equal(resolveDateType('other'), 'updated');
});

test('rankRelatedPosts weights shared tags, excludes self, and respects limit', () => {
  const tagA = [{ path: '/self/' }, { path: '/a/' }, { path: '/both/' }];
  const tagB = [{ path: '/both/' }, { path: '/b/' }];
  let i = 0;
  const ranked = rankRelatedPosts('/self/', [tagA, tagB], { limit: 2, random: () => [0.1, 0.9, 0.2][i++] });
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].path, '/both/');
  assert.equal(ranked[0].weight, 2);
  assert.equal(rankRelatedPosts('/self/', [[]], { limit: 6 }).length, 0);
  assert.equal(rankRelatedPosts('/self/', null).length, 0);
});

test('renderRelatedPosts mounts top candidates and removes empty widgets', () => {
  const widget = { hidden: true, removed: false, remove() { this.removed = true; } };
  const node = name => ({ getAttribute: () => name });
  const template = (tag, names) => ({ getAttribute: () => tag, content: { querySelectorAll: () => names.map(node) } });
  const root = {
    querySelectorAll: () => [template('a', ['early', 'both']), template('b', ['later', 'both']), template('a', ['early', 'both'])],
    getAttribute: key => key === 'data-current-post' ? 'self' : null,
    setAttribute() {},
    replaceChildren(...nodes) { this.children = nodes; },
    closest: () => widget,
  };
  assert.equal(renderRelatedPosts(root, 1, () => 0.5), 1);
  assert.equal(root.children[0].getAttribute(), 'both');
  assert.equal(widget.hidden, false);
  root.querySelectorAll = () => [template('a', ['self'])];
  assert.equal(renderRelatedPosts(root, 6), 0);
  assert.equal(widget.removed, true);
  assert.equal(renderRelatedPosts(null, 6), 0);

  const { list } = makeList(['self', 'a', 'a', 'b', 'c']);
  assert.equal(capRelatedPosts(list, 2, 'self'), 2);
  assert.deepEqual(list.children.map(item => item.getAttribute('data-post-name')), ['a', 'b']);
});
