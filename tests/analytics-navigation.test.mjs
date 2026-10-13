import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {manualAnalyticsId,initializeManualAnalytics,supportsAnalyticsNavigation,trackCommittedAnalytics} from '../src/js/core/analytics-navigation.ts';
const config={analytics:{google_analytics:'G-TEST123',google_analytics_manual_pageviews:true}};
function fixture(){
 const root=new EventTarget();root.title='Initial';root.referrer='https://referrer.test/';root.querySelector=()=>({dataset:{analyticsId:'G-TEST123'}});
 const win={location:new URL('https://site.test/post#section'),document:root};return {root,win};
}
test('manual analytics requires explicit opt-in, one supported provider, and the official SDK',()=>{
 assert.equal(manualAnalyticsId(config),'G-TEST123');
 for(const changed of [{analytics:{google_analytics:'G-TEST123'}},{analytics:{...config.analytics,cloudflare_analytics:'token'}},{...config,chat:{use:'chatra'}},{...config,adsense:{enable:true}}])assert.equal(manualAnalyticsId(changed),'');
 assert.equal(manualAnalyticsId(config,{option:{google_analytics:'https://custom.test/tracker.js'}}),'');
});
test('one SDK and config, committed page events retain exact identity/referrer without reacting to history',async()=>{
 const {root,win}=fixture();let loads=0,resolve;
 const load=()=>{loads++;return new Promise(r=>resolve=r)};
 const first=initializeManualAnalytics('G-TEST123',root,win,load);
 assert.equal(initializeManualAnalytics('G-TEST123',root,win,load),first);assert.equal(loads,1);
 assert.equal(supportsAnalyticsNavigation(root,win),false);assert.equal(win.dataLayer[1][2].send_page_view,false);
 resolve(true);await first;assert.equal(supportsAnalyticsNavigation(root,win),true);
 const events=()=>win.dataLayer.filter(args=>args[0]==='event');
 assert.equal(events().length,1);assert.equal(events()[0][2].page_location,'https://site.test/post');
 win.location=new URL('https://site.test/cancelled');root.dispatchEvent(new Event('popstate'));
 win.location=new URL('https://site.test/post');assert.equal(events().length,1);
 win.location=new URL('https://site.test/next?x=1#body');root.title='Next';root.dispatchEvent(new Event('pjax:complete'));
 assert.deepEqual(events()[1][2],{send_to:'G-TEST123',page_location:'https://site.test/next?x=1',page_title:'Next',page_referrer:'https://site.test/post'});
 root.querySelector=()=>({dataset:{analyticsId:'G-OTHER'}});assert.equal(supportsAnalyticsNavigation(root,win),false);trackCommittedAnalytics(root,win);assert.equal(events().length,2);
 root.querySelector=()=>null;assert.equal(supportsAnalyticsNavigation(root,win),false);
});
test('failed and rejected SDK loads retain native navigation without queued pageview',async()=>{
 for(const load of [async()=>false,async()=>{throw Error('blocked')}]){
  const {root,win}=fixture();assert.equal(await initializeManualAnalytics('G-TEST123',root,win,load),false);
  assert.equal(supportsAnalyticsNavigation(root,win),false);root.dispatchEvent(new Event('pjax:complete'));
  assert.equal(win.dataLayer.filter(args=>args[0]==='event').length,0);
 }
});
