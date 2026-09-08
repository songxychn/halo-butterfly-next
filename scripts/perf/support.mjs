import {readFile,writeFile,mkdir,readdir,lstat,readlink,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const FIXTURE=path.join(ROOT,'fixtures/performance');
export const RUNTIME=path.join(ROOT,'.runtime/performance');
export const PIN=JSON.parse(await readFile(path.join(FIXTURE,'versions.json'),'utf8'));
export const PROFILE=JSON.parse(await readFile(path.join(FIXTURE,'plugin-profile.json'),'utf8'));
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
export const digestObject=value=>sha256(JSON.stringify(canonical(value)));
export const readJson=async file=>JSON.parse(await readFile(file,'utf8'));
export async function writeJson(file,value){await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(value,null,2)+'\n');}
export function assert(condition,message){if(!condition)throw new Error(message);}
export function localBase(value){const u=new URL(value);assert(u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port&&u.pathname==='/'&&!u.username&&!u.password&&!u.search&&!u.hash,'Explicit owned http://127.0.0.1:port base required');return u.origin;}
export function safeName(value){assert(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(value),'Unsafe identifier');return value;}
export function settings(device){assert(PIN.devices.includes(device),'Unknown device');const mobile=device==='mobile';return {onlyCategories:['performance'],formFactor:device,screenEmulation:{mobile,width:mobile?390:1440,height:mobile?844:1000,deviceScaleFactor:1,disabled:false},emulatedUserAgent:mobile?'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.12 Mobile Safari/537.36':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.12 Safari/537.36',throttlingMethod:'simulate',throttling:{rttMs:mobile?150:40,throughputKbps:mobile?1638.4:10240,cpuSlowdownMultiplier:mobile?4:1},disableStorageReset:false,locale:'zh-CN'};}
export async function ownRuntime(runtime=RUNTIME){
 assert(path.resolve(runtime)!==ROOT&&path.resolve(runtime)!==path.parse(runtime).root,'Invalid runtime');await mkdir(runtime,{recursive:true});
 const marker=path.join(runtime,'owner.json');let saved;try{saved=await readJson(marker);}catch(e){if(e.code!=='ENOENT')throw e;assert((await readdir(runtime)).length===0,'Refusing nonempty unowned runtime');await writeJson(marker,{owner:'halo-butterfly-next-performance',schema:1});saved=await readJson(marker);}
 assert(saved.owner==='halo-butterfly-next-performance'&&saved.schema===1,'Foreign runtime');return runtime;
}
export async function treeDigest(directory){
 const entries=[];async function walk(dir){for(const name of (await readdir(dir)).sort()){const p=path.join(dir,name),s=await lstat(p),rel=path.relative(directory,p);if(s.isSymbolicLink()){const target=await realpath(p);assert(target.startsWith(await realpath(directory)+path.sep),'External browser symlink');entries.push([rel,'symlink',await readlink(p)]);}else if(s.isDirectory())await walk(p);else if(s.isFile())entries.push([rel,sha256(await readFile(p))]);}}
 await walk(directory);return digestObject(entries);
}
export function machine(){return {platform:process.platform,arch:process.arch,osRelease:os.release(),osVersion:os.version(),cpuModel:os.cpus()[0]?.model,cpuCount:os.cpus().length,totalMemory:os.totalmem(),node:process.version};}
export function sourceIdentity(){const run=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();return {sourceSha:run('rev-parse','HEAD'),workingTreeClean:run('status','--porcelain')===''};}
export function options(args,names){const values={};for(let i=0;i<args.length;i+=2){assert(names.includes(args[i])&&args[i+1]&&!args[i+1].startsWith('--')&&!Object.hasOwn(values,args[i]),'Invalid or duplicate arguments');values[args[i].slice(2)]=args[i+1];}return values;}
export async function evidence(file,root){const relative=path.relative(root,file);assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Evidence outside run');const data=await readFile(file);return {path:relative,sha256:sha256(data),bytes:data.length};}
export async function readEvidenceBytes(root,record){assert(record&&typeof record.path==='string'&&!path.isAbsolute(record.path)&&record.path.split(/[\\/]/).every(x=>x&&x!=='.'&&x!=='..'),'Invalid evidence path');const file=path.join(root,record.path),resolved=await realpath(file);assert(resolved.startsWith(await realpath(root)+path.sep),'Evidence symlink outside run');const data=await readFile(file);assert(sha256(data)===record.sha256&&data.length===record.bytes,'Evidence bytes/hash mismatch: '+record.path);return data;}

export async function readEvidence(root,record){return JSON.parse(await readEvidenceBytes(root,record));}

export function validateProfile(station,profile,route){
 assert(PIN.profiles.includes(profile)&&PIN.routes.includes(route),'Unknown performance profile/route');
 assert(digestObject(station.requiredPlugins)===digestObject(PROFILE.requiredPlugins[route]),'Missing route dependency declaration');
 assert(Array.isArray(station.plugins),'Missing actual plugin inventory');
 const actual=station.plugins.filter(p=>p.enabled).map(p=>p.name).sort();
 assert(digestObject(actual)===digestObject([...PROFILE.profiles[profile][route]].sort()),'Enabled optional plugins invalidate default/recommended route coverage');
 assert(new Set(station.plugins.map(p=>p.name)).size===station.plugins.length,'Duplicate installed plugin identity');
 for(const plugin of station.plugins.filter(p=>p.enabled))assert(plugin.version===([...PROFILE.plugins,PROFILE.probe].find(p=>p.name===plugin.name)?.version),'Unpinned enabled plugin');
}
