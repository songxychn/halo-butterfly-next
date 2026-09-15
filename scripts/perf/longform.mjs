import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FIXTURE,assert,readJson,sha256,digestObject} from './support.mjs';
export async function longform(directory=path.join(FIXTURE,'longform')){
 const meta=await readJson(path.join(directory,'fixture.json'));assert(meta.schema===1&&meta.name==='perf-longform-v1'&&meta.title==='性能基准：固定长文章'&&meta.date==='2026-08-01T04:00:00Z'&&meta.cover==='/lab/perf-chart-01.svg','Unexpected longform identity');
 assert(digestObject(meta.counts)===digestObject({sections:20,codeBlocks:8,tables:2,images:12,minimumHanCharacters:10000}),'Unexpected longform coverage metadata');
 for(const [file,hash] of Object.entries(meta.files)){assert(!path.isAbsolute(file)&&!file.split(/[\\/]/).some(p=>p==='..'||!p),'Unsafe fixture path');assert(sha256(await readFile(path.join(directory,file)))===hash,'Longform hash mismatch: '+file);}
 const body=await readFile(path.join(directory,'article.html'),'utf8');
 assert((body.match(/<h2\b/g)||[]).length===20&&(body.match(/<pre>/g)||[]).length===8&&(body.match(/<table>/g)||[]).length===2&&(body.match(/<img\b/g)||[]).length===12,'Longform semantic coverage changed');
 assert((body.match(/[\u4e00-\u9fff]/g)||[]).length>=10000,'Longform became a short article');
 assert(!/https?:|\/\/|<script|<iframe|<link|\bon\w+=/i.test(body),'External/active content in synthetic longform');
 const sources=[...body.matchAll(/src="([^"]+)"/g)].map(m=>m[1]);assert(sources.length===12&&new Set(sources).size===12&&sources.every(s=>/^\/lab\/perf-chart-\d{2}\.svg$/.test(s)&&meta.files['assets/'+path.basename(s)]),'Unexpected image source');
 assert((await readdir(path.join(directory,'assets'))).length===12,'Unexpected asset count');
 return {meta,body,fixtureSha256:digestObject(meta)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){assert(process.argv.length===3&&process.argv[2]==='--check','Usage: node scripts/perf/longform.mjs --check');const f=await longform();console.log(JSON.stringify({name:f.meta.name,bytes:Buffer.byteLength(f.body),fixtureSha256:f.fixtureSha256,counts:f.meta.counts}));}
