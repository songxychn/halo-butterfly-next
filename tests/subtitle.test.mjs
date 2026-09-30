import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { customSubtitles, randomSubtitle, runSubtitle, subtitleSource, subtitleTypedOptions } from '../src/js/modules/subtitle.ts';
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

test('缺失或空值新开关保留旧版动态文案及自定义 HTML 行为', async () => {
  for (const switches of [{}, { enable_subtitle: null, subtitle_effect: null }]) {
    const element = target();
    let calls = 0;
    await runSubtitle({ element, config: { ...switches, typewriter_custom_text: '旧站第一句|&|<b>第二句</b>' }, requestRandom: unused,
      createTyped: (node, options) => {
        calls++;
        assert.equal(node, element);
        assert.deepEqual(options.strings, ['旧站第一句', '<b>第二句</b>']);
        assert.equal(options.contentType, 'html');
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
  assert.equal(options.contentType, 'html');
});

test('动态远程文案按纯文本呈现，失败回退仍保留作者的自定义 HTML', async () => {
  const config = { enable_typewriter_random_text: true, typewriter_random_api: '/fixture', typewriter_custom_text: '<b>作者文案</b>' };
  for (const success of [true, false]) {
    let options;
    await runSubtitle({ element: target(), config,
      requestRandom: async () => { if (!success) throw new Error('offline'); return { body: '<img src=x onerror=alert(1)>', contentType: 'text/plain' }; },
      createTyped: (_node, value) => { options = value; } });
    assert.equal(options.contentType, success ? null : 'html');
    assert.deepEqual(options.strings, [success ? '<img src=x onerror=alert(1)>' : '<b>作者文案</b>']);
  }
});

test('原版 2.0.5/2.0.7 迁移补齐兼容开关，显式 false 不被默认值覆盖', async () => {
  const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));
  for (const from of ['2.0.5', '2.0.7']) {
    const index = from === '2.0.5' ? { typewriter: '甲 &+& 乙' } : { typewriter_custom_text: '甲|&|乙' };
    const result = migrateConfig({ index }, from, defaults);
    assert.equal(result.config.index.enable_subtitle, true);
    assert.equal(result.config.index.subtitle_effect, true);
    assert.equal(result.config.index.subtitle_source, 'custom');
    assert.equal(result.config.index.subtitle_typed_option, '');
    assert.equal(result.config.index.typewriter_custom_text, '甲|&|乙');
    const disabled = migrateConfig({ index: { enable_subtitle: false, subtitle_effect: false } }, from, defaults);
    assert.equal(disabled.config.index.enable_subtitle, false);
    assert.equal(disabled.config.index.subtitle_effect, false);
  }
});

test('来源缺省兼容自定义 API；显式本地或未知来源不误请求旧 API', () => {
  const legacy = { enable_typewriter_random_text: true, typewriter_random_api: '/legacy', typewriter_api_value_format: 'data.text' };
  for (const source of [undefined, null, '', 'custom']) assert.deepEqual(subtitleSource({ ...legacy, subtitle_source: source }), { kind: 'custom', url: '/legacy', path: 'data.text' });
  for (const source of [false, 'false', 0, '0', 'invalid']) assert.equal(subtitleSource({ ...legacy, subtitle_source: source }), null);
  for (const source of [1, '1', 2, '2', 3, '3']) assert.ok(subtitleSource({ subtitle_source: source }).url.startsWith('https://'));
});

test('内置来源动态按远端、出处、本地顺序播放；静态只显示远端首项', async () => {
  const cases = [
    ['1', { body: JSON.stringify({ hitokoto: '<img src=x onerror=alert(1)>', from: '<b>出处</b>' }) }, ['&lt;img src=x onerror=alert(1)&gt;', '出自 &lt;b&gt;出处&lt;/b&gt;']],
    ['2', { body: '<p>远端 & <b>文字</b></p><p>不取第二项</p>', contentType: 'text/html' }, ['远端 &amp; &lt;b&gt;文字&lt;/b&gt;']],
    ['3', { body: JSON.stringify({ status: 'success', data: { content: '今日诗词' } }) }, ['今日诗词']],
  ];
  for (const [source, response, remote] of cases) {
    const config = { subtitle_source: source, enable_typewriter_random_text: false, typewriter_custom_text: '<b>本地</b>|&|末项' };
    let options;
    let requests = 0;
    await runSubtitle({ element: target(), config, requestRandom: async (url, request) => {
      requests++;
      assert.equal(url, subtitleSource(config).url);
      assert.equal(request.withCredentials === true, source === '3');
      return response;
    }, createTyped: (_node, value) => { options = value; } });
    assert.equal(requests, 1);
    assert.deepEqual(options.strings, [...remote, '<b>本地</b>', '末项']);
    assert.equal(options.contentType, 'html');
    const element = target();
    await runSubtitle({ element, config: { ...config, subtitle_effect: false }, requestRandom: async () => response, createTyped: unused });
    assert.equal(element.textContent, remote[0].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
  }
});

test('内置来源失败或结构错误回退本地，空本地不创建 Typed；远端独立显示保持纯文本', async () => {
  for (const source of ['1', '2', '3']) {
    for (const response of [null, { body: '{}' }, { body: '<p></p>' }, { body: '{"data":{"content":12},"hitokoto":null}' }]) {
      let options;
      const requestRandom = async () => { if (!response) throw new Error('timeout'); return response; };
      await runSubtitle({ element: target(), config: { subtitle_source: source, typewriter_custom_text: '<b>回退</b>|&|第二项' }, requestRandom, createTyped: (_node, value) => { options = value; } });
      assert.deepEqual(options.strings, ['<b>回退</b>', '第二项']);
      await runSubtitle({ element: target(), config: { subtitle_source: source, typewriter_custom_text: '' }, requestRandom, createTyped: unused });
    }
  }
  let options;
  await runSubtitle({ element: target(), config: { subtitle_source: '1' }, requestRandom: async () => ({ body: '{"hitokoto":"<script>x</script>"}' }), createTyped: (_node, value) => { options = value; } });
  assert.equal(options.contentType, null);
  assert.deepEqual(options.strings, ['<script>x</script>']);
});

test('Typed 参数支持速度、循环、光标等声明式选项并忽略错误类型和行为覆盖', async () => {
  const value = { typeSpeed: 150, startDelay: 0, backSpeed: 30, backDelay: 800, smartBackspace: false, shuffle: true, fadeOut: true, fadeOutClass: 'subtitle-fade', fadeOutDelay: 20, loop: false, loopCount: 2, showCursor: false, cursorChar: '<b>|</b>', autoInsertCss: false, bindInputFocusEvents: true };
  assert.deepEqual(subtitleTypedOptions(JSON.stringify(value)), { ...value, cursorChar: '&lt;b&gt;|&lt;/b&gt;' });
  assert.equal(subtitleTypedOptions('{"loopCount":"Infinity"}').loopCount, Infinity);
  for (const invalid of ['broken', '[]', 'null', null, 42]) assert.deepEqual(subtitleTypedOptions(invalid), {});
  assert.deepEqual(subtitleTypedOptions({ typeSpeed: -1, startDelay: Infinity, backSpeed: '50', loop: 'false', loopCount: -1, fadeOutClass: 'two classes', strings: ['override'], contentType: 'html', stringsElement: '#secret', attr: 'src', onComplete: 'alert(1)' }), {});
  let options;
  await runSubtitle({ element: target(), config: { typewriter_custom_text: '正文', subtitle_typed_option: JSON.stringify(value) }, requestRandom: unused, createTyped: (_node, result) => { options = result; } });
  assert.equal(options.typeSpeed, 150);
  assert.equal(options.loop, false);
  assert.deepEqual(options.strings, ['正文']);
  assert.equal(options.contentType, 'html');
  await runSubtitle({ element: target(), config: { subtitle_effect: false, typewriter_custom_text: '正文', subtitle_typed_option: '{"showCursor":true}' }, requestRandom: unused, createTyped: unused });
});
