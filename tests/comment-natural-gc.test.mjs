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
