import assert from 'node:assert/strict';
import test from 'node:test';
import { isCurrentMenuLink } from '../src/js/core/navigation-state.ts';

test('当前菜单匹配同源页面、尾斜杠和带过滤参数的链接', () => {
  const current = 'https://example.test/archives/?page=2';
  for (const link of ['/archives', '/archives/', 'https://example.test/archives', '/archives?page=2']) {
    assert.equal(isCurrentMenuLink(link, current), true, link);
  }
  for (const link of ['/', '/archive', '/archives/2026', '/archives?page=1', 'https://other.test/archives', '#', '#comments', '/archives#comments', 'javascript:alert(1)', 'mailto:x@example.test', '']) {
    assert.equal(isCurrentMenuLink(link, current), false, link);
  }
  assert.equal(isCurrentMenuLink('/', 'https://example.test/?page=1'), true);
});

test('损坏的 URL 不阻止其余菜单初始化', () => {
  assert.equal(isCurrentMenuLink('https://[invalid', 'https://example.test/'), false);
  assert.equal(isCurrentMenuLink(null, 'https://example.test/'), false);
});
