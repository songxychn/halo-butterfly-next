import assert from 'node:assert/strict';
import {test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {parse} from 'yaml';
import {defaultsFromSettings} from '../scripts/config-migration.mjs';
import {cssValue,iconCharacter,applyAppearance} from '../src/js/core/appearance.ts';
import {normalizeTagColors,tagFontSize} from '../src/js/core/tag-cloud-colors.ts';

test('CSS values reject stylesheet delimiters and executable/resource constructs',()=>{
  const supports=(prop,value)=>prop==='color'?/^(#[0-9a-f]{6}|red)$/.test(value):value==='18px';
  for(const value of ['red; background:url(https://bad)','</style><script>','var(--x)','url(https://bad)','expression(alert(1))',{},null]) assert.equal(cssValue('color',value,supports),'');
  assert.equal(cssValue('color',' #123456 ',supports),'#123456');
  assert.equal(cssValue('font-size','18px',supports),'18px');
  assert.equal(cssValue('color','not-a-color',supports),'');
});
test('icon settings accept private-use Unicode and reject source text or out-of-range code points',()=>{
  assert.equal(iconCharacter('\\f0c1'),'\uf0c1');
  assert.equal(iconCharacter('f2dc'),'\uf2dc');
  for(const value of ['"; color:red','110000','d800','41','']) assert.equal(iconCharacter(value),'\uf2dc');
});
test('tag colors normalize strings and arrays, preserve order, omit blank/invalid entries, and support dark pairs',()=>{
  const supports=(_,v)=>/^#[a-f0-9]{6}$/.test(v);
  assert.deepEqual(normalizeTagColors('#123456',supports),[{light:'#123456',dark:'#123456'}]);
  assert.deepEqual(normalizeTagColors([null,'', '#123456',{light:'#abcdef',dark:'#654321'},'#ffffff;display:none'],supports),[{light:'#123456',dark:'#123456'},{light:'#abcdef',dark:'#654321'}]);
  assert.equal(tagFontSize(9,[1,3,9,9]),21);
  assert.equal(tagFontSize(3,[1,3,9]),16.5);
  assert.equal(tagFontSize(4,[4,4]),12);
});
test('defaults keep legacy cards, covers, charts and system fonts while effects remain disabled',async()=>{
  const defaults=defaultsFromSettings(parse(await readFile(new URL('../settings.yaml',import.meta.url),'utf8')));
  assert.equal(defaults.aside.card_author.button.enable,true);
  assert.equal(defaults.aside.card_author.description,'');
  assert.deepEqual(defaults.aside.custom_cards,[]);
  assert.deepEqual(defaults.cover.default_cover_list,[]);
  assert.equal(defaults.appearance.category_ui,'chart');
  assert.equal(defaults.appearance.tag_ui,'chart');
  assert.equal(defaults.appearance.font.font_family,'');
  assert.equal(defaults.appearance.avatar_effect,true);
  assert.equal(defaults.appearance.enter_transitions,false);
  for(const value of Object.values(defaults.effects)) if(value && typeof value==='object') assert.equal(value.enable,false);
});
test('disabled custom palette does not override theme variables and explicit appearance settings toggle independently',()=>{
  globalThis.CSS={supports:(_,v)=>/^#|px$|serif$/.test(v)};
  const properties=new Map(), classes=new Set();
  const root={style:{setProperty:(key,value)=>properties.set(key,value)},classList:{toggle:(key,on)=>on?classes.add(key):classes.delete(key)}};
  applyAppearance({font:{global_font_size:'18px',font_family:'serif'},avatar_effect:false,hr_icon:{enable:false},theme_color:{enable:false,main:'#123456'},beautify:{enable:true,field:'post'}},root);
  assert.equal(properties.get('--global-font-size'),'18px');
  assert.equal(properties.has('--theme'),false);
  assert.equal(classes.has('appearance-avatar'),false);
  assert.equal(classes.has('appearance-no-hr-icon'),true);
  assert.equal(classes.has('appearance-beautify-post'),true);
  delete globalThis.CSS;
});
