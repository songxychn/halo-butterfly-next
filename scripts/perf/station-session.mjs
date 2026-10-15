/** One authenticated, in-memory station client for a batch's two real snapshots. */
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';

export async function openStationSession(command,args,{timeoutMs=60000}={}) {
 const child=spawn(command,args,{stdio:['pipe','pipe','pipe']});
 const reader=createInterface({input:child.stdout,crlfDelay:Infinity}),lines=reader[Symbol.asyncIterator]();
 let stderr='',spawnError,afterCalled=false,closed=false;
 child.stderr.on('data',value=>{stderr=(stderr+value.toString()).slice(-16384);});
 const launchFailure=new Promise(resolve=>child.once('error',error=>{spawnError=error;resolve({launchError:error});}));
 child.stdin.on('error',()=>{});
 const ended=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
 const bounded=async(promise,label)=>{
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timed out')),timeoutMs);})]);}
  finally{clearTimeout(timer);}
 };
 const receive=async()=>{
  const line=await bounded(Promise.race([lines.next(),launchFailure]),'Station snapshot');
  if(line.launchError)throw new Error('Station ended before snapshot: '+line.launchError.message);
  if(line.done){const result=await bounded(ended,'Station exit');throw new Error('Station ended before snapshot: '+(spawnError?.message||result.code)+' '+stderr);}
  if(line.value.length>16*1024*1024)throw new Error('Station snapshot exceeded output limit');
  try{return JSON.parse(line.value);}catch{throw new Error('Station protocol requires one JSON snapshot per line');}
 };
 const close=async()=>{
  if(closed)return;closed=true;child.stdin.end();reader.close();
  if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),1000);try{await ended;}finally{clearTimeout(timer);}}
  else await ended;
 };
 try{
  const before=await receive();
  return {before,close,async after(){
   if(afterCalled||closed)throw new Error('Station after snapshot can only be requested once');
   afterCalled=true;child.stdin.end('after\n');
   const value=await receive(),extra=await bounded(lines.next(),'Station protocol EOF'),result=await bounded(ended,'Station exit');
   if(!extra.done)throw new Error('Unexpected extra station protocol output');
   if(result.code!==0)throw new Error('Station failed after snapshot: '+result.code+' '+stderr);
   return value;
  }};
 }catch(error){await close();throw error;}
}
