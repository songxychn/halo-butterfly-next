import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir, symlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { COUNTER_PATH, validateBaseUrl, validatePackage, ownRuntime, responseFailure, requestPolicy, comparableAsset, browserEnvironment, finishPage, writeProgress } from '../scripts/browser/support.mjs';

const identity = { owner: 'halo-butterfly-next-comparison', schema: 1, ports: { halo: 18091, hexo: 14000 } };
test('浏览器目标只接受显式且属于所声明实验目录的本地 Halo origin', () => {
  assert.equal(validateBaseUrl('http://127.0.0.1:18091', identity), 'http://127.0.0.1:18091');
  for (const url of [undefined, 'https://example.org', 'http://localhost:18091', 'http://127.0.0.1:18092', 'http://a:b@127.0.0.1:18091', 'http://127.0.0.1:18091/path', 'http://127.0.0.1:18091/?x=1']) assert.throws(() => validateBaseUrl(url, identity));
  assert.throws(() => validateBaseUrl('http://127.0.0.1:18091', { ...identity, owner: 'some-other-app' }));
});
test('必须区分工具提交与被安装主题包来源，摘要不一致不能运行', () => {
  const sha = 'a'.repeat(40), hash = 'b'.repeat(64), installed = { sourceCommit: sha, sha256: hash };
  assert.doesNotThrow(() => validatePackage(installed, sha, hash));
  for (const source of ['master', sha.slice(0, 7), 'c'.repeat(40)]) assert.throws(() => validatePackage(installed, source, hash));
  assert.throws(() => validatePackage(installed, sha, 'd'.repeat(64)));
});
test('任务缓存拒绝认领非空目录、错误owner和指向外部的子目录', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'browser-guards-')));
  try {
    const owned = path.join(root, 'owned'); await ownRuntime(owned); await ownRuntime(owned);
    const existing = path.join(root, 'existing'); await mkdir(existing); await writeFile(path.join(existing, 'credentials.json'), 'synthetic sentinel');
    await assert.rejects(ownRuntime(existing), /nonempty/);
    await writeFile(path.join(owned, 'owner.json'), '{}'); await assert.rejects(ownRuntime(owned), /different owner/);
    const links = path.join(root, 'links'); await ownRuntime(links);
    await rm(path.join(links, 'browsers'), { recursive: true }); await symlink(existing, path.join(links, 'browsers'));
    await assert.rejects(ownRuntime(links), /symlinks/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('资源200返回HTML及404失败；本地浏览器目录不能被环境变量绕过', () => {
  assert.equal(responseFailure(200, 'text/css', 'stylesheet'), null);
  assert.equal(responseFailure(200, 'text/html; charset=UTF-8', 'stylesheet'), 'Asset returned HTML');
  assert.equal(responseFailure(404, 'image/png', 'image'), 'HTTP 404');
  const old = process.env.PLAYWRIGHT_BROWSERS_PATH;
  try { process.env.PLAYWRIGHT_BROWSERS_PATH = '/tmp/foreign-browser-cache'; assert.throws(() => browserEnvironment(), /task runtime/); }
  finally { if (old === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH; else process.env.PLAYWRIGHT_BROWSERS_PATH = old; }
});
test('文本资源仅规范化浏览器实际去掉的UTF-8 BOM，不掩盖空白或二进制差异', () => {
  const bytes = Buffer.from('body { color: red }'), bom = Buffer.from([0xef, 0xbb, 0xbf]);
  assert.deepEqual(comparableAsset(Buffer.concat([bom, bytes]), 'stylesheet'), bytes);
  assert.notDeepEqual(comparableAsset(Buffer.concat([bom, bytes]), 'image'), bytes);
  assert.notDeepEqual(comparableAsset(Buffer.concat([Buffer.from(' '), bytes]), 'stylesheet'), bytes);
});
test('拒绝Playwright会自动连接远程浏览器的Selenium环境覆盖', () => {
  const old = process.env.SELENIUM_REMOTE_URL;
  try { process.env.SELENIUM_REMOTE_URL = 'http://127.0.0.1:4444'; assert.throws(() => browserEnvironment(), /Remote browser/); }
  finally { if (old === undefined) delete process.env.SELENIUM_REMOTE_URL; else process.env.SELENIUM_REMOTE_URL = old; }
});
test('上下文关闭产生的晚到请求失败与响应体任务必须进入最终状态', async () => {
  const result = { failures: [], jsErrors: [], blockedRequests: [], requestFailures: [], resources: [] };
  const pending = [];
  await finishPage(result, pending, async () => {
    result.requestFailures.push({ reason: 'request interrupted at close' });
    pending.push(Promise.resolve().then(() => result.resources.push({ failure: 'late response body mismatch' })));
  });
  assert.equal(result.status, 'failed');
  assert(result.failures.includes('Blocked or failed requests'));
  assert(result.failures.includes('Invalid resource response or package asset mismatch'));
});
test('只放行所属origin的精确公开访客计数POST，不接受近似路径或其他写入', () => {
  const base = 'http://127.0.0.1:18091', counter = base + COUNTER_PATH;
  assert.equal(requestPolicy(counter, 'POST', base), 'visit-counter');
  assert.equal(requestPolicy(base + '/archives/', 'GET', base), 'read');
  for (const url of [counter + '/', counter + '?x=1', counter + '#fragment', counter.replace('/counter', '/%63ounter'), counter.replace('/counter', '/Counter'), base + '/apis/api.console.halo.run/v1alpha1/themes', base + '/login', counter.replace(':18091', ':18092'), counter.replace('http:', 'https:'), counter.replace('127.0.0.1', 'user:password@127.0.0.1')]) assert.equal(requestPolicy(url, 'POST', base), 'blocked', url);
  for (const method of ['PUT', 'PATCH', 'DELETE']) assert.equal(requestPolicy(counter, method, base), 'blocked');
});
test('多个不可用引擎的零页面快照不碰名且保留之前的失败记录', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'browser-progress-'));
  try {
    const states = [{ engine: 'chromium', status: 'unavailable' }, { engine: 'firefox', status: 'unavailable' }];
    const files = await Promise.all(states.map(state => writeProgress(directory, 0, state)));
    assert.notEqual(files[0], files[1]);
    assert.deepEqual(await Promise.all(files.map(async file => JSON.parse(await readFile(file, 'utf8')))), states);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
