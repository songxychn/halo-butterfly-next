import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('RSS/Sitemap acceptance rejects duplicate discovery, non-XML and private/draft leaks', () => {
  const result = spawnSync('python3', ['-B', '-m', 'unittest', 'discover', '-s', 'scripts/feed-sitemap', '-p', 'test_check.py'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('contrast guard uses WCAG linear luminance and rejects translucent plates', async () => {
  const {contrastRatio} = await import('../scripts/feed-sitemap/contrast.mjs');
  assert.equal(contrastRatio('rgb(255, 255, 255)', 'rgb(0, 0, 0)'), 21);
  assert.equal(contrastRatio('rgb(255, 255, 255)', 'rgb(255, 255, 255)'), 1);
  assert.ok(contrastRatio('rgb(255, 255, 255)', 'rgb(51, 51, 51)') > 12);
  assert.throws(() => contrastRatio('rgb(255, 255, 255)', 'rgba(51, 51, 51, 0.4)'), /Opaque/);
  assert.throws(() => contrastRatio('rgb(256, 0, 0)', 'rgb(0, 0, 0)'), /range/);
});
