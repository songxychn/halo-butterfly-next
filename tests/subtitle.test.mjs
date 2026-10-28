import assert from 'node:assert/strict';
import {test} from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { customSubtitles, runSubtitle, subtitleTypedOptions } from '../src/js/modules/subtitle.ts';
import { defaultsFromSettings, migrateConfig } from '../scripts/config-migration.mjs';

function target() {
  return { textContent: '', set innerHTML(_) { throw new Error('Subtitle content must not be parsed as HTML'); } };
}
const unused = () => { throw new Error('This branch must not request data or create Typed'); };

test('字幕关闭、第一屏关闭或没有节点均不请求 API、不创建 Typed', async () => {
  for (const [element, switches] of [[target(), { enable_subtitle: false }], [target(), { enable_above: false }], [null, {}]]) {
    await runSubtitle({ element, config: { ...switches, subtitle_source: 'custom', typewriter_random_api: '/fixture' },
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

test('原版 2.0.5/2.0.7 迁移补齐兼容开关，显式 false 不被默认值覆盖', async () => {
  const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));
  for (const from of ['2.0.5', '2.0.7']) {
    const index = from === '2.0.5' ? { typewriter: '甲 &+& 乙' } : { typewriter_custom_text: '甲|&|乙' };
    const result = migrateConfig({ index }, from, defaults);
    assert.equal(result.config.index.enable_subtitle, true);
    assert.equal(result.config.index.subtitle_effect, true);
    assert.equal(result.config.index.subtitle_typed_option, '');
    assert.equal(result.config.index.typewriter_custom_text, '甲|&|乙');
    const disabled = migrateConfig({ index: { enable_subtitle: false, subtitle_effect: false } }, from, defaults);
    assert.equal(disabled.config.index.enable_subtitle, false);
    assert.equal(disabled.config.index.subtitle_effect, false);
  }
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
