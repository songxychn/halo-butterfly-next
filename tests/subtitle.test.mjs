import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { customSubtitles, randomSubtitle, runSubtitle } from '../src/js/modules/subtitle.mjs';
import { defaultsFromSettings, migrateConfig } from '../scripts/config-migration.mjs';

function target() {
  return { textContent: '', set innerHTML(_) { throw new Error('Subtitle content must not be parsed as HTML'); } };
}
const unused = () => { throw new Error('This branch must not request data or create Typed'); };

test('字幕关闭、第一屏关闭或没有节点均不请求 API、不创建 Typed', async () => {
  for (const [element, switches] of [[target(), { enable_subtitle: false }], [target(), { enable_above: false }], [null, {}]]) {
    await runSubtitle({ element, config: { ...switches, enable_typewriter_random_text: true, typewriter_random_api: '/fixture' },
      createTyped: unused, requestRandom: unused });
    if (element) assert.equal(element.textContent, '');
  }
});

test('静态字幕使用首项及 textContent，保留首项为空的语义且不解释 HTML', async () => {
  for (const [text, expected] of [['第一句|&|第二句', '第一句'], ['|&|第二句', ''], ['<img src=x onerror=alert(1)>|&|下一句', '<img src=x onerror=alert(1)>'], ['', ''], [null, '']]) {
    const element = target();
    await runSubtitle({ element, config: { subtitle_effect: false, typewriter_custom_text: text }, createTyped: unused, requestRandom: unused });
    assert.equal(element.textContent, expected);
  }
});

test('缺失或空值新开关保留旧版动态文案，Typed 也使用纯文本内容', async () => {
  for (const switches of [{}, { enable_subtitle: null, subtitle_effect: null }]) {
    const element = target();
    let calls = 0;
    await runSubtitle({ element, config: { ...switches, typewriter_custom_text: '旧站第一句|&|<b>第二句</b>' }, requestRandom: unused,
      createTyped: (node, options) => {
        calls++;
        assert.equal(node, element);
        assert.deepEqual(options.strings, ['旧站第一句', '<b>第二句</b>']);
        assert.equal(options.contentType, null);
        assert.equal(options.typeSpeed, 200);
      } });
    assert.equal(calls, 1);
  }
});

test('空文案不创建空循环或配置警告；换行兼容旧分隔规则', async () => {
  for (const value of ['', undefined, null, 5, '  |&|\r\n']) {
    await runSubtitle({ element: target(), config: { typewriter_custom_text: value }, createTyped: unused, requestRandom: unused });
  }
  assert.deepEqual(customSubtitles('甲\r\n乙|&|丙'), ['甲乙', '丙']);
});

test('JSON 路径可读取有效嵌套字符串，缺失路径、空值和越界数据稳定拒绝', () => {
  const response = { body: '{"data":{"content":"JSON 文案","items":["首项"]}}', contentType: 'application/json' };
  assert.equal(randomSubtitle(response, 'data.content'), 'JSON 文案');
  assert.equal(randomSubtitle(response, 'data.items.0'), '首项');
  for (const path of ['', null, 'data.missing.value', 'data', 'data..content', 'constructor', '__proto__.x']) assert.equal(randomSubtitle(response, path), null);
  assert.equal(randomSubtitle({ body: 'broken json', contentType: 'application/json' }, 'data.content'), null);
  assert.equal(randomSubtitle({ body: '<script>unsafe()</script>', contentType: 'text/javascript' }, ''), '<script>unsafe()</script>');
  assert.equal(randomSubtitle({ body: '"JSON 字符串"', contentType: 'application/json' }, ''), 'JSON 字符串');
});

test('随机 API 静态模式也取返回文案，失败、超时或无效 JSON 回退自定义首项', async () => {
  for (const response of [{ body: '远程文案', contentType: 'text/plain' }, { body: '{"data":{"text":"JSON 文案"}}', contentType: 'application/json' }, null, { body: '{"wrong":[]}', contentType: 'application/json' }]) {
    const element = target();
    let requests = 0;
    await runSubtitle({ element, config: { subtitle_effect: false, enable_typewriter_random_text: true,
      typewriter_random_api: '/fixture', typewriter_api_value_format: response?.contentType === 'application/json' ? 'data.text' : '', typewriter_custom_text: '本地首项|&|次项' }, createTyped: unused,
      requestRandom: async url => { requests++; assert.equal(url, '/fixture'); if (!response) throw new Error('timeout'); return response; } });
    assert.equal(requests, 1);
    assert.equal(element.textContent, response?.body === '远程文案' ? '远程文案' : response?.body.includes('JSON 文案') ? 'JSON 文案' : '本地首项');
  }
});

test('随机来源未启用或缺少 URL 时不请求；动态失败回退本地列表', async () => {
  for (const config of [{ enable_typewriter_random_text: false, typewriter_random_api: '/fixture' }, { enable_typewriter_random_text: true, typewriter_random_api: ' ' }]) {
    const element = target();
    await runSubtitle({ element, config: { ...config, subtitle_effect: false, typewriter_custom_text: '本地' }, createTyped: unused, requestRandom: unused });
    assert.equal(element.textContent, '本地');
  }
  let options;
  await runSubtitle({ element: target(), config: { enable_typewriter_random_text: true, typewriter_random_api: '/fixture', typewriter_custom_text: '本地甲|&|本地乙' },
    requestRandom: async () => { throw new Error('offline'); }, createTyped: (_node, value) => { options = value; } });
  assert.deepEqual(options.strings, ['本地甲', '本地乙']);
});

test('原版 2.0.5/2.0.7 迁移补齐兼容开关，显式 false 不被默认值覆盖', async () => {
  const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));
  for (const from of ['2.0.5', '2.0.7']) {
    const index = from === '2.0.5' ? { typewriter: '甲 &+& 乙' } : { typewriter_custom_text: '甲|&|乙' };
    const result = migrateConfig({ index }, from, defaults);
    assert.equal(result.config.index.enable_subtitle, true);
    assert.equal(result.config.index.subtitle_effect, true);
    assert.equal(result.config.index.typewriter_custom_text, '甲|&|乙');
    const disabled = migrateConfig({ index: { enable_subtitle: false, subtitle_effect: false } }, from, defaults);
    assert.equal(disabled.config.index.enable_subtitle, false);
    assert.equal(disabled.config.index.subtitle_effect, false);
  }
});
