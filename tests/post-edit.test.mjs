import assert from 'node:assert/strict';
import {test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {parse} from 'yaml';
import {defaultsFromSettings} from '../scripts/config-migration.mjs';
import {canEditPosts, initializePostEdit, POST_EDIT_PERMISSIONS_URL} from '../src/js/core/post-edit.ts';

test('console shortcut requires both route permissions, or the official wildcard', () => {
  assert.equal(canEditPosts({uiPermissions: ['*']}), true);
  assert.equal(canEditPosts({uiPermissions: ['system:posts:view', 'system:posts:manage']}), true);
  for (const payload of [null, {}, {uiPermissions: '*'}, {uiPermissions: []},
    {uiPermissions: ['system:posts:view']}, {uiPermissions: ['system:posts:manage']},
    {roles: ['super']}, {uiPermissions: [null, '*']}, {uiPermissions: ['system:singlepages:manage']}]) {
    assert.equal(canEditPosts(payload), false);
  }
});

function fixture(connected = true) {
  const mounted = [];
  const target = {append: node => mounted.push(node)};
  const template = {
    isConnected: connected,
    content: {cloneNode: () => ({link: '/console/posts/editor?name=fixture-article'})},
    closest: () => ({querySelector: () => target}),
    remove() { this.isConnected = false; },
  };
  return {root: {querySelectorAll: () => [template]}, template, mounted};
}

test('anonymous/disabled pages make no permission request', async () => {
  await initializePostEdit({querySelectorAll: () => []}, () => { throw new Error('unexpected request'); });
});

test('an authorized response mounts the link once and uses a bounded same-origin read', async () => {
  const {root, template, mounted} = fixture();
  let calls = 0;
  const request = async (url, options) => {
    calls++;
    assert.equal(url, POST_EDIT_PERMISSIONS_URL);
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return {ok: true, json: async () => ({uiPermissions: ['*']})};
  };
  await Promise.all([initializePostEdit(root, request), initializePostEdit(root, request)]);
  assert.equal(calls, 1);
  assert.equal(mounted.length, 1);
  assert.equal(template.isConnected, false);
});

test('denied, expired, malformed and failed permission reads leave no entry', async () => {
  for (const request of [
    async () => ({ok: true, json: async () => ({uiPermissions: ['system:posts:view']})}),
    async () => ({ok: false}),
    async () => ({ok: true, json: async () => { throw new SyntaxError('login HTML'); }}),
    async () => { throw new TypeError('network failure'); },
  ]) {
    const {root, template, mounted} = fixture();
    await initializePostEdit(root, request);
    assert.deepEqual(mounted, []);
    assert.equal(template.isConnected, false);
  }
});

test('a late permission response cannot mount into a detached article', async () => {
  const {root, mounted} = fixture(false);
  await initializePostEdit(root, async () => ({ok: true, json: async () => ({uiPermissions: ['*']})}));
  assert.deepEqual(mounted, []);
});

test('a hanging permission request is aborted and leaves no entry', async () => {
  const {root, template, mounted} = fixture();
  await initializePostEdit(root, (_url, {signal}) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')), {once: true});
  }));
  assert.equal(template.isConnected, false);
  assert.deepEqual(mounted, []);
}, 10000);

test('old configurations keep the edit shortcut disabled', async () => {
  const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));
  assert.equal(defaults.post.post_edit.enable, false);
});
