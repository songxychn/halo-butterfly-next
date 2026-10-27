// Isolated portable reproduction: no Halo requests, credentials or plugin changes.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {readFile,writeFile,realpath,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {REPO} from '../../browser/support.mjs';
const [libraryArg,browsersArg,outputArg]=process.argv.slice(2);
const library=await realpath(libraryArg),browsers=await realpath(browsersArg),output=await realpath(outputArg);
for(const p of [library,browsers,output])assert(p.startsWith(path.join(REPO,'.runtime')+path.sep),'Only task-owned diagnostic paths');
await mkdir(path.join(output,'tmp'),{recursive:true});
Object.assign(process.env,{PLAYWRIGHT_BROWSERS_PATH:browsers,PLAYWRIGHT_SKIP_BROWSER_GC:'1',TMPDIR:path.join(output,'tmp'),TMP:path.join(output,'tmp'),TEMP:path.join(output,'tmp')});
const pw=await import(pathToFileURL(path.join(library,'index.mjs')));
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={schema:1,runtime:process.versions,playwright:JSON.parse(await readFile(path.join(library,'package.json'))).version,sourceSha256:sha(await readFile(new URL(import.meta.url))),startedAt:new Date().toISOString(),cases:[],requests:[]};
const server=http.createServer(async(req,res)=>{
 if(req.method==='POST'){
  const parts=[];for await(const b of req)parts.push(b);const body=Buffer.concat(parts);
  const row={path:req.url,bytes:body.length,sha256:sha(body),contentType:req.headers['content-type'],containsFixture:body.includes(Buffer.from('abcdefghij'))};report.requests.push(row);
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(row));
 }else{res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><title>Owned isolated File transport</title>');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
try{
 for(const routed of [false,true])for(const mode of ['fresh','restored','rewrapped-file','reconstructed-bytes']){
  const row={routed,mode};report.cases.push(row);let context,profile;
  try{
   profile=await mkdtemp(path.join(output,'tmp','profile-'));
   context=await pw.webkit.launchPersistentContext(profile,{headless:true});row.browserVersion=context.browser().version();
   if(routed)await context.route('**/*',route=>{assert(new URL(route.request().url()).origin===origin);return route.continue();});
   const page=await context.newPage();page.setDefaultTimeout(20000);
   page.on('pageerror',e=>(row.pageErrors??=[]).push(String(e)));
   await page.goto(origin,{timeout:20000});
   await page.evaluate(async()=>{
    const req=indexedDB.open('owned-file-transport',1);req.onupgradeneeded=()=>req.result.createObjectStore('drafts');
    const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(new File(['abcdefghij'],'fixture.png',{type:'image/png'}),'file');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('IDB failed'));tx.onabort=()=>reject(tx.error||Error('IDB aborted'));});db.close();
   });
   await page.reload({timeout:20000});
   row.result=await page.evaluate(async(mode)=>{
    const req=indexedDB.open('owned-file-transport',1);const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const file=await new Promise((resolve,reject)=>{const r=db.transaction('drafts','readonly').objectStore('drafts').get('file');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();
    const init={type:file.type,lastModified:file.lastModified};let value=file;
    if(mode==='fresh')value=new File(['abcdefghij'],file.name,init);
    if(mode==='rewrapped-file')value=new File([file],file.name,init);
    if(mode==='reconstructed-bytes')value=new File([await file.arrayBuffer()],file.name,init);
    const body=new FormData();body.append('files',value);
    const response=await fetch('/upload',{method:'POST',body,signal:AbortSignal.timeout(20000)});
    return {storedFileSize:file.size,storedFileText:await file.text(),metadataPreserved:value.name===file.name&&value.type===file.type&&value.lastModified===file.lastModified,status:response.status,received:await response.json()};
   },mode);
   row.transmittedExpectedData=row.result.status===200&&row.result.received.bytes>0&&row.result.received.containsFixture;
  }catch(e){row.error=String(e);}
  finally{if(context)await context.close();if(profile)await rm(profile,{recursive:true});await writeFile(path.join(output,'transport-matrix.json'),JSON.stringify(report,null,2)+'\n');}
 }
}finally{await new Promise(resolve=>server.close(resolve));report.finishedAt=new Date().toISOString();await writeFile(path.join(output,'transport-matrix.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({playwright:report.playwright,runtime:process.versions.bun?'bun':'node',cases:report.cases.map(x=>({mode:x.mode,routed:x.routed,version:x.browserVersion,transmitted:x.transmittedExpectedData,error:x.error}))}));
