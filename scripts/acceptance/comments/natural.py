"""Natural-time API lifecycle fixtures. Never alter expiry metadata or restart plugins."""
import base64
import copy
import datetime
import hashlib
import json
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from uploads import UploadBatch, PLUGIN, STORAGE, UPLOADS, PREFIX

CONTENT = '/apis/content.halo.run/v1alpha1/'
PUBLIC = '/apis/api.halo.run/v1alpha1/comments'
PLUGIN_RESOURCE = '/apis/plugin.halo.run/v1alpha1/plugins/PluginCommentWidget'
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGMQyduCFTEMLQkAIIpNgfY33vIAAAAASUVORK5CYII=')


def epoch(value):
    return datetime.datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()


def identity(obj):
    return {'name': obj['metadata']['name'], 'created': obj['metadata']['creationTimestamp'],
            'specSha256': hashlib.sha256(json.dumps(obj['spec'], sort_keys=True).encode()).hexdigest()}


def verdict(now, due, exists, grace):
    if not exists:
        return 'early-deletion' if now < due else 'deleted-after-deadline'
    return 'overdue' if now > due + grace else 'waiting'


def validate_parent_approval(before, after, started, finished):
    # Halo 2.27.1 ReplyServiceImpl.doApproveComment re-approves a parent when
    # a user with comment-management permission replies. No other drift is allowed.
    for key in ['name', 'creationTimestamp']:
        if before['metadata'][key] != after['metadata'][key]: raise RuntimeError('Parent identity changed')
    if {k:v for k,v in before['spec'].items() if k != 'approvedTime'} != {k:v for k,v in after['spec'].items() if k != 'approvedTime'}:
        raise RuntimeError('Unexpected parent content/owner change')
    if not after['spec'].get('approved') or not started-1 <= epoch(after['spec']['approvedTime']) <= finished+1:
        raise RuntimeError('Parent approval is outside the owned reply operation')


class NaturalUploadBatch(UploadBatch):
    def __init__(self, client, lab, guard, fixture, output, register):
        super().__init__(client, lab, guard, fixture, output)
        self.register = register
        self.token = secrets.token_hex(32)
        self.objects = {}
        self.tickets = {}
        self.upload_records = {}
        self.report.update(scope='natural-time-api-upload-lifecycle', apiFixturesNotUiEvidence=True,
            status='preparing', samples=0, cases={}, errors=[], mutations=[],
            limitations=['Official local storage, one synthetic signed-in Post subject; not a browser matrix.',
                'No expiry/delete-after writes, plugin restart, or server clock changes.',
                'Unreferenced bound images: official deadline plus 5 minutes; reference protection sampled through deadline plus 20 minutes.',
                'Temporary uploads: official 24-hour expiry plus 32 minutes (two documented 15-minute reconciliation periods plus sampling allowance).',
                'Observer gaps over 120 seconds fail continuous-observation acceptance; runtime remains locked for safe recovery.'])
        self.save()

    def save(self):
        self.lab.write_json(self.output / 'natural-gc-report.json', self.report)
        if hasattr(self, 'objects'):
            self.lab.write_json(self.output / 'natural-state.private.json',
                {'objects': self.objects, 'tickets': self.tickets, 'uploads': self.upload_records, 'token': self.token}, private=True)

    def fail(self, message):
        if message not in self.report['errors']:
            self.report['errors'].append(message)
            self.save()

    def request(self, path, method='POST', body=None, content_type='application/json', extra=None):
        headers = {'Accept': 'application/json', 'X-CSRF-TOKEN': self.client.csrf,
                   'X-Comment-Upload-Token': self.token, **(extra or {})}
        if body is not None:
            headers['Content-Type'] = content_type
            if not isinstance(body, bytes): body = json.dumps(body).encode()
        req = urllib.request.Request(self.lab.BASE['halo'] + path, data=body, method=method, headers=headers)
        with self.client.opener.open(req, timeout=30) as response:
            return json.loads(response.read())

    def remember(self, collection, obj):
        self.objects[obj['metadata']['name']] = {'collection': collection, 'object': copy.deepcopy(obj)}
        self.save()
        self.register(collection, obj)
        return obj

    def delete_owned(self, name):
        row = self.objects[name]
        url = CONTENT + row['collection'] + '/' + name
        current = self.optional(url)
        if current is not None:
            if identity(current) != identity(row['object']):
                self.lab.write_json(self.output / ('content-drift-' + name + '.private.json'),
                    {'expected':row['object'],'observed':current}, private=True)
                raise RuntimeError('Owned comment changed before deletion')
            self.report['mutations'].append({'operation': 'delete-owned-' + row['collection'], 'name': name, 'at': time.time()})
            self.save()
            self.client.api(url, 'DELETE')
            self.poll('owned content deletion', lambda: self.optional(url), lambda x: x is None)

    def upload(self, label):
        filename = self.fixture['runId'] + '-' + label + '.png'
        boundary = 'natural-' + secrets.token_hex(12)
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="files"; filename="{filename}"\r\nContent-Type: image/png\r\n\r\n'.encode() + PNG + f'\r\n--{boundary}--\r\n'.encode())
        images = self.request('/apis/api.commentwidget.halo.run/v1alpha1/upload', body=body,
                              content_type='multipart/form-data; boundary=' + boundary)
        if len(images) != 1: raise RuntimeError('Expected exactly one uploaded image')
        image = images[0]
        record = self.client.api(UPLOADS + 'commentuploads/' + image['uploadId'])
        if record['spec']['state'] != 'TEMPORARY': raise RuntimeError('Expected a temporary upload')
        self.upload_records[image['uploadId']] = record
        self.save()
        self.collect()
        matches = [a for a in self.report['attachments'] if a['uploadId'] == image['uploadId']]
        if len(matches) != 1 or matches[0]['spec']['displayName'] != filename: raise RuntimeError('Upload attribution mismatch')
        return {**image, 'attachment': matches[0]['name']}

    def comment(self, label, image=None, reply_to=None, register=True):
        time.sleep(6.5)  # Preserve official creation rate limits.
        html = '<p>Natural GC ' + self.fixture['runId'] + ' ' + label
        if image: html += '<img src="' + image['url'] + '" />'
        html += '</p>'
        headers = {}
        if image:
            ticket = self.request('/apis/api.commentwidget.halo.run/v1alpha1/submissions')
            self.tickets[ticket['id']] = self.client.api(UPLOADS + 'commentsubmissions/' + ticket['id'])
            self.save()
            headers = {'X-Comment-Submission': ticket['id'], 'X-Comment-Uploads': image['uploadId']}
        data = {'raw': html, 'content': html, 'allowNotification': True, 'hidden': False}
        if not reply_to:
            data['subjectRef'] = {'group': self.fixture['post']['group'], 'version': 'v1alpha1',
                                  'kind': self.fixture['post']['kind'], 'name': self.fixture['post']['name']}
        started = time.time()
        obj = self.request(PUBLIC + ('/' + reply_to + '/reply' if reply_to else ''), body=data, extra=headers)
        finished = time.time()
        if reply_to:
            before = self.objects[reply_to]['object']
            after = self.client.api(CONTENT+'comments/'+reply_to)
            validate_parent_approval(before, after, started, finished)
            self.report['parentApprovalTransition'] = {'name':reply_to, 'before':before['spec']['approvedTime'],
                'after':after['spec']['approvedTime'], 'ownedReply':obj['metadata']['name'], 'requestStarted':started, 'requestFinished':finished}
            self.remember('comments', after)
        collection = 'replies' if reply_to else 'comments'
        if obj['spec']['raw'] != html: raise RuntimeError('API fixture content mismatch')
        self.objects[obj['metadata']['name']] = {'collection': collection, 'object': copy.deepcopy(obj)}
        self.save()
        if register: self.register(collection, obj)
        if image:
            bound = self.poll('bound attachment', lambda: self.optional(STORAGE + 'attachments/' + image['attachment']),
                lambda a: a and a['metadata'].get('annotations', {}).get(PREFIX + 'target-name') == obj['metadata']['name'])
            image['target'] = identity(obj)
            image['kind'] = 'Reply' if reply_to else 'Comment'
        return obj

    def configure(self):
        self.original = self.client.api(PLUGIN)
        self.lab.write_json(self.output / 'uploads-restore.private.json', self.original, private=True)
        for key, url in [('attachments', STORAGE+'attachments'), ('groups', STORAGE+'groups'),
                         ('uploads', UPLOADS+'commentuploads'), ('submissions', UPLOADS+'commentsubmissions')]:
            self.before[key] = {x['metadata']['name']: x for x in self.inventory(url)}
        self.lab.write_json(self.output / 'uploads-before.private.json', self.before, private=True)
        if any(self.before[k] for k in ['attachments', 'uploads', 'submissions']):
            raise RuntimeError('Natural GC requires empty storage/upload baseline to avoid unrelated expiry drift')
        if self.group in self.before['groups']: raise RuntimeError('Unique group collision')
        if self.client.api(STORAGE+'policies/default-policy')['spec']['templateName'] != 'local': raise RuntimeError('Only local storage supported')
        self.client.api(STORAGE+'groups', 'POST', {'apiVersion':'storage.halo.run/v1alpha1','kind':'Group',
            'metadata':{'name':self.group,'labels':{'acceptance.halo-butterfly-next/run':self.fixture['runId']}},'spec':{'displayName':self.group}})
        config = self.client.api(PLUGIN)
        editor = json.loads(config['data'].get('editor', '{}'))
        editor.update(enableUpload=True, upload={'allowAnonymous':True,'maxFileSize':1,
            'attachment':{'attachmentPolicy':'default-policy','attachmentGroup':self.group}})
        config['data']['editor'] = json.dumps(editor)
        self.client.api(PLUGIN, 'PUT', config)
        self.active_config = self.client.api(PLUGIN)['data']
        self.plugin = self.client.api(PLUGIN_RESOURCE)
        self.process = json.loads((self.lab.RUNTIME/'halo-process.json').read_text())

    def public_status(self, image):
        url = urllib.parse.urljoin(self.lab.BASE['halo'], image['url'])
        if urllib.parse.urlsplit(url).netloc != urllib.parse.urlsplit(self.lab.BASE['halo']).netloc: raise RuntimeError('Image origin mismatch')
        try:
            with self.lab.LOCAL.open(url, timeout=20) as response:
                if response.url != url or response.read() != PNG: raise RuntimeError('Public image bytes/redirect mismatch')
                return response.status
        except urllib.error.HTTPError as error:
            if error.code != 404: raise
            return 404

    def run(self):
        try:
            self._run()
        except Exception as error:
            self.report['status'] = 'failed'
            self.fail(str(error))
            raise

    def _run(self):
        self.configure()
        a = self.upload('parent'); parent = self.comment('parent', a, register=False)
        b = self.upload('reply'); reply = self.comment('reply', b, parent['metadata']['name'])
        c = self.upload('referenced'); origin = self.comment('referenced-origin', c)
        holder = self.comment('reference-holder', register=False)
        holder['spec']['raw'] += '<p><img src="' + c['url'] + '" /></p>'
        holder['spec']['content'] = holder['spec']['raw']
        # Administrative content edit is a reference-protection fixture, not a public reuse/upload bypass test.
        self.client.api(CONTENT+'comments/'+holder['metadata']['name'], 'PUT', holder)
        holder = self.client.api(CONTENT+'comments/'+holder['metadata']['name'])
        self.remember('comments', holder)
        d = self.upload('temporary')
        for label, image in [('parent',a),('reply',b),('referenced',c),('temporary',d)]:
            if self.public_status(image) != 200: raise RuntimeError('Initial image not readable')
            self.report['cases'][label] = {**image, 'status':'waiting', 'naturallyElapsed':True}
        self.report['referenceHolder'] = identity(holder)
        self.report['referenceFixtureMethod'] = 'official administrative comment content edit; not UI evidence'
        self.save()
        self.delete_owned(reply['metadata']['name'])
        self.delete_owned(parent['metadata']['name'])
        self.delete_owned(origin['metadata']['name'])
        for label in ['parent','reply','referenced']:
            row = self.report['cases'][label]
            obj = self.poll('official natural deletion deadline', lambda:self.optional(STORAGE+'attachments/'+row['attachment']),
                lambda x:x and x['metadata'].get('annotations',{}).get(PREFIX+'delete-after'))
            after = obj['metadata']['annotations'][PREFIX+'delete-after']
            if not 3500 < epoch(after)-time.time() <= 3600: raise RuntimeError('Unexpected initial deletion delay')
            row.update(deleteAfter=after, due=epoch(after))
        temp = self.report['cases']['temporary']; temp['due'] = epoch(temp['expiresAt'])
        if not 86000 < temp['due']-time.time() <= 86400: raise RuntimeError('Unexpected temporary expiry')
        self.report.update(status='observing-natural-time', startedObservationAt=time.time(),
            observationDeadline=temp['due']+1920, sampleIntervalSeconds=60)
        self.save()
        print(json.dumps({'naturalRun': self.fixture['runId'], 'status': self.report['status'],
                          'deadlines':{k:r['due'] for k,r in self.report['cases'].items()}}), flush=True)
        last = time.time(); login_at = last
        while True:
            now = time.time()
            if now-last > 120: self.fail('Observer gap exceeded 120 seconds; continuous timing not certified')
            last = now
            if now-login_at > 1800:
                # Reuse the coordinator's Client object so final cleanup has the refreshed session.
                fresh = self.lab.Client(); self.client.__dict__.update(fresh.__dict__); login_at=now
            if not self.lab.owned_process('halo') or json.loads((self.lab.RUNTIME/'halo-process.json').read_text()) != self.process:
                raise RuntimeError('Halo process changed during natural timing')
            plugin = self.client.api(PLUGIN_RESOURCE)
            if identity(plugin) != identity(self.plugin) or plugin.get('status',{}).get('phase') != 'STARTED':
                raise RuntimeError('Comment plugin changed or stopped during natural timing')
            if self.client.api(PLUGIN)['data'] != self.active_config: raise RuntimeError('Comment config changed during timing')
            sample = {'at':now,'cases':{}}
            for label,row in self.report['cases'].items():
                obj = self.optional(STORAGE+'attachments/'+row['attachment'])
                exists = obj is not None
                status = self.public_status(row)
                observed_at = time.time()
                sample['cases'][label] = {'observedAt':observed_at,'attachmentExists':exists,'publicStatus':status}
                if exists:
                    original = next(a for a in self.report['attachments'] if a['name']==row['attachment'])
                    if obj['metadata']['creationTimestamp'] != original['creationTimestamp'] or obj['spec'] != original['spec']:
                        raise RuntimeError('Attachment identity drift during timing')
                if exists != (status == 200): self.fail(label+': resource and public storage disagree')
                if label == 'referenced' and not row.get('holderDeletedAt'):
                    if not exists: self.fail('referenced: deleted while another comment still references the URL')
                    if observed_at >= row['due']+1200:
                        row['protectedThrough'] = observed_at
                        row['referenceProtectionPassed'] = exists
                        self.delete_owned(holder['metadata']['name'])
                        row['holderDeletedAt'] = time.time()
                        row['releaseDeadline'] = row['holderDeletedAt']+1020
                    continue
                due = row.get('holderDeletedAt', row['due'])
                grace = 1020 if label=='referenced' else (1920 if label=='temporary' else 300)
                state = verdict(observed_at, due, exists, grace)
                if state in ['early-deletion','overdue']: self.fail(label+': '+state)
                if not exists:
                    row.setdefault('firstObservedAbsentAt',observed_at)
                    if row['status'] != 'failed':
                        row['status'] = 'passed' if state=='deleted-after-deadline' and status==404 else 'failed'
                elif state=='overdue': row['status']='failed'
            self.report['samples'] += 1; self.report['lastSample'] = sample
            with (self.output/'natural-gc-samples.jsonl').open('a') as stream:stream.write(json.dumps(sample)+'\n')
            self.save()
            if all(r['status']=='passed' for r in self.report['cases'].values()) or now > temp['due']+1920: break
            time.sleep(60)
        self.report['finishedObservationAt'] = time.time()
        self.report['status'] = 'failed' if self.report['errors'] else 'passed-natural-scope'
        self.save()
        if self.report['errors']: raise RuntimeError('Natural expiry acceptance failed; see natural-gc-report.json')

    def check_cleanup_state(self):
        if hasattr(self, 'process'):
            if (not self.lab.owned_process('halo')
                    or json.loads((self.lab.RUNTIME/'halo-process.json').read_text()) != self.process):
                raise RuntimeError('Natural cleanup blocked: Halo process changed')
        if self.original:
            current = self.client.api(PLUGIN)
            expected = getattr(self, 'active_config', self.original['data'])
            if (current['metadata'].get('creationTimestamp') != self.original['metadata'].get('creationTimestamp')
                    or current.get('data') != expected):
                raise RuntimeError('Natural cleanup blocked: plugin config changed')

    def cleanup(self):
        errors=[]
        try:
            self.check_cleanup_state()
            self.collect()
            for row in self.report['attachments']:
                if self.optional(STORAGE+'attachments/'+row['name']):
                    raise RuntimeError('Natural run leaves live attachment evidence; no forced expiry or administrative deletion')
            for plural, known in [('commentsubmissions',self.tickets),('commentuploads',self.upload_records)]:
                for obj in self.inventory(UPLOADS+plural):
                    name=obj['metadata']['name']
                    if name not in known or obj['metadata']['creationTimestamp'] != known[name]['metadata']['creationTimestamp']:
                        raise RuntimeError('Unattributed or replaced natural-run state record')
                    self.client.api(UPLOADS+plural+'/'+name,'DELETE')
                    self.poll('owned state cleanup',lambda:self.optional(UPLOADS+plural+'/'+name),lambda x:x is None)
            group=self.optional(STORAGE+'groups/'+self.group)
            if group:
                if group['metadata'].get('labels',{}).get('acceptance.halo-butterfly-next/run')!=self.fixture['runId']:raise RuntimeError('Group ownership changed')
                self.client.api(STORAGE+'groups/'+self.group,'DELETE')
                self.poll('group cleanup',lambda:self.optional(STORAGE+'groups/'+self.group),lambda x:x is None)
            for key,url in [('attachments',STORAGE+'attachments'),('groups',STORAGE+'groups'),('uploads',UPLOADS+'commentuploads'),('submissions',UPLOADS+'commentsubmissions')]:
                if {x['metadata']['name']:x for x in self.inventory(url)} != self.before[key]:raise RuntimeError('Storage baseline not restored: '+key)
        except Exception as error: errors.append(str(error))
        finally:
            if self.original:
                try:
                    self.check_cleanup_state()
                    obj=self.client.api(PLUGIN);obj['data']=copy.deepcopy(self.original['data']);self.client.api(PLUGIN,'PUT',obj)
                    if self.client.api(PLUGIN)['data']!=self.original['data']:raise RuntimeError('Plugin config restoration mismatch')
                except Exception as error:errors.append(str(error))
        self.report['restoreErrors']=errors;self.report['restored']=not errors
        self.save()
        if errors:raise RuntimeError('; '.join(errors))
