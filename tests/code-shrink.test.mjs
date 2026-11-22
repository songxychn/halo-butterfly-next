import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings, migrateConfig } from '../scripts/config-migration.mjs';
import { resolveCodeShrink } from '../src/js/core/code-shrink.ts';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

test('code_shrink defaults to expanded semantic string', () => {
  assert.equal(defaults.code.code_shrink, 'expanded');
});

test('runtime accepts semantic states only; legacy values fall back to default', () => {
  assert.equal(resolveCodeShrink('collapsed'), 'true');
  assert.equal(resolveCodeShrink('disabled'), 'none');
  for (const value of ['expanded', true, false, 'true', 'false', 'none', undefined, null, '']) {
    assert.equal(resolveCodeShrink(value), 'false');
  }
});

test('offline importer converts old boolean and string shrink states into code.code_shrink', () => {
  for (const [value, expected] of [[true, 'expanded'], [false, 'disabled'], ['true', 'collapsed'], ['false', 'expanded'], ['none', 'disabled']]) {
    const migrated = migrateConfig({ render: { enable_code_expander: value } }, '2.0.7', defaults);
    assert.equal(migrated.config.code.code_shrink, expected);
    assert.equal('enable_code_expander' in migrated.config.code, false);
  }
  assert.equal(migrateConfig({ code: { enable_expander: true } }, '2.0.5', defaults).config.code.code_shrink, 'expanded');
});
