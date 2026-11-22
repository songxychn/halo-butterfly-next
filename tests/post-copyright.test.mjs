import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import {
  formatPermalinkText,
  resolveAuthorHref,
  resolveDecode,
  resolveEnable,
  resolveLicense,
  resolveLicenseUrl,
} from '../src/js/core/post-copyright.ts';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

test('post copyright defaults and resolvers', () => {
  assert.equal(defaults.post.post_copyright.enable, true);
  assert.equal(defaults.post.post_copyright.decode, false);
  assert.equal(defaults.post.post_copyright.author_href, '');
  assert.equal(defaults.post.post_copyright.license, 'CC BY-NC-SA 4.0');
  assert.equal(defaults.post.post_copyright.license_url, 'https://creativecommons.org/licenses/by-nc-sa/4.0/');
  assert.equal(resolveEnable(false), false);
  assert.equal(resolveEnable('false'), false);
  assert.equal(resolveEnable(undefined), true);
  assert.equal(resolveDecode(true), true);
  assert.equal(resolveDecode(false), false);
  assert.equal(resolveAuthorHref('', 'https://example.test'), 'https://example.test');
  assert.equal(resolveAuthorHref('/about', 'https://example.test'), '/about');
  assert.equal(resolveLicense(''), 'CC BY-NC-SA 4.0');
  assert.equal(resolveLicense('MIT'), 'MIT');
  assert.equal(resolveLicenseUrl(''), 'https://creativecommons.org/licenses/by-nc-sa/4.0/');
});

test('formatPermalinkText decodes URI only when explicitly enabled and handles malformed percent sequences', () => {
  const encoded = 'https://example.test/%E4%B8%AD%E6%96%87';
  assert.equal(formatPermalinkText(encoded, false), encoded);
  assert.equal(formatPermalinkText(encoded, undefined), encoded);
  assert.equal(formatPermalinkText(encoded, true), 'https://example.test/中文');
  assert.equal(formatPermalinkText('%E0%A4%A', true), '%E0%A4%A');
});
