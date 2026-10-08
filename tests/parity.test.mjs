import {test} from 'bun:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkParity, checkMatrix, checkRequiredScenarios, checkEvidenceManifest, contractScenarioIds } from '../scripts/check-parity.mjs';
import { yamlLeaves, defaultLeaves, requiredEntries, UPSTREAM_COMMIT } from '../scripts/parity-inventory.mjs';
import { renderMatrix } from '../scripts/parity-render.mjs';

const matrix = JSON.parse(await readFile(new URL('../docs/parity/matrix.json', import.meta.url), 'utf8'));
const inventory = JSON.parse(await readFile(new URL('../docs/parity/upstream-5.7.0.json', import.meta.url), 'utf8'));
const required = JSON.parse(await readFile(new URL('../docs/parity/required-scenarios.json', import.meta.url), 'utf8'));

test('可读矩阵同时保留设置入口与实现缺口，不因已配置而隐藏待办', () => {
  const item = structuredClone(matrix.items[0]);
  item.halo.settings = ['example.enable'];
  item.halo.finding = '已有入口；剩余：手机 | 键盘\n尚未验收';
  const rendered = renderMatrix({ ...matrix, items: [item] });
  assert(rendered.includes('设置：example.enable<br>已有入口；剩余：手机 \\| 键盘 尚未验收'));
  item.halo.settings = [];
  const withoutSettings = renderMatrix({ ...matrix, items: [item] });
  assert(withoutSettings.includes('已有入口；剩余：手机 \\| 键盘 尚未验收'));
  assert(!withoutSettings.includes('设置：'));
});

test('完整离线门禁随 bun run verify 检查生成文档、实际代码/配置、合同与证据引用', async () => {
  const result = await checkParity();
  assert.equal(result.total, 897);
  assert.equal(result.required, 897);
  assert.equal(result.sourceVerified, false);
});

test('固定上游配置、扩展和手工场景均完整，覆盖检查不提升功能状态', () => {
  assert.deepEqual(checkMatrix(matrix, inventory), []);
  assert.deepEqual(checkRequiredScenarios(matrix, required), []);
  assert.equal(inventory.configuration.length, 387);
  assert.equal(inventory.defaults.length, 388);
  assert.equal(inventory.documented.length, 74);
  assert.equal(inventory.tags.length, 19);
  assert.equal(inventory.registrations.length, 10);
  assert.equal(inventory.plugins.length, 45);
  assert.equal(required.items.length, 78);
  assert.equal(matrix.items.length, 897);
});

test('删除任一类自动提取能力会失败，包括默认配置独有键与渲染过滤器', () => {
  const samples = new Map(requiredEntries(inventory).map(item => [item.kind, item]));
  samples.set('default-only', {kind:'config',key:'artalk.vote'});
  samples.set('documented-only', {kind:'config',key:'theme_color.main'});
  for (const {kind,key} of samples.values()) {
    const id = `${kind}:${key}`;
    const changed = { ...matrix, items: matrix.items.filter(item => item.id !== id) };
    assert(checkMatrix(changed, inventory).includes(`Missing upstream coverage: ${id}`), id);
  }
});

test('删除手工交互或动态字段 schema 会失败', () => {
  for (const id of ['interaction:copy-code','data-schema:reward-items','page:404','content:video']) {
    const changed = { ...matrix, items: matrix.items.filter(item => item.id !== id) };
    assert(checkRequiredScenarios(changed, required).includes(`Missing required scenario: ${id}`));
  }
});

test('YAML 空值和集合仍须覆盖；重复键被拒绝', () => {
  assert.deepEqual(yamlLeaves('a:\n  b: false\n  c:\nlist: []\nitems: [one, two]\n','fixture.yml').map(item => [item.key,item.value]), [['a.b',false],['a.c',null],['list',[]],['items',['one','two']]]);
  assert.throws(() => yamlLeaves('a: 1\na: 2\n','fixture.yml'), /Map keys must be unique/);
});

test('默认配置静态解析不执行代码', () => {
  const input = 'module.exports = { one: false, nested: { value: null }, order: -1, list: [] }';
  assert.deepEqual(defaultLeaves(input).map(item=>[item.key,item.value]), [['one',false],['nested.value',null],['order',-1],['list',[]]]);
  assert.throws(() => defaultLeaves('module.exports = { value: process.exit(0) }'), /Unexpected executable/);
});

test('重复 ID、无效状态和超出源码的行号被拒绝', () => {
  const changed = structuredClone(matrix);
  changed.items.push(structuredClone(changed.items[0]));
  changed.items[0].status = 'nope';
  changed.items[0].sources[0].line = 999999;
  const errors = checkMatrix(changed,inventory);
  assert(errors.some(error => error.startsWith('Duplicate')));
  assert(errors.some(error => error.startsWith('Invalid status')));
  assert(errors.some(error => error.startsWith('Invalid upstream reference')));
});

test('不适用状态必须带完整 DEC 裁定记录', () => {
  const changed = structuredClone(matrix);
  const item = changed.items[0];
  item.status = 'not-applicable';
  assert(checkMatrix(changed, inventory).some(error => error.startsWith('Not-applicable without decision')));
  item.decision = {
    id: 'DEC-01',
    option: 'platform-substitute',
    issue: 'https://github.com/songxychn/halo-butterfly-next/issues/46',
    date: '2026-09-15T22:21:00+08:00',
    reason: 'fixture',
    replacement: 'PluginSearchWidget',
  };
  assert.equal(checkMatrix(changed, inventory).filter(error => error.startsWith('Not-applicable without decision')).length, 0);
});

test('DEC-01 平台替代后搜索引擎与评论 SDK 为不适用，保留项仍适用', () => {
  const keep = new Set([
    'config:aside.card_newest_comments.enable',
    'config:aside.card_newest_comments.sort_order',
    'config:aside.card_newest_comments.limit',
    'config:aside.card_newest_comments.storage',
    'config:aside.card_newest_comments.avatar',
    'config:search.use',
    'config:comments.use',
    'config:comments.text',
    'config:comments.lazyload',
    'config:comments.count',
    'config:comments.card_post_count',
    'template:includes/third-party/comments/index',
    'template:includes/third-party/comments/js',
    'template:includes/third-party/newest-comments/common',
    'template:includes/third-party/newest-comments/index',
    'template:includes/third-party/search/index',
    'template:includes/third-party/card-post-count/index',
    'template:includes/widget/card_newest_comment',
    'style:source/css/_layout/comments.styl',
    'page-data:comments',
    'interaction:search-popup',
    'interaction:comments-lazy',
    'interaction:newest-comments',
    'interaction:shuoshuo-comments',
  ]);
  const na = matrix.items.filter(item => item.status === 'not-applicable' && item.decision?.id === 'DEC-01');
  assert.equal(na.length, 135);
  assert.equal(keep.size, 24);
  for (const id of keep) {
    const item = matrix.items.find(entry => entry.id === id);
    assert.ok(item, id);
    assert.notEqual(item.status, 'not-applicable', id);
    assert(item.tracking.issues.includes('https://github.com/songxychn/halo-butterfly-next/issues/46'), id);
  }
  assert.equal(matrix.items.find(item => item.id === 'interaction:dual-comments').status, 'not-applicable');
  assert.equal(matrix.items.find(item => item.id === 'config:search.docsearch.appId').status, 'not-applicable');
  assert.equal(matrix.items.find(item => item.id === 'config:giscus.repo').status, 'not-applicable');
});

test('只有任意字符串、失败证据或作者自审不能把条目置为已验收', () => {
  const changed=structuredClone(matrix);
  const item=changed.items[0];
  item.status='verified';
  item.author='same-author';
  item.verifiedCommit='a'.repeat(40);
  item.evidence=['runtime','review','ci'].map(kind=>({kind,path:'arbitrary',date:'yesterday',commit:item.verifiedCommit,actor:item.author,outcome:'failed'}));
  const errors=checkMatrix(changed,inventory);
  assert(errors.some(error=>error.startsWith('Incomplete verified evidence')));
  assert(errors.some(error=>error.startsWith('Verified evidence did not pass')));
  assert(errors.some(error=>error.startsWith('Review must be independent')));
});

test('运行清单必须覆盖精确提交、安装包、夹具和合同场景', () => {
  const item={...matrix.items[0],verifiedCommit:'a'.repeat(40)};
  const evidence={kind:'runtime',actor:'runner',date:'2026-09-06T12:00:00+08:00'};
  const manifest={kind:'runtime',sourceSha:item.verifiedCommit,upstreamSha:UPSTREAM_COMMIT,result:'passed',actor:evidence.actor,testedAt:evidence.date,matrixIds:[item.id],commandsAndReports:['node fixture-runner.mjs'],limitations:[],artifactSha256:'b'.repeat(64),fixtureSha:'c'.repeat(40),haloVersion:'2.26.1',runtimeManifest:'docs/parity/evidence/runtime.json',scenarioIds:item.acceptance.contractScenarios};
  assert.deepEqual(checkEvidenceManifest(manifest,evidence,item),[]);
  assert(checkEvidenceManifest({...manifest,result:'failed'},evidence,item).some(e=>e.includes('identity/result mismatch')));
  assert(checkEvidenceManifest({...manifest,scenarioIds:[]},evidence,item).some(e=>e.includes('required contract scenarios')));
  assert(checkEvidenceManifest({...manifest,artifactSha256:''},evidence,item).some(e=>e.includes('package/fixture/platform')));
  assert(checkEvidenceManifest({...manifest,sourceSha:'d'.repeat(40)},evidence,item).some(e=>e.includes('identity/result mismatch')));
});

test('CI 清单的失败结论、其他仓库或不同提交都不能通过', () => {
  const item={...matrix.items[0],verifiedCommit:'a'.repeat(40)};
  const evidence={kind:'ci',actor:'GitHub Actions',date:'2026-09-06T12:00:00+08:00'};
  const manifest={kind:'ci',sourceSha:item.verifiedCommit,upstreamSha:UPSTREAM_COMMIT,result:'passed',actor:evidence.actor,testedAt:evidence.date,matrixIds:[item.id],commandsAndReports:['workflow'],limitations:[],headSha:item.verifiedCommit,conclusion:'failure',runUrl:'https://github.com/other/repo/actions/runs/123'};
  assert(checkEvidenceManifest(manifest,evidence,item).some(e=>e.includes('exact-head run')));
});

test('合同 ID 解析保留含数字的 A11Y 前缀，不采集任意文本', () => {
  assert.deepEqual([...contractScenarioIds('| A11Y-02 | 焦点 |\n| PAGE-01 | 页面 |\nA11Y-99 prose\n')],['A11Y-02','PAGE-01']);
});
