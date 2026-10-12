import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {safeResourceUrl, resolveResource, loadExternalScript} from '../src/js/core/external-resource.ts';
import {buildAnalyticsPlan, initializeAnalytics, initializeAdsense, updatePublicStats, initializeIntegrations} from '../src/js/core/integrations.ts';
import {chatPlan, initializeChat} from '../src/js/core/integration-chat.ts';
import {configureResourceTags} from '../scripts/resource-templates.mjs';
import {supportsPartialNavigation} from '../src/js/core/navigation-loading.ts';
import {readFile} from 'node:fs/promises';

const site = '12345678-1234-1234-1234-123456789abc';
const config = {baidu_analytics:'a'.repeat(32),google_analytics:'G-TEST123',cloudflare_analytics:'test-public-token',microsoft_clarity:'test123',google_tag_manager:{tag_id:'GTM-TEST'},umami_analytics:{enable:true,website_id:site}};
const root = (nodes = {}) => ({baseURI:'https://site.test/post?x=1',title:'Test',readyState:'complete',getElementById:()=>null,querySelectorAll:selector=>nodes[selector] || [],addEventListener(){},removeEventListener(){}});
const win = document => ({document,location:new URL(document.baseURI)});

test('optional SDK pages retain a full document lifecycle when PJAX is enabled',async()=>{
  const doc={documentElement:{dataset:{themeNavigation:'1'}},querySelector:()=>null,querySelectorAll:()=>[],scripts:[{type:'',dataset:{themeScript:'entry'}},{type:'',dataset:{}}]};
  assert.equal(supportsPartialNavigation(doc),false);
  doc.scripts.pop();assert.equal(supportsPartialNavigation(doc),true);
  assert.match(await readFile(new URL('../src/html/views/integrations.html',import.meta.url),'utf8'),/script data-no-pjax/);
});

test('only HTTPS and site-root resources are accepted; credentials and executable URL forms are rejected', () => {
  for (const url of ['javascript:alert(1)','data:text/javascript,x','//evil.test/x.js','http://evil.test/x.js','https://user:pass@host.test/x.js','https://host.test/a b.js','/\\evil/x','/x<y']) assert.equal(safeResourceUrl(url), '');
  assert.equal(safeResourceUrl('/x.js?v=1','http://127.0.0.1:1234/'), 'http://127.0.0.1:1234/x.js?v=1');
  assert.equal(resolveResource('main','/local.js',{option:{main:'javascript:bad'}}), '/local.js');
  assert.equal(resolveResource('main','/local.js',{option:{main:'https://cdn.test/${version}/${file}'}},'1.2','js/post.js'), 'https://cdn.test/1.2/js/post.js');
  assert.equal(resolveResource('main','/local.js',{internal_provider:'custom',custom_format:'https://cdn.test/${file}'},'1.2','js/post.js'), 'https://cdn.test/js/post.js');
  assert.equal(resolveResource('main','/local.js',{internal_provider:'custom',custom_format:'https://cdn.test/${unsupported}'},'1.2','js/post.js'), '/local.js');
});

test('empty/invalid analytics and explicitly disabled Umami create no provider request', () => {
  assert.deepEqual(buildAnalyticsPlan(), []);
  assert.deepEqual(buildAnalyticsPlan({baidu_analytics:'<script>',google_analytics:'UA-123',google_tag_manager:{tag_id:'GTM-TEST',domain:'javascript:x'},umami_analytics:{enable:'false',website_id:site}}), []);
  assert.deepEqual(buildAnalyticsPlan({umami_analytics:{enable:true,website_id:site,serverURL:'https://umami.test',script_name:'../evil.js'}}), []);
});

test('provider descriptors preserve IDs and Umami only accepts supported public tracker attributes', () => {
  const plan = buildAnalyticsPlan({...config,umami_analytics:{enable:'true',website_id:site,option:JSON.stringify({'data-tag':'demo','data-domains':'site.test','data-auto-track':'true','data-website-id':'override',onload:'alert(1)',src:'https://evil.test'})}});
  assert.equal(plan.length, 6);
  assert.equal(plan.find(x=>x.key==='cloudflare_analytics').attributes['data-cf-beacon'], '{"token":"test-public-token"}');
  assert.deepEqual(plan.find(x=>x.key==='umami_analytics').attributes, {'data-tag':'demo','data-domains':'site.test','data-website-id':site,'data-auto-track':'false'});
});

test('SDK queues exist before requests; a failed provider does not suppress others', async () => {
  const w = win(root()); let tracked; w.umami={track:fn=>tracked=fn({url:'old',title:'old'})};
  const requests=[];
  const outcome=await initializeAnalytics(config,w,async (url,opts)=>{requests.push({url,opts}); assert(w._hmt); assert(w.dataLayer || requests.length===1); return !url.includes('clarity');});
  assert.equal(outcome.filter(x=>x.loaded).length,5);
  assert.equal(w.dataLayer.length,3);
  assert.equal(w.dataLayer[1][0],'config');
  assert.deepEqual(tracked,{url:'/post?x=1',title:'Test'});
});

test('script cache reuses loads and settles native failure and timeout without uncaught rejections', async () => {
  for(const mode of ['load','error','timeout']) {
    const scripts=[];const doc={baseURI:'https://site.test/',createElement:()=>({setAttribute(){},remove(){this.removed=true;}}),head:{append:s=>scripts.push(s)}};
    const first=loadExternalScript('/script.js',{document:doc,timeout:5});
    assert.equal(loadExternalScript('/script.js',{document:doc}), first);
    assert.equal(scripts.length,1);
    if(mode!=='timeout') scripts[0]['on'+mode]();
    assert.equal(await first, mode==='load');
    assert.equal(Boolean(scripts[0].removed),mode!=='load');
  }
});

test('public statistics omit credentials, attach the article path, and validate each numeric counter', async () => {
  const uv={textContent:'—'},pv={textContent:'—'},post={textContent:'—'};
  const doc=root({'[data-umami-stat="site_uv"]':[uv],'[data-umami-stat="site_pv"]':[pv],'[data-umami-stat="page_pv"]':[post]});
  const options={enable:true,UV_PV:{site_uv:true,site_pv:true,page_pv:true,stats_url:'/public-stats'}};
  assert.equal(await updatePublicStats(options,doc,async (url,request)=>{
    assert.equal(url,'https://site.test/public-stats?path=%2Fpost'); assert.equal(request.credentials,'omit'); assert.equal(request.headers.Authorization,undefined);
    return {ok:true,json:async()=>({site_uv:0,site_pv:-1,page_pv:12})};
  }),true);
  assert.equal(uv.textContent,'0');assert.equal(pv.textContent,'—');assert.equal(post.textContent,'12');
  assert.equal(await updatePublicStats(options,doc,async()=>{throw Error('offline');}),false);
  assert.equal(await updatePublicStats({...options,enable:false},doc,()=>{throw Error('must not request');}),false);
});

test('AdSense requires a public publisher ID, does not queue failures, and queues each manual ad once', async () => {
  const ad={dataset:{}},filled={dataset:{adsbygoogleStatus:'done'}};const doc=root({'.theme-ad ins.adsbygoogle':[ad,filled]}); const w=win(doc);
  const cfg={enable:true,client:'ca-pub-1234567890123456',auto_ads:false};
  assert.equal(await initializeAdsense({...cfg,enable:false},w,doc,()=>{throw Error('disabled');}),false);
  assert.equal(await initializeAdsense(cfg,w,doc,async()=>false),false);assert.deepEqual(w.adsbygoogle,[]);
  assert.equal(await initializeAdsense(cfg,w,doc,async (url,opts)=>{assert(url.includes('client=ca-pub-1234567890123456'));assert.equal(opts.attributes.crossorigin,'anonymous');return true;}),true);
  await initializeAdsense(cfg,w,doc,async()=>true);assert.equal(w.adsbygoogle.length,1);
});

test('one document initializer loads analytics exactly once and respects all-disabled configuration', async () => {
  for(const cfg of [{},{analytics:{google_analytics:'G-TEST123'}}]) {
    const doc=root(),w=win(doc),requests=[];const opts={config:cfg,resources:{},root:doc,win:w,load:async url=>{requests.push(url);return true;}};
    assert.equal(initializeIntegrations(opts),initializeIntegrations(opts));await initializeIntegrations(opts);
    assert.equal(requests.length,cfg.analytics?1:0);
  }
});

test('chat providers reject missing and malformed identifiers instead of creating requests',()=>{
  assert.equal(chatPlan({use:'crisp',crisp:{website_id:''}}),null);
  assert.equal(chatPlan({use:'tidio',tidio:{public_key:'x.js?evil'}}),null);
  assert.equal(chatPlan({use:'unknown'}),null);
  assert.match(chatPlan({use:'knocket',knocket:{identifier:'test-123'}}).url,/identifier=test-123$/);
});

function chatFixture() {
  const events={};const attrs={}; const button={disabled:true,setAttribute:(k,v)=>attrs[k]=v,addEventListener:(k,fn)=>events[k]=fn,focus(){},remove(){this.removed=true;}};
  const widget={style:{display:''}};
  const doc={...root(),documentElement:{dataset:{}},getElementById:id=>id==='chat-btn'?button:id==='contact-widget-auto'?widget:null};
  const w={...win(doc),scrollY:0,addEventListener:(k,fn)=>events['window:'+k]=fn};
  return {w,doc,button,widget,events,attrs};
}

test('all four provider adapters enable a theme button only after load and support open/close',async()=>{
  for(const use of ['chatra','crisp','tidio','knocket']) {
    const f=chatFixture(),calls=[];
    f.w.Chatra=(...args)=>calls.push(args);f.w.$crisp={push:args=>calls.push(args)};
    f.w.tidioChatApi={open:()=>calls.push(['open']),close:()=>calls.push(['close']),show:()=>calls.push(['show']),hide:()=>calls.push(['hide']),on:(event,cb)=>{if(event==='ready')cb();}};
    const key={chatra:'id',crisp:'website_id',tidio:'public_key',knocket:'identifier'}[use];
    const cfg={use,rightside_button:true,[use]:{[key]:'test-123'}};
    assert.equal(await initializeChat(cfg,f.w,f.doc,async()=>{assert.equal(f.button.disabled,true);return true;}),true);
    assert.equal(f.button.disabled,false);f.events.click();assert.equal(f.attrs['aria-expanded'],'true');
    f.events.click();assert.equal(f.attrs['aria-expanded'],'false');
    if(use==='knocket')assert.equal(f.widget.style.display,'none'); else assert(calls.length>0);
    assert.equal(f.doc.documentElement.dataset.chatButton,use);
  }
});

test('native chat launcher follows scroll direction; failed SDK removes the inactive theme button',async()=>{
  const f=chatFixture(),calls=[];f.w.Chatra=(...args)=>calls.push(args);
  await initializeChat({use:'chatra',chatra:{id:'test'},button_hide_show:true},f.w,f.doc,async()=>true);
  f.w.scrollY=100;f.events['window:scroll']();f.w.scrollY=20;f.events['window:scroll']();
  assert.deepEqual(calls.slice(-2),[['hide'],['show']]);
  const failed=chatFixture();await initializeChat({use:'chatra',chatra:{id:'test'},rightside_button:true},failed.w,failed.doc,async()=>false);
  assert.equal(failed.button.removed,true);assert.equal(failed.events.click,undefined);
});

test('synchronous SDK opened/closed callbacks preserve the next button state',async()=>{
  const f=chatFixture(),callbacks={};
  f.w.Chatra=(command,event,callback)=>{
    if(command==='on')callbacks[event]=callback;
    if(command==='openChat')callbacks.chatOpen?.();
    if(command==='minimizeWidget')callbacks.chatClose?.();
  };
  await initializeChat({use:'chatra',chatra:{id:'test'},rightside_button:true},f.w,f.doc,async()=>true);
  f.events.click();assert.equal(f.attrs['aria-expanded'],'true');
  f.events.click();assert.equal(f.attrs['aria-expanded'],'false');
});

test('template generation resolves only real theme resources, adds fallback, and separates optional integrations',()=>{
  const html=configureResourceTags('<script defer th:src="${assets_link + \'js/post.min.js?v=\' + theme.spec.version}"></script><link rel="stylesheet" th:href="${assets_link + \'plugins/fontawesome/css/all.min.css\'}">');
  assert.match(html,/data-resource-key='main'/);assert.match(html,/data-resource-key='fontawesome'/);
  assert.match(html,/s\.src=this\.dataset\.localResource;this\.replaceWith\(s\)/);assert.match(html,/this\.href=this\.dataset\.localResource/);
  assert.match(html,/@fortawesome\/fontawesome-free/);assert.doesNotMatch(html,/hexo-theme-butterfly@/);
  const allowed=new RegExp('^('+html.match(/candidateResource\.matches\('([^']+)'\)/)[1].replaceAll('&amp;','&')+')$');
  assert(allowed.test('https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.7.2/css/all.min.css'));
  assert(allowed.test('/theme/js/post.min.js?v=1'));
  assert.equal(allowed.test('https://user:pass@host.test/file.js'),false);
  assert.match(html,/#strings\.startsWith\(candidateResource, '\/\/'\)/);
  assert.match(configureResourceTags('<script th:src="${assets_link + \'js/integrations.min.js?v=\' + theme.spec.version}"></script>'),/data-resource-key='integrations'/);
});

test('public config whitelist excludes any saved Umami API token and raw HTML uses dedicated admin ad slots',async()=>{
  const configHtml=await readFile(new URL('../src/html/views/config.html',import.meta.url),'utf8');
  assert.doesNotMatch(configHtml,/UV_PV\?*\.token|\[\[\$\{theme.config.analytics\}\]\]/);
  const components=await readFile(new URL('../src/html/views/components.html',import.meta.url),'utf8');
  assert.match(components,/homePage and stat.count % 3 == 0/);
  assert.match(components,/views\/integration-ads::content\(\$\{theme.config.ad.index\}\)/);
});
