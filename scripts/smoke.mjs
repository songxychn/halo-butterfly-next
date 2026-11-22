import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  base: { type: 'string', default: 'http://127.0.0.1:8090' },
  routes: { type: 'string', default: '/,/archives,/categories,/tags' },
} });
const base = new URL(values.base);
const checked = new Set();
const request = url => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });

function decodeAttr(raw) {
  return raw
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

async function checkAsset(assetUrl) {
  const key = assetUrl.pathname + assetUrl.search;
  if (checked.has(key)) return;
  checked.add(key);
  const resource = await request(assetUrl);
  assert.equal(resource.status, 200, `资源不可访问：${key}`);
  assert(!resource.headers.get('content-type')?.includes('text/html'), `资源返回 HTML：${key}`);
  if (assetUrl.pathname.endsWith('.js')) {
    const code = await resource.text();
    for (const [, rel] of code.matchAll(/(?:from\s*|import\s*\(\s*)["'](\.\/chunks\/[^"']+\.js)["']/g)) {
      await checkAsset(new URL(rel, assetUrl));
    }
  } else {
    await resource.arrayBuffer();
  }
}

for (const route of values.routes.split(',')) {
  const url = new URL(route, base);
  assert.equal(url.origin, base.origin, '只测试同一站点');
  const response = await request(url);
  assert.equal(response.status, 200, `${route} HTTP 状态`);
  const html = await response.text();
  assert(html.includes('id="Butterfly"'), `${route} 未渲染主题`);
  assert(html.includes('css/core.min.css'), `${route} 未加载 core.min.css`);
  assert(!html.includes('org.thymeleaf') && !html.includes('Exception evaluating'), `${route} 模板异常`);
  assert(!html.includes('/*[['), `${route} 存在未解析内联表达式`);
  const configMatch = html.match(/data-config="([^"]+)"/);
  assert(configMatch, `${route} 缺少 data-config`);
  const parsedConfig = JSON.parse(decodeAttr(configMatch[1]));
  assert(parsedConfig && typeof parsedConfig.conf === 'object', `${route} data-config.conf 无效`);
  for (const [, ld] of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    assert.doesNotThrow(() => JSON.parse(ld), `${route} JSON-LD 格式无效`);
  }
  const canonicals = [...html.matchAll(/<link\b(?=[^>]*rel="canonical")(?=[^>]*href="([^"]+)")[^>]*>/g)];
  assert(canonicals.length <= 1, `${route} 重复 canonical`);
  for (const [, value] of canonicals) assert(/^https?:\/\//.test(value), `${route} canonical 必须是绝对地址`);
  for (const [, asset] of html.matchAll(/(?:src|href)="(\/themes\/halo-butterfly-next\/assets\/[^"<>]+)"/g)) {
    await checkAsset(new URL(asset.replaceAll('&amp;', '&'), base));
  }
  console.log(`PASS ${route}`);
}
console.log(`已验证 ${checked.size} 个主题资源 URL（含 ES Module chunks）。`);
