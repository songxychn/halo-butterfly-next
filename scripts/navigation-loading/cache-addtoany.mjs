/** Read-only public SDK downloads for a reproducible, offline-routed browser run. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {REPO,sha256} from '../browser/support.mjs';
const rows=JSON.parse(await readFile(new URL('./addtoany-sdk.json',import.meta.url)));
const directory=path.join(REPO,'.runtime/navigation-loading/addtoany-sdk');await mkdir(directory,{recursive:true});
for(const row of rows){
 const response=await fetch('https://static.addtoany.com'+row.path,{redirect:'error'});
 assert(response.ok,`${row.path}: HTTP ${response.status}`);
 const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(sha256(bytes),row.sha256,`${row.path}: audited bytes changed`);
 await writeFile(path.join(directory,row.file),bytes);
}
console.log(`Cached ${rows.length} audited AddToAny resources`);
