import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'yaml';
import {defaultsFromSettings,migrateConfig} from '../scripts/config-migration.mjs';
import {isNightHour} from '../src/js/core/color-scheme.ts';
import {runSubtitle} from '../src/js/modules/subtitle.ts';
const defaults=defaultsFromSettings(parse(await readFile('settings.yaml','utf8')));
const migrate=input=>migrateConfig(input,'0.1.0-alpha.4',defaults);
test('alpha importer converts all coupled controls without mutating source',()=>{
 const input={index:{index_layout:'',post_layout:'tile',enable_above:false,subtitle_source:'custom',enable_typewriter_random_text:true,typewriter_random_api:'/api',typewriter_custom_text:'作者文案'},style:{mode:'auto'},darkmode:{autoChangeMode:false,start:'6',end:'18',enable:false},render:{enable_code_expander:false},appearance:{category_ui:'chart',tag_ui:'chart',avatar_effect:true}};
 const old=structuredClone(input),a=migrate(input),b=migrate(input);
 assert.deepEqual(input,old);assert.deepEqual(a,b);
 assert.equal(a.config.index.index_layout,'6');assert.equal('post_layout' in a.config.index,false);
 assert.equal(a.config.index.subtitle_source,undefined);assert.equal(a.config.index.typewriter_custom_text,'作者文案');assert.equal('enable_typewriter_random_text' in a.config.index,false);
 assert.equal(a.config.style.mode,'schedule');assert.deepEqual(a.config.darkmode,{button:false,night_start:18,night_end:6});
 assert.equal(a.config.render.code_shrink,'disabled');assert.equal(a.config.single.enable_above,false);assert.equal(a.config.image.other_pages_above,false);
 assert.deepEqual([a.config.appearance.category_ui,a.config.appearance.tag_ui,a.config.appearance.avatar_effect],['chart','chart',true]);assert(a.report.needsReview);
});
test('new missing values use consistent defaults; explicit layout beats old tile',()=>{
 const a=migrate({index:{index_layout:'5',post_layout:'tile'},style:{mode:'dark'},darkmode:{autoChangeMode:1}});
 assert.equal(a.config.index.index_layout,'5');assert.equal(a.config.style.mode,'dark');
 const b=migrate({}).config;assert.equal(b.index.index_layout,'3');assert.equal(b.index.subtitle_source,undefined);assert.equal(b.appearance.avatar_effect,false);assert.equal(b.appearance.category_ui,'list');assert.equal(b.appearance.tag_ui,'cloud');assert.equal(b.CDN.asset_base,'');
});
test('old daytime window reverses into night window and invalid values are visible in report',()=>{
 for(const [start,end,a,b] of [[0,8,8,0],[6,24,0,6],[24,6,0,6],[6,0,6,0],[0,24,18,6],[24,0,18,6],[18,6,18,6],[6,6,18,6],['bad',3,18,6]]) {
  const result=migrate({darkmode:{start,end,autoChangeMode:2}});
  assert.equal(result.config.darkmode.night_start,a);assert.equal(result.config.darkmode.night_end,b);
  if(start===end||start==='bad'||Math.abs(start-end)===24)assert(result.report.changes.some(x=>x.action==='manual-review'));
 }
});
test('resource importer retains a unified root and reports retired library sources',()=>{
 const a=migrate({CDN:{internal_provider:'custom',third_party_provider:'custom',custom_format:'https://cdn.test/${name}/${version}/${file}',option:{fontawesome:'https://private.test/font.css'}}});
 assert.equal(a.config.CDN.asset_base,'https://cdn.test/${name}/${version}');assert.equal(a.config.CDN.option,undefined);
 for(const field of ['CDN.third_party_provider','CDN.option'])assert(a.report.changes.some(x=>x.field===field&&x.action==='removed-feature'));
 assert(a.report.needsReview);assert.doesNotMatch(JSON.stringify(a),/private.test/);
 assert.equal(migrate({CDN:{internal_provider:'local',asset_base:'https://cdn.test/assets'}}).config.CDN.asset_base,'');
});
test('unrepresentable roots/templates produce manual review rather than guessed paths',()=>{
 for(const custom_format of ['https://cdn.test/${file}?v=${version}','https://cdn.test/${file}/${file}','https://cdn.test/${unsupported}/${file}','javascript:bad']) {
  const a=migrate({CDN:{internal_provider:'custom',custom_format}});assert.equal(a.config.CDN.asset_base,'');assert(a.report.changes.some(x=>x.action==='manual-review'));
 }
});
test('site subtitle is static and obsolete remote configuration is ignored',async()=>{
 let calls=0;const node={textContent:''};
 await runSubtitle({element:node,config:{site_subtitle:'站点自己的副标题'},createTyped(){calls++;},requestRandom(){throw Error('default requested network');}});
 assert.equal(node.textContent,'站点自己的副标题');assert.equal(calls,0);
 await runSubtitle({element:node,config:{subtitle_source:'custom',typewriter_random_api:'/api',typewriter_custom_text:'本地',subtitle_effect:false},requestRandom(){throw Error('removed API requested');},createTyped(){throw Error('unexpected Typed');}});
 assert.equal(node.textContent,'本地');
});


test('every representable legacy hour window keeps all 24 hourly outcomes',()=>{
 for(let start=0;start<=24;start++)for(let end=0;end<=24;end++){
  const result=migrate({style:{mode:'auto'},darkmode:{start,end}});
  const invalid=start%24===end%24;
  assert.equal(result.report.changes.some(x=>x.field==='darkmode.start/end'&&x.action==='manual-review'),invalid);
  if(invalid)continue;
  for(let hour=0;hour<24;hour++){
   const before=start<end?hour<start||hour>=end:hour>=start||hour<end;
   assert.equal(isNightHour(hour,result.config.darkmode.night_start,result.config.darkmode.night_end),before,`${start}/${end} at ${hour}`);
  }
 }
});
