import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { defaultsFromSettings } from '../scripts/config-migration.mjs';
import { isNavAlwaysPinned, navScrollAppearance } from '../src/js/core/nav-scroll.ts';

const defaults = defaultsFromSettings(parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8')));

test('导航默认对齐上游 nav.fixed=false 且显示站点名与文章标题', () => {
  assert.equal(defaults.nav.fixed, false);
  assert.equal(defaults.nav.logo, '');
  assert.equal(defaults.nav.display_title, true);
  assert.equal(defaults.nav.display_post_title, true);
  assert.equal(defaults.index.top_img_height, '');
  assert.equal(defaults.index.site_info_top, '');
});

test('nav.fixed 为 true 时始终吸顶，不走滚动显隐', () => {
  assert.equal(isNavAlwaysPinned(true), true);
  assert.equal(isNavAlwaysPinned(false), false);
  assert.equal(isNavAlwaysPinned(undefined), false);
});

test('默认滚动：超过阈值后下滚隐藏、上滚显示，回顶清除', () => {
  assert.deepEqual(navScrollAppearance({scrollTop: 57, previousTop: 50}), {style: true, active: false});
  assert.deepEqual(navScrollAppearance({scrollTop: 80, previousTop: 90}), {style: true, active: true});
  assert.deepEqual(navScrollAppearance({scrollTop: 0, previousTop: 80}), {style: false, active: false});
  assert.equal(navScrollAppearance({scrollTop: 20, previousTop: 10}), null);
  assert.deepEqual(
    navScrollAppearance({scrollTop: 57, previousTop: 50, alwaysPinned: false}),
    {style: true, active: false},
  );
});

test('nav.fixed=true 过阈值才加 style、回顶清 style，且不加 active', () => {
  assert.deepEqual(
    navScrollAppearance({scrollTop: 57, previousTop: 50, alwaysPinned: true}),
    {style: true, active: false},
  );
  assert.deepEqual(
    navScrollAppearance({scrollTop: 80, previousTop: 90, alwaysPinned: true}),
    {style: true, active: false},
  );
  assert.deepEqual(
    navScrollAppearance({scrollTop: 0, previousTop: 80, alwaysPinned: true}),
    {style: false, active: false},
  );
  assert.equal(navScrollAppearance({scrollTop: 20, previousTop: 10, alwaysPinned: true}), null);
  assert.equal(navScrollAppearance({scrollTop: 56, previousTop: 40, alwaysPinned: true}), null);
});

test('文章标题切换只绑定 .style.has-post，fixed.style 保持 top:0', async () => {
  const navScss = await readFile(new URL('../src/scss/core/nav.scss', import.meta.url), 'utf8');
  assert.match(navScss, /&\.style\.has-post/);
  assert.doesNotMatch(navScss, /&:is\(\.style,\s*\.fixed\)\.has-post/);
  assert.match(navScss, /&\.fixed[\s\S]*?&\.style\s*\{[\s\S]*?top:\s*0/);
  const scrollJs = await readFile(new URL('../src/js/core/scroll.ts', import.meta.url), 'utf8');
  assert.match(scrollJs, /alwaysPinned:\s*this\.#fixed/);
  assert.doesNotMatch(scrollJs, /if \(this\.#fixed\) return;/);
});

test('导航模板按设置条件输出 logo、站点名和文章标题', async () => {
  const nav = await readFile(new URL('../src/html/views/nav.html', import.meta.url), 'utf8');
  assert.match(nav, /theme\.config\.nav\.logo/);
  assert.match(nav, /display_title != false/);
  assert.match(nav, /display_post_title != false/);
  assert.match(nav, /nav\.fixed == true \? ' fixed'/);
  const index = await readFile(new URL('../src/html/index.html', import.meta.url), 'utf8');
  assert.match(index, /top_img_height/);
  assert.match(index, /site_info_top/);
});
