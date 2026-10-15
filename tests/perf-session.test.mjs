import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {openStationSession} from '../scripts/perf/station-session.mjs';

const start=source=>openStationSession(process.execPath,['-e',source],{timeoutMs:1000});
const before="console.error('diagnostic remains stderr');console.log(JSON.stringify({pid:process.pid,sequence:1}));";
test('性能会话同一进程读取前后真实快照，stderr不污染JSON且只允许一次after',async()=>{
 const session=await start(before+"process.stdin.on('data',data=>{if(data.toString()!=='after\\n')process.exit(2);console.log(JSON.stringify({pid:process.pid,sequence:2}));process.exit(0)});");
 try{const after=await session.after();assert.equal(after.pid,session.before.pid);assert.equal(after.sequence,2);await assert.rejects(session.after(),/only.*once/);}finally{await session.close();}
});
test('缺失after、子进程失败和额外协议输出不通过且均可收尾',async()=>{
 for(const response of ["process.exit(3)","console.log('{}');console.log('{}');process.exit(0)","process.exit(0)"]){
  const session=await start(before+"process.stdin.on('data',()=>{"+response+"});");
  try{await assert.rejects(session.after());}finally{await session.close();}
 }
});
test('错误JSON或启动失败不生成快照，挂起after在原定界限内失败并终止进程',async()=>{
 await assert.rejects(start("console.log('not JSON');setInterval(()=>{},1000)"),/JSON/);
 await assert.rejects(openStationSession('/no-such-perf-station-command',[],{timeoutMs:1000}),/before snapshot/);
 const session=await start(before+"process.stdin.resume();setInterval(()=>{},1000)");
 try{await assert.rejects(session.after(),/timed out/);}finally{await session.close();}
 assert.throws(()=>process.kill(session.before.pid,0));
});
test('消费者提前停止时关闭stdin并终止只属于本次采样的station进程',async()=>{
 const session=await start(before+"process.stdin.resume();setInterval(()=>{},1000)");
 await session.close();await session.close();assert.throws(()=>process.kill(session.before.pid,0));await assert.rejects(session.after(),/only.*once/);
});
