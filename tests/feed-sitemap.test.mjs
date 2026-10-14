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

test('no-JS browser context retains disabled scripts without storage initialization', async () => {
  const {contextOptions} = await import('../scripts/feed-sitemap/browser-support.mjs');
  assert.deepEqual(contextOptions({javaScriptEnabled: false, viewport: {width: 390, height: 844}}, 'http://127.0.0.1:18615'),
    {javaScriptEnabled: false, viewport: {width: 390, height: 844}});
  const active = contextOptions({colorScheme: 'dark'}, 'http://127.0.0.1:18615');
  assert.equal(active.storageState.origins[0].localStorage[0].value, 'dark');
});

test('one deadline also bounds unresolved browser context creation', async () => {
  const {withinDeadline} = await import('../scripts/feed-sitemap/browser-support.mjs');
  let timedOut = false;
  await assert.rejects(withinDeadline(() => new Promise(() => {}), 20, () => 'firefox/no-js/new-context', () => {timedOut = true;}), /firefox\/no-js\/new-context exceeded 20ms/);
  assert.equal(timedOut, true);
  assert.equal(await withinDeadline(() => Promise.resolve('ready'), 100, 'fast case'), 'ready');
});

test('fallback language expectations use fallback wording rather than en catalog equality', async () => {
  const {fallbackMessages} = await import('../scripts/feed-sitemap/browser-support.mjs');
  assert.equal(fallbackMessages('ui.rssSubscribe=RSS subscription\nui.sitemap=Sitemap\nui.subscriptionLinks=Subscription and sitemap\n')['ui.rssSubscribe'], 'RSS subscription');
  assert.throws(() => fallbackMessages('ui.rssSubscribe=RSS subscription\n'), /Missing fallback/);
});
