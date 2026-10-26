"""Owned real UI uploads; official delayed GC with explicitly advanced fixture deadlines."""
import copy
import datetime
import json
import time
import urllib.error
import urllib.parse
from pathlib import Path
from inventory import read_inventory

PLUGIN = '/api/v1alpha1/configmaps/plugin-comment-widget-configmap'
STORAGE = '/apis/storage.halo.run/v1alpha1/'
UPLOADS = '/apis/commentwidget.halo.run/v1alpha1/'
PREFIX = 'commentwidget.halo.run/'


class UploadBatch:
    def __init__(self, client, lab, guard, fixture, output):
        self.client, self.lab, self.guard = client, lab, guard
        self.fixture, self.output = fixture, output
        self.group = 'comment-upload-' + fixture['runId']
        self.before = {}
        self.original = None
        self.report = {'schema': 1, 'runId': fixture['runId'], 'scope': 'official-local-storage-comment-reply-upload',
                       'status': 'running', 'attachments': [], 'cleanup': [], 'restored': False,
                       'limitations': ['Local storage only; headless Chromium/Firefox/WebKit, anonymous and fixture-maintainer.',
                           'Only owned synthetic attachment delete-after timestamps are advanced after observing the official one-hour schedule; not natural one-hour elapsed proof.',
                           'Temporary 24-hour expiry, all image formats, other storage providers and real devices are outside this batch.']}
        self.save()

    def save(self):
        self.lab.write_json(self.output / 'uploads-report.json', self.report)

    def inventory(self, path):
        return read_inventory(self.client.api, path)

    def optional(self, path):
        try: return self.client.api(path)
        except self.lab.ApiError as e:
            if e.status != 404: raise

    def poll(self, label, read, predicate):
        deadline = time.monotonic() + 30
        while True:
            value = read()
            if predicate(value): return value
            if time.monotonic() >= deadline: raise RuntimeError('Upload readiness timed out: ' + label)
            time.sleep(.25)

    def run(self):
        self.original = self.client.api(PLUGIN)
        self.lab.write_json(self.output / 'uploads-restore.private.json', self.original, private=True)
        for key, url in [('attachments', STORAGE+'attachments'), ('groups', STORAGE+'groups'),
                         ('uploads', UPLOADS+'commentuploads'), ('submissions', UPLOADS+'commentsubmissions')]:
            self.before[key] = {x['metadata']['name']: x for x in self.inventory(url)}
        self.lab.write_json(self.output / 'uploads-before.private.json', self.before, private=True)
        policy = self.client.api(STORAGE+'policies/default-policy')
        if policy['spec']['templateName'] != 'local': raise RuntimeError('Only owned lab local storage is in scope')
        if self.group in self.before['groups']: raise RuntimeError('Synthetic group collision')
        self.client.api(STORAGE+'groups', 'POST', {'apiVersion':'storage.halo.run/v1alpha1','kind':'Group',
            'metadata':{'name':self.group,'labels':{'acceptance.halo-butterfly-next/run':self.fixture['runId']}},
            'spec':{'displayName':self.group}})
        config = self.client.api(PLUGIN)
        editor = json.loads(config['data'].get('editor','{}'))
        editor.update(enableUpload=True, upload={'allowAnonymous':True,'maxFileSize':1,
            'attachment':{'attachmentPolicy':'default-policy','attachmentGroup':self.group}})
        config['data']['editor'] = json.dumps(editor)
        security = json.loads(config['data'].get('security','{}'))
        security.setdefault('captcha',{})['enable'] = False
        config['data']['security'] = json.dumps(security)
        self.client.api(PLUGIN,'PUT',config)
        self.lab.write_json(self.output/'upload-fixture.json', self.fixture)
        code = self.guard.run_browser(['bun',str(Path(__file__).with_name('upload-check.mjs')),str(self.output/'upload-fixture.json')],self.output/'upload.log',self.lab.BASE['halo'],timeout=900)
        self.report['browserExitCode'] = code
        self.collect()
        self.save()
        if code:
            self.report['status'] = 'failed'; self.save()
            raise RuntimeError('Upload browser batch failed')
        if len(self.report['attachments']) != self.fixture['expectedCases']*2: raise RuntimeError('Expected one parent and one reply image per case')
        for row in self.report['attachments']:
            obj = self.poll('bound attachment '+row['name'],lambda: self.optional(STORAGE+'attachments/'+row['name']),
                lambda x: x and bool(x['metadata'].get('annotations',{}).get(PREFIX+'target-name')))
            annotations = obj['metadata']['annotations']
            if annotations[PREFIX+'target-name'] not in self.target_names(): raise RuntimeError('Attachment target is not an owned UI submission')
            row['bound'] = {'kind':annotations[PREFIX+'target-kind'],'name':annotations[PREFIX+'target-name']}
            if annotations.get(PREFIX+'delete-after'): raise RuntimeError('Live submitted image unexpectedly scheduled for deletion')
        self.report['status'] = 'passed-browser-scope'
        self.save()

    def browser_report(self):
        p = self.output/'upload-browser.json'
        return json.loads(p.read_text()) if p.exists() else {'cases':[]}

    def target_names(self):
        return {x['name'] for case in self.browser_report()['cases'] for x in case['created']}

    def collect(self):
        existing = {x['name']:x for x in self.report['attachments']}
        for obj in self.inventory(STORAGE+'attachments'):
            if obj['spec'].get('groupName') != self.group: continue
            name = obj['metadata']['name']
            if name in self.before.get('attachments',{}): raise RuntimeError('Existing attachment in unique group')
            if self.fixture['runId'] not in obj['spec'].get('displayName',''): raise RuntimeError('Unexpected filename in synthetic group')
            if not obj['metadata'].get('labels',{}).get(PREFIX+'upload'): raise RuntimeError('Missing official upload ownership marker')
            if name not in existing:
                existing[name]={'name':name,'creationTimestamp':obj['metadata']['creationTimestamp'],
                    'uploadId':obj['metadata']['labels'][PREFIX+'upload'],'spec':obj['spec'],
                    'url':obj.get('status',{}).get('permalink')}
        self.report['attachments'] = list(existing.values())
        self.save()

    def cleanup(self):
        errors=[]
        try:
            self.collect()
            for row in self.report['attachments']:
                url = STORAGE+'attachments/'+row['name']
                obj = self.optional(url)
                if not obj: raise RuntimeError('Attachment vanished before cleanup observation')
                if obj['metadata']['creationTimestamp'] != row['creationTimestamp'] or obj['spec'] != row['spec']: raise RuntimeError('Attachment cleanup identity mismatch')
                target = obj['metadata'].get('annotations',{}).get(PREFIX+'target-name')
                if target and target in self.target_names():
                    obj = self.poll('official delayed deletion',lambda:self.optional(url),
                        lambda x:x and bool(x['metadata'].get('annotations',{}).get(PREFIX+'delete-after')))
                    after = obj['metadata']['annotations'][PREFIX+'delete-after']
                    delay = datetime.datetime.fromisoformat(after.replace('Z','+00:00')).timestamp()-time.time()
                    if not 3500 < delay <= 3600: raise RuntimeError('Unexpected official GC delay: '+str(delay))
                    self.report['cleanup'].append({'name':row['name'],'officialDeleteAfter':after,'remainingDelaySeconds':delay,'method':'advance-owned-delete-after-then-official-reconciler','naturallyElapsed':False})
                    obj['metadata']['annotations'][PREFIX+'delete-after']='2000-01-01T00:00:00Z'
                    self.client.api(url,'PUT',obj)
                    self.poll('official physical attachment deletion',lambda:self.optional(url),lambda x:x is None)
                    public_url=urllib.parse.urljoin(self.lab.BASE['halo'],row['url'])
                    if urllib.parse.urlsplit(public_url).netloc!=urllib.parse.urlsplit(self.lab.BASE['halo']).netloc:raise RuntimeError('Image is outside owned loopback origin')
                    try:
                        with self.lab.LOCAL.open(public_url, timeout=20): raise RuntimeError('Deleted image still readable')
                    except urllib.error.HTTPError as e:
                        if e.code!=404:raise
                        self.report['cleanup'][-1]['publicReadStatus']=404
                else:
                    # A failed pre-submission run can leave only a temporary upload.
                    upload=self.optional(UPLOADS+'commentuploads/'+row['uploadId'])
                    if not upload or upload['spec'].get('attachmentName')!=row['name']: raise RuntimeError('Temporary upload identity mismatch')
                    self.report['cleanup'].append({'name':row['name'],'method':'advance-owned-temporary-expiry','naturallyElapsed':False})
                    upload['spec']['expiresAt']='2000-01-01T00:00:00Z'
                    self.client.api(UPLOADS+'commentuploads/'+row['uploadId'],'PUT',upload)
                    self.poll('temporary cleanup',lambda:self.optional(url),lambda x:x is None)
        except Exception as e:
            # HTTP 404 is expected only for the public image check below; all other failures retain evidence.
            errors.append(str(e))
        finally:
            # Restore plugin configuration even if collection/GC assertions failed.
            if self.original:
                try:
                    obj=self.client.api(PLUGIN);obj['data']=copy.deepcopy(self.original['data']);self.client.api(PLUGIN,'PUT',obj)
                    if self.client.api(PLUGIN)['data']!=self.original['data']:raise RuntimeError('Plugin restoration mismatch')
                except Exception as e: errors.append(str(e))
        if not errors:
            try:
                targets=self.target_names();ids={x['uploadId'] for x in self.report['attachments']}
                for key, plural in [('submissions','commentsubmissions'),('uploads','commentuploads')]:
                    for obj in self.inventory(UPLOADS+plural):
                        name=obj['metadata']['name']
                        if name in self.before[key]:continue
                        tickets={s['body']['id'] for case in self.browser_report()['cases'] for s in case.get('submissions',[]) if s.get('status')==200 and s.get('body',{}).get('id')}
                        owned=obj['spec'].get('targetName') in targets or (plural=='commentuploads' and name in ids) or (plural=='commentsubmissions' and name in tickets)
                        if not owned:raise RuntimeError('Unattributed new upload record: '+plural)
                        self.client.api(UPLOADS+plural+'/'+name,'DELETE')
                        self.poll('record cleanup',lambda:self.optional(UPLOADS+plural+'/'+name),lambda x:x is None)
                group=self.optional(STORAGE+'groups/'+self.group)
                if group:
                    if group['metadata']['labels'].get('acceptance.halo-butterfly-next/run')!=self.fixture['runId']:raise RuntimeError('Group ownership mismatch')
                    self.client.api(STORAGE+'groups/'+self.group,'DELETE')
                    self.poll('group cleanup',lambda:self.optional(STORAGE+'groups/'+self.group),lambda x:x is None)
                for key,url in [('attachments',STORAGE+'attachments'),('groups',STORAGE+'groups'),('uploads',UPLOADS+'commentuploads'),('submissions',UPLOADS+'commentsubmissions')]:
                    now={x['metadata']['name']:x for x in self.inventory(url)}
                    if now != self.before[key]: raise RuntimeError('Pre-existing storage state changed: '+key)
            except Exception as e:errors.append(str(e))
        self.report['restoreErrors']=errors;self.report['restored']=not errors
        if errors:self.report['status']='failed'
        elif self.report['status']=='passed-browser-scope':self.report['status']='passed-tested-scope'
        self.save()
        if errors:raise RuntimeError('; '.join(errors))
