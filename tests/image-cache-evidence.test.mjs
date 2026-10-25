import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('cache evidence rejects missing controls, network warm loads and incomplete capture',()=>{
 const result=spawnSync('python3',['-B','-c',String.raw`
import copy,importlib.util
spec=importlib.util.spec_from_file_location('cache','scripts/images/cache-evidence.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
run='1234567890abcdef';ids=['native-eager','native-plain','native-lazy','native-responsive']
b={'runId':run,'result':'protocol-verification-required','restoration':{'result':'passed'},'checks':[]};bounds=[];responses=[]
for engine in ['firefox','webkit']:
 for phase in ['setup','cold','warm','cache-disabled','closed']:bounds.append({'engine':engine,'round':phase,'runId':run})
 for phase in ['cold','warm','cache-disabled']:
  b['checks'].append({'engine':engine,'round':phase,'images':[{'id':i,'url':'http://127.0.0.1/lab/'+run+'/'+i,'width':640,'pending':False,'filter':'none'} for i in ids]})
  for i in ids:
   if engine=='firefox' and phase=='warm':continue
   responses.append({'engine':engine,'round':phase,'url':'http://127.0.0.1/lab/'+run+'/'+i,'status':200,'source':'memory-cache' if phase=='warm' else 'network'})
responses.append({'engine':'firefox','round':'warm','url':'http://127.0.0.1/article','status':200,'source':'network'})
assert len(m.validate(b,bounds,responses))==8

def reject(report=b,boundaries=bounds,events=responses):
 try:m.validate(report,boundaries,events)
 except AssertionError:return
 raise AssertionError('False positive cache verdict')
reject(events=[r for r in responses if not(r['engine']=='firefox' and r['round']=='cache-disabled')])
reject(events=[r for r in responses if not(r['engine']=='firefox' and r['round']=='warm')])
reject(events=[r for r in responses if not(r['engine']=='webkit' and r['round']=='warm')])
v=copy.deepcopy(responses);next(r for r in v if r['engine']=='webkit' and r['round']=='warm')['source']='network';reject(events=v)
v=copy.deepcopy(responses);next(r for r in v if r['round']=='cold')['source']='memory-cache';reject(events=v)
reject(boundaries=bounds[:-1])
v=copy.deepcopy(bounds);v[2]['runId']='other';reject(boundaries=v)
v=copy.deepcopy(b);v['checks'][1]['images'][1]['url']+='changed';reject(report=v)
v=copy.deepcopy(b);v['checks'][1]['images'][1]['pending']=True;reject(report=v)
`],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 assert.equal(result.status,0,result.stderr||result.stdout);
});
