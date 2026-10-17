/** Exact offline slicing of a mixed-engine private log; never filters protocol events. */
import assert from 'node:assert/strict';
import {readFile, realpath, stat, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PREFIX = 'HBN_COMBINATION_PROTOCOL ';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function extractWebKitProtocol(bytes) {
  const report = {schema:1, result:'incomplete-capture', sourceSha256:sha(bytes), sourceBytes:bytes.length,
    engines:[], cases:[], errors:[], limitations:[
      'Capture completeness only; case outcomes and all strict acceptance errors remain in browser-report.json.',
      'The exact WebKit byte interval includes all protocol events, including unknown scopes; no event filtering or cancellation exemption.',
      'Context close timestamps delimit teardown observations, not a causal rule permitting failures.',
    ]};
  let offset=0, line=0, runId=null, engine=null, currentCase=null, caseIndex=0, lastMonotonic=-1n;
  const order=['chromium','firefox','webkit'];
  try {
    while(offset<bytes.length) {
      const end=bytes.indexOf(10,offset), next=end<0?bytes.length:end+1;
      const text=bytes.subarray(offset,end<0?next:end).toString('utf8').replace(/\r$/, '');
      line++;
      if(text.startsWith(PREFIX)) {
        const marker=JSON.parse(text.slice(PREFIX.length));
        assert.equal(marker.schema,1);
        assert.match(marker.runId,/^[a-f0-9]{20}$/);
        if(runId===null)runId=marker.runId;
        assert.equal(marker.runId,runId,'Mixed run IDs');
        assert(Number.isFinite(Date.parse(marker.at)),'Missing marker timestamp');
        assert.match(marker.monotonicNs,/^\d+$/);
        assert(BigInt(marker.monotonicNs)>=lastMonotonic,'Lifecycle monotonic timestamps went backwards');
        lastMonotonic=BigInt(marker.monotonicNs);
        const stamp={at:marker.at,monotonicNs:marker.monotonicNs,line,byteOffset:offset};
        if(marker.event==='engine-start') {
          assert(!engine&&!currentCase,'Overlapping engine scopes');
          assert.equal(marker.engine,order[report.engines.length],'Unexpected engine order/count');
          engine={engine:marker.engine,start:stamp,cases:[]};caseIndex=0;
          report.engines.push(engine);
        } else {
          assert(engine,'Marker outside engine scope');
          assert.equal(marker.engine,engine.engine,'Engine scope mismatch');
          if(marker.event==='case-start') {
            assert(!currentCase,'Overlapping cases');
            assert.equal(marker.color,['light','dark'][caseIndex],'Unexpected case order/count');
            assert.equal(marker.caseId,engine.engine+'-'+marker.color);
            currentCase={caseId:marker.caseId,engine:marker.engine,color:marker.color,start:stamp,navigationIntents:0};
            engine.cases.push(currentCase.caseId);report.cases.push(currentCase);
          } else if(marker.event==='engine-end') {
            assert(!currentCase,'Engine ended before case completion');
            assert.equal(caseIndex,2,'Engine did not capture both cases');
            engine.end={...stamp,outcome:marker.outcome,byteEndExclusive:next};
            assert.equal(marker.outcome,'closed','Browser close did not complete');
            engine=null;
          } else {
            assert(currentCase,'Case marker outside case');
            assert.equal(marker.caseId,currentCase.caseId,'Case scope mismatch');
            assert.equal(marker.color,currentCase.color,'Case color mismatch');
            if(marker.event==='navigation-intent') {
              assert(!currentCase.closeStart,'Navigation after close started');
              assert(['initial-goto','native-link'].includes(marker.kind),'Unknown navigation intent');
              currentCase.navigationIntents++;
            } else if(marker.event==='context-close-start') {
              assert(!currentCase.closeStart,'Duplicate close start');currentCase.closeStart=stamp;
            } else if(marker.event==='context-close-end') {
              assert(currentCase.closeStart&&!currentCase.closeEnd,'Unpaired close end');
              assert.equal(marker.outcome,'closed','Context close did not complete');
              assert(BigInt(marker.monotonicNs)>=BigInt(currentCase.closeStart.monotonicNs),'Reversed close timestamps');
              currentCase.closeEnd={...stamp,outcome:marker.outcome};
            } else if(marker.event==='case-end') {
              assert(currentCase.closeEnd,'Case ended without completed context close');
              currentCase.end=stamp;currentCase=null;caseIndex++;
            } else throw new Error('Unknown lifecycle marker');
          }
        }
      }
      offset=next;
    }
    assert(!engine&&!currentCase,'Missing lifecycle end');
    assert.equal(report.engines.length,3,'Missing engine scope');
    assert.equal(report.cases.length,6,'Missing case scope');
    const wk=report.engines[2];
    const slice=bytes.subarray(wk.start.byteOffset,wk.end.byteEndExclusive);
    report.runId=runId;report.result='complete-six-case-capture-webkit-sliced';
    report.slice={engine:'webkit',startByte:wk.start.byteOffset,endByteExclusive:wk.end.byteEndExclusive,
      startLine:wk.start.line,endLine:wk.end.line,bytes:slice.length,sha256:sha(slice)};
    return {report,slice};
  } catch(error) {
    report.runId=runId;report.errors.push({line,message:String(error.message)});
    return {report,slice:null};
  }
}

async function main() {
  assert.equal(process.argv.length,5,'Usage: bun extract-webkit-protocol.mjs <mixed-private.log> <new-webkit.private.log> <new-manifest.json>');
  const runtime=await realpath(path.join(ROOT,'.runtime'));
  const inside=p=>p.startsWith(runtime+path.sep);
  const input=await realpath(process.argv[2]);
  assert(inside(input)&&input===path.resolve(process.argv[2]),'Input must be a non-symlink path in this runtime');
  const info=await stat(input);
  assert(info.isFile()&&(info.mode&0o777)===0o600,'Input must be a regular private 0600 file');
  assert(info.size<=256*1024*1024,'256 MiB input limit exceeded');
  const outputs=process.argv.slice(3).map(p=>path.resolve(p));
  assert.equal(new Set([input,...outputs]).size,3,'Paths must be distinct');
  for(const output of outputs) {
    const parent=await realpath(path.dirname(output));
    assert((inside(parent)||parent===runtime)&&parent===path.dirname(output),'Output parent must be a non-symlink runtime directory');
    try{await stat(output);throw new Error('Output already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  const {report,slice}=extractWebKitProtocol(await readFile(input));
  report.sourcePath=path.relative(ROOT,input);
  report.extractorSha256=sha(await readFile(fileURLToPath(import.meta.url)));
  if(slice) {
    await writeFile(outputs[0],slice,{flag:'wx',mode:0o600});
    report.slice.path=path.relative(ROOT,outputs[0]);
  }
  await writeFile(outputs[1],JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({result:report.result,manifest:path.relative(ROOT,outputs[1]),errors:report.errors}));
  if(!slice)process.exitCode=1;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
