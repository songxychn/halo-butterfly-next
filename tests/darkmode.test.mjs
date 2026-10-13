import assert from 'node:assert/strict';
import {test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {parse} from 'yaml';
import {defaultsFromSettings} from '../scripts/config-migration.mjs';
import {resolveMode, resolveHourBound, nightWindow, isNightHour, resolveInitialColorScheme, nextColorBoundary, shouldShowDarkmodeButton, toggleColorScheme} from '../src/js/core/darkmode.ts';
const defaults=defaultsFromSettings(parse(await readFile('settings.yaml','utf8')));
test('one policy defaults to system and only one visibility setting remains',()=>{
 assert.equal(defaults.style.mode,'system');assert.deepEqual(defaults.darkmode,{button:true,night_start:18,night_end:6});
 assert.equal(shouldShowDarkmodeButton(undefined,undefined),true);
 for(const mode of ['light','dark'])assert.equal(shouldShowDarkmodeButton(true,mode),false);
 assert.equal(shouldShowDarkmodeButton(false,'system'),false);
 for(const old of ['auto','user',undefined,'wrong'])assert.equal(resolveMode(old),'system');
});
test('fixed policy, reader preference, system and schedule have deterministic precedence',()=>{
 assert.equal(resolveInitialColorScheme({styleMode:'dark',saved:'light'}),'dark');
 assert.equal(resolveInitialColorScheme({styleMode:'light',saved:'dark'}),'light');
 assert.equal(resolveInitialColorScheme({saved:'dark',prefersDark:false}),'dark');
 assert.equal(resolveInitialColorScheme({prefersDark:true}),'dark');
 assert.equal(resolveInitialColorScheme({hour:2}),'light');
 for(const [hour,expected] of [[0,'dark'],[5,'dark'],[6,'light'],[17,'light'],[18,'dark'],[23,'dark']])assert.equal(resolveInitialColorScheme({styleMode:'schedule',hour}),expected);
 assert.equal(resolveInitialColorScheme({styleMode:'auto',hour:2}),'light');
});
test('night windows reject invalid/equal hours, allow zero and span midnight',()=>{
 assert.deepEqual(nightWindow(18,6),[18,6]);assert.deepEqual(nightWindow(0,8),[0,8]);
 for(const [a,b] of [[6,6],[24,0],['bad',9],[1.2,6],['',6]])assert.deepEqual(nightWindow(a,b),[18,6]);
 assert.equal(isNightHour(1,0,8),true);assert.equal(isNightHour(8,0,8),false);
 assert.equal(resolveHourBound(0,18),0);assert.equal(resolveHourBound(24,18),18);
 const now=new Date(2026,9,14,17,59,0);assert.equal(nextColorBoundary(now,18,6),60_000);
 assert.equal(nextColorBoundary(new Date(2026,9,14,18,0),18,6),12*3600_000);
});
test('toggle uses theme API and markup exposes named reset, no obsolete switches',async()=>{
 let calls=0;assert.equal(toggleColorScheme({toggleMode(){calls++;},getMode(){return 'dark';}}),'dark');assert.equal(calls,1);assert.equal(toggleColorScheme(null),null);
 const html=await readFile('src/html/views/components.html','utf8');
 assert.match(html,/id="darkmode-reset"/);assert.match(html,/aria-label="恢复站点默认主题"/);
 assert.doesNotMatch(html,/theme.config.darkmode\?\.enable/);
 const config=await readFile('src/html/views/config.html','utf8');assert.match(config,/darkmode_night_start/);assert.doesNotMatch(config,/autoChangeMode/);
});
