import {test} from 'bun:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
test('upload cleanup refuses replaced attachments and unattributed submission records',async()=>{
 await execute('python3',['-B','-c',`
import sys,copy
from types import SimpleNamespace
sys.path.insert(0,'scripts/acceptance/comments')
from uploads import UploadBatch, STORAGE, UPLOADS
for scenario in ['replacement','foreign-submission']:
 writes=[]
 batch=UploadBatch.__new__(UploadBatch)
 batch.fixture={'runId':'owned'};batch.group='comment-upload-owned';batch.before={'attachments':{},'submissions':{},'uploads':{},'groups':{}}
 batch.original=None;batch.report={'attachments':[],'cleanup':[],'status':'failed'};batch.save=lambda:None;batch.collect=lambda:None
 batch.browser_report=lambda:{'cases':[]}
 batch.client=SimpleNamespace(api=lambda *args:writes.append(args))
 if scenario=='replacement':
  batch.report['attachments']=[{'name':'attachment','creationTimestamp':'original','spec':{'groupName':batch.group}}]
  batch.optional=lambda url:{'metadata':{'name':'attachment','creationTimestamp':'replacement'},'spec':{'groupName':batch.group}}
 else:
  batch.inventory=lambda url:[{'metadata':{'name':'foreign'},'spec':{'targetName':'not-owned'}}] if url==UPLOADS+'commentsubmissions' else []
 try:batch.cleanup()
 except RuntimeError as e:
  assert ('identity mismatch' if scenario=='replacement' else 'Unattributed new upload record') in str(e)
 else:raise AssertionError('Unsafe cleanup accepted')
 assert writes==[],writes
 assert batch.report['restored'] is False
`]);
});
