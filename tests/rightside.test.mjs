import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { toggleRightsideConfigHide } from '../src/js/core/rightside.mjs';

const componentsHtml = await readFile(new URL('../src/html/views/components.html', import.meta.url), 'utf8');
const scss = await readFile(new URL('../src/scss/core/rightside.scss', import.meta.url), 'utf8');
const commonJs = await readFile(new URL('../src/js/core/common.js', import.meta.url), 'utf8');
const renderJs = await readFile(new URL('../src/js/modules/Render.js', import.meta.url), 'utf8');
const indexScss = await readFile(new URL('../src/scss/core/index.scss', import.meta.url), 'utf8');

test('模板：#rightside 骨架、hide/show 组、齿轮与 #go-up；无新增 th:utext', () => {
  assert.match(componentsHtml, /id="rightside"/);
  assert.match(componentsHtml, /class="side-btn"/);
  assert.match(componentsHtml, /id="rightside-config-hide"/);
  assert.match(componentsHtml, /id="rightside-config-show"/);
  assert.match(componentsHtml, /id="rightside-config"/);
  assert.match(componentsHtml, /id="go-up"/);
  assert.match(componentsHtml, /id="hide-aside-btn"/);
  assert.match(componentsHtml, /hideBtnOn/);
  assert.match(componentsHtml, /hideBtnOn or darkBtnOn or readmodeOn/);
  assert.match(componentsHtml, /fa-cog/);
  const hideIdx = componentsHtml.indexOf('id="rightside-config-hide"');
  const showIdx = componentsHtml.indexOf('id="rightside-config-show"');
  const hideBtnIdx = componentsHtml.indexOf('id="hide-aside-btn"');
  const goUpIdx = componentsHtml.indexOf('id="go-up"');
  assert.ok(hideIdx > 0 && hideBtnIdx > hideIdx && hideBtnIdx < showIdx);
  assert.ok(goUpIdx > showIdx);
  assert.doesNotMatch(componentsHtml, /th:utext/);
  assert.match(commonJs, /bindRightsideConfig/);
  assert.match(indexScss, /rightside/);
});

test('样式：hide 组 .show；窄屏隐藏 #hide-aside-btn', () => {
  assert.match(scss, /#rightside-config-hide/);
  assert.match(scss, /&\.show/);
  assert.match(scss, /max-width:\s*900px/);
  assert.match(scss, /#hide-aside-btn/);
});

test('交互：齿轮切换 #rightside-config-hide.show', () => {
  const names = new Set();
  const el = {
    classList: {
      contains(name) { return names.has(name); },
      toggle(name) {
        if (names.has(name)) names.delete(name);
        else names.add(name);
      },
    },
  };
  assert.equal(toggleRightsideConfigHide(el), true);
  assert.equal(names.has('show'), true);
  assert.equal(toggleRightsideConfigHide(el), false);
  assert.equal(names.has('show'), false);
});

test('移动目录按钮插入 show 组 #go-up 之前', () => {
  assert.match(renderJs, /rightside-config-show/);
  assert.match(renderJs, /mobile-toc-button/);
  assert.match(renderJs, /insertBefore\(goUp\)/);
});
