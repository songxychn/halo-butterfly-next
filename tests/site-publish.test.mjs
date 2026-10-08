import {test} from 'bun:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderArticle } from '../site/render.mjs';

const file = 'content/pages/docs.md';
const mapping = {'content/tutorials/reading.md': '/archives/reading', 'assets/lake.svg': '/site-assets/lake.svg'};
const routes = {home: '/', archives: '/archives'};

test('site Markdown resolves managed URLs, tables and Chinese heading anchors', () => {
  const source = '# Docs\n\n## 文章目录\n\n[阅读](../tutorials/reading.md)\n\n![湖](../../assets/lake.svg)\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n## 文章目录\n';
  const rendered = renderArticle(source, file, mapping, routes);
  assert.doesNotMatch(rendered, /<h1/);
  assert.match(rendered, /id="文章目录"/);
  assert.match(rendered, /id="文章目录-2"/);
  assert.match(rendered, /href="\/archives\/reading"/);
  assert.match(rendered, /src="\/site-assets\/lake.svg"/);
  assert.match(rendered, /<table>/);
});

test('site Markdown keeps code examples literal and disables raw HTML', () => {
  const rendered = renderArticle('# Demo\n\n```markdown\n[示例](missing.md)\n```\n\n<script>alert(1)</script>', file, mapping, routes);
  assert.match(rendered, /language-markdown/);
  assert.match(rendered, /missing.md/);
  assert.doesNotMatch(rendered, /<script>/);
  assert.match(rendered, /&lt;script&gt;/);
});

test('site Markdown refuses unresolved or executable links', () => {
  for (const href of ['missing.md', 'javascript:alert', '//outside.test/page']) {
    assert.throws(() => renderArticle(`# Demo\n\n[x](${href})`, file, mapping, routes), /Unresolved|Unsupported/);
  }
});

test('local publishing ownership, conflict and recovery guards', () => {
  const result = spawnSync('python3', ['-B', 'site/tools/test_publish.py'], {cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8'});
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
