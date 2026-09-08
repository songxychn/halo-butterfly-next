import {assert,PIN,settings,digestObject} from './support.mjs';
export const auditIds={lcp:'largest-contentful-paint',tbt:'total-blocking-time',cls:'cumulative-layout-shift'};
export function median(values){assert(values.length===PIN.samples&&values.every(x=>Number.isFinite(x)&&x>=0),'Exactly five finite nonnegative samples required');return [...values].sort((a,b)=>a-b)[2];}
export function regressed(base,candidate,ratio,absolute){assert([base,candidate,ratio,absolute].every(x=>Number.isFinite(x)&&x>=0),'Invalid budget input');const delta=candidate-base;return delta>absolute&&delta>base*ratio;}
export function validateLhr(lhr,{url,device}){
 assert(lhr&&lhr.lighthouseVersion===PIN.lighthouse&&!lhr.runtimeError,'Wrong Lighthouse version or runtimeError');
 assert(lhr.requestedUrl===url&&lhr.finalDisplayedUrl===url,'Lighthouse URL changed');
 const errors=lhr.audits?.['errors-in-console'];assert(errors?.score===1&&Array.isArray(errors.details?.items)&&errors.details.items.length===0,'Browser console errors or missing error audit');
 const expected=settings(device),actual=lhr.configSettings;assert(actual,'Missing resolved config');
 for(const key of ['formFactor','throttlingMethod','disableStorageReset','emulatedUserAgent','locale'])assert(actual[key]===expected[key],'Wrong Lighthouse setting: '+key);
 for(const key of ['onlyCategories','onlyAudits'])assert(digestObject(actual[key])===digestObject(expected[key]),'Wrong audit selection: '+key);
 for(const key of ['screenEmulation','throttling'])for(const [field,value] of Object.entries(expected[key]))assert(actual[key]?.[field]===value,'Wrong Lighthouse setting: '+key+'.'+field);
 const result={};for(const [key,id] of Object.entries(auditIds)){const a=lhr.audits?.[id];assert(a&&!a.errorMessage&&Number.isFinite(a.numericValue)&&a.numericValue>=0,'Missing/nonfinite/error metric: '+id);result[key]=a.numericValue;}
 const items=lhr.audits?.['network-requests']?.details?.items;assert(Array.isArray(items)&&items.length>0,'Missing raw network audit');
 const base=new URL(url);let js=0,css=0,transfer=0;const network=[];
 for(const row of items){
  const u=new URL(row.url);if(!['http:','https:'].includes(u.protocol))continue;
  assert(u.origin===base.origin,'External request cannot be certified by local performance fixture: '+u.origin);
  assert(Number.isFinite(row.transferSize)&&row.transferSize>=0&&Number.isFinite(row.resourceSize)&&row.resourceSize>=0,'Missing transfer/decoded resource sizes');
  assert(row.finished===true&&Number.isFinite(row.statusCode)&&row.statusCode>=200&&row.statusCode<400,'Failed or unfinished request in navigation sample');
  const theme=u.pathname.startsWith('/themes/halo-butterfly-next/assets/');const type=/\.m?js$/i.test(u.pathname)?'js':/\.css$/i.test(u.pathname)?'css':'other';
  if(theme&&type==='js')js+=row.resourceSize;if(theme&&type==='css')css+=row.resourceSize;transfer+=row.transferSize;
  network.push({url:row.url,theme,type,transferBytes:row.transferSize,decodedBytes:row.resourceSize});
 }
 assert(js>0&&css>0,'Expected theme script and stylesheet missing');
 return {...result,themeJsBytes:js,themeCssBytes:css,requests:network.length,transferBytes:transfer,network,resolvedConfigHash:digestObject(actual)};
}
export function summarize(samples){assert(samples.length===5,'Exactly five samples required');return Object.fromEntries(['lcp','tbt','cls','themeJsBytes','themeCssBytes','requests','transferBytes'].map(key=>[key,median(samples.map(x=>x[key]))]));}
export function budgets(base,candidate){return {
 absolute:{lcp:candidate.lcp<=2500,tbt:candidate.tbt<=200,cls:candidate.cls<=.10},
 regression:{lcp:!regressed(base.lcp,candidate.lcp,.10,100),tbt:!regressed(base.tbt,candidate.tbt,.10,100),cls:candidate.cls-base.cls<=.02+Number.EPSILON},
 size:{js:!regressed(base.themeJsBytes,candidate.themeJsBytes,.10,20*1024),css:!regressed(base.themeCssBytes,candidate.themeCssBytes,.10,20*1024)}
};}
