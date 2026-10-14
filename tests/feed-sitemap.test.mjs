import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('RSS/Sitemap acceptance rejects duplicate discovery, non-XML and private/draft leaks', () => {
  const result = spawnSync('python3', ['-B', '-m', 'unittest', 'discover', '-s', 'scripts/feed-sitemap', '-p', 'test_check.py'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
