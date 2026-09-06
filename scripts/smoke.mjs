import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  base: { type: 'string', default: 'http://127.0.0.1:8090' },
  routes: { type: 'string', default: '/,/archives,/categories,/tags' },
} });
const base = new URL(values.base);
const checked = new Set();
const request = url => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
for (const route of values.routes.split(',')) {
  const url = new URL(route, base);
  assert.equal(url.origin, base.origin, '只测试同一站点');
  const response = await request(url);
  assert.equal(response.status, 200, `${route} HTTP 状态`);
  const html = await response.text();
  assert(html.includes('id="Butterfly"'), `${route} 未渲染主题`);
  assert(!html.includes('org.thymeleaf') && !html.includes('Exception evaluating'), `${route} 模板异常`);
  assert(!html.includes('/*[['), `${route} 存在未解析内联表达式`);
  const canonicals = [...html.matchAll(/<link\b(?=[^>]*rel="canonical")(?=[^>]*href="([^"]+)")[^>]*>/g)];
  assert(canonicals.length <= 1, `${route} 重复 canonical`);
  for (const [, value] of canonicals) assert(/^https?:\/\//.test(value), `${route} canonical 必须是绝对地址`);
  for (const [, asset] of html.matchAll(/(?:src|href)="(\/themes\/theme-butterfly-next\/assets\/[^"<>]+)"/g)) {
    if (checked.has(asset)) continue;
    checked.add(asset);
    const resource = await request(new URL(asset.replaceAll('&amp;', '&'), base));
    assert.equal(resource.status, 200, `资源不可访问：${asset}`);
    assert(!resource.headers.get('content-type')?.includes('text/html'), `资源返回 HTML：${asset}`);
    await resource.arrayBuffer();
  }
  console.log(`PASS ${route}`);
}
console.log(`已验证 ${checked.size} 个主题资源 URL。此检查不替代浏览器视觉及交互验收。`);
