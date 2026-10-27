import {test} from 'bun:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
test('natural GC distinguishes early deletion, waiting, expiry and overdue without advancing time',async()=>{
 await execute('python3',['-B','-c',`
import sys
sys.path.insert(0,'scripts/acceptance/comments')
from natural import verdict,epoch
assert verdict(99,100,False,5)=='early-deletion'
assert verdict(100,100,False,5)=='deleted-after-deadline'
assert verdict(105,100,True,5)=='waiting'
assert verdict(106,100,True,5)=='overdue'
assert epoch('2026-10-27T00:00:00Z')==epoch('2026-10-27T08:00:00+08:00')
`]);
});
test('natural GC rejects replaced content and leaves live attachment evidence intact',async()=>{
 await execute('python3',['-B','-c',`
import sys,copy
from types import SimpleNamespace
from pathlib import Path
sys.path.insert(0,'scripts/acceptance/comments')
from natural import NaturalUploadBatch
writes=[];original={'metadata':{'name':'owned','creationTimestamp':'original'},'spec':{'raw':'owned'}}
b=NaturalUploadBatch.__new__(NaturalUploadBatch);b.client=SimpleNamespace(api=lambda *args:writes.append(args));b.objects={'owned':{'collection':'comments','object':original}}
b.lab=SimpleNamespace(write_json=lambda *args,**kwargs:None);b.output=Path('/tmp')
b.optional=lambda url:{**original,'metadata':{**original['metadata'],'creationTimestamp':'replaced'}}
try:b.delete_owned('owned')
except RuntimeError as e:assert 'changed before deletion' in str(e)
else:raise AssertionError('Replacement deleted')
assert writes==[]
b.collect=lambda:None;b.report={'attachments':[{'name':'owned'}]};b.original=None;b.save=lambda:None
try:b.cleanup()
except RuntimeError as e:assert 'live attachment evidence' in str(e)
else:raise AssertionError('Natural failure silently cleaned')
assert writes==[] and b.report['restored'] is False
`]);
});
test('owned admin reply permits only the documented parent approval timestamp transition',async()=>{
 await execute('python3',['-B','-c',`
import sys,copy
sys.path.insert(0,'scripts/acceptance/comments')
from natural import validate_parent_approval,epoch
before={'metadata':{'name':'parent','creationTimestamp':'2026-10-27T00:00:00Z'},'spec':{'raw':'original','approved':True,'approvedTime':'2026-10-27T00:00:00Z'}}
after=copy.deepcopy(before);after['spec']['approvedTime']='2026-10-27T00:00:10Z'
start=epoch('2026-10-27T00:00:09Z');end=epoch('2026-10-27T00:00:11Z')
validate_parent_approval(before,after,start,end)
for mutation in ['raw','time','identity']:
 bad=copy.deepcopy(after)
 if mutation=='raw':bad['spec']['raw']='foreign edit'
 elif mutation=='time':bad['spec']['approvedTime']='2026-10-27T00:00:15Z'
 else:bad['metadata']['creationTimestamp']='2026-10-27T00:00:01Z'
 try:validate_parent_approval(before,bad,start,end)
 except RuntimeError:pass
 else:raise AssertionError('Unrelated drift accepted: '+mutation)
`]);
});
test('natural cleanup refuses stopped plugins and changed settings before any write',async()=>{
 await execute('python3',['-B','-c',`
import sys,copy
from types import SimpleNamespace
sys.path.insert(0,'scripts/acceptance/comments')
from run import natural_cleanup_preflight,PLUGINS,CONFIG,SYSTEM
plugin={'metadata':{'creationTimestamp':'original'},'spec':{'enabled':True,'version':'3.3.2'},'status':{'phase':'STARTED'}}
theme={'comments':{'lazyload':False}};comment='owned comment config'
original={PLUGINS+'/PluginCommentWidget':plugin,CONFIG:theme,SYSTEM:{'data':{'comment':comment}}}
for drift in ['none','disabled','stopped','replacement','version','theme','system']:
 state=copy.deepcopy(original);calls=[];batch_checks=[]
 if drift=='disabled':state[PLUGINS+'/PluginCommentWidget']['spec']['enabled']=False
 if drift=='stopped':state[PLUGINS+'/PluginCommentWidget']['status']['phase']='DISABLED'
 if drift=='replacement':state[PLUGINS+'/PluginCommentWidget']['metadata']['creationTimestamp']='new'
 if drift=='version':state[PLUGINS+'/PluginCommentWidget']['spec']['version']='other'
 if drift=='theme':state[CONFIG]={'foreign':True}
 if drift=='system':state[SYSTEM]['data']['comment']='foreign'
 def api(url,*args):
  calls.append((url,args));assert not args,'Preflight must be read-only'
  return copy.deepcopy(state[url])
 try:natural_cleanup_preflight(SimpleNamespace(api=api),plugin,theme,comment,SimpleNamespace(check_cleanup_state=lambda:batch_checks.append(True)))
 except RuntimeError:assert drift!='none'
 else:assert drift=='none' and batch_checks==[True]
 assert all(not args for url,args in calls)
`]);
});
test('natural cleanup preserves changed plugin config and restores only the owned config',async()=>{
 await execute('python3',['-B','-c',`
import sys,copy
from types import SimpleNamespace
sys.path.insert(0,'scripts/acceptance/comments')
from natural import NaturalUploadBatch,PLUGIN
for drift in ['none','data','replacement']:
 b=NaturalUploadBatch.__new__(NaturalUploadBatch)
 b.original={'metadata':{'creationTimestamp':'original'},'data':{'editor':'original'}}
 b.active_config={'editor':'owned upload settings'}
 current={'metadata':{'creationTimestamp':'original'},'data':copy.deepcopy(b.active_config)}
 if drift=='data':current['data']={'editor':'foreign'}
 if drift=='replacement':current['metadata']['creationTimestamp']='replacement'
 before=copy.deepcopy(current);writes=[]
 def api(url,method=None,value=None):
  assert url==PLUGIN
  if method:
   assert method=='PUT';writes.append(copy.deepcopy(value));current.update(copy.deepcopy(value))
  return copy.deepcopy(current)
 b.client=SimpleNamespace(api=api);b.report={'attachments':[]};b.save=lambda:None;b.collect=lambda:None
 b.inventory=lambda url:[];b.optional=lambda url:None;b.group='owned';b.fixture={'runId':'owned'}
 b.tickets={};b.upload_records={};b.before={key:{} for key in ['attachments','groups','uploads','submissions']}
 try:b.cleanup()
 except RuntimeError:assert drift!='none' and not b.report['restored']
 else:assert drift=='none' and b.report['restored']
 if drift=='none':assert len(writes)==1 and current['data']==b.original['data']
 else:assert writes==[] and current==before
`]);
});
test('natural cleanup refuses a changed or stopped Halo process without config writes',async()=>{
 await execute('python3',['-B','-c',`
import sys,json,tempfile
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0,'scripts/acceptance/comments')
from natural import NaturalUploadBatch
with tempfile.TemporaryDirectory() as directory:
 runtime=Path(directory);b=NaturalUploadBatch.__new__(NaturalUploadBatch)
 b.process={'pid':1};b.original=None
 for live,pid in [(True,1),(False,1),(True,2)]:
  (runtime/'halo-process.json').write_text(json.dumps({'pid':pid}))
  b.lab=SimpleNamespace(RUNTIME=runtime,owned_process=lambda name:live)
  try:b.check_cleanup_state()
  except RuntimeError:assert not live or pid!=1
  else:assert live and pid==1
`]);
});
