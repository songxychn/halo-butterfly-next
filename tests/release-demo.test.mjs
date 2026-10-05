import test from 'node:test';
import {execFileSync} from 'node:child_process';

test('release ordering, evidence integrity and shared Caddy scope reject unsafe updates', () => {
  execFileSync('python3', ['-B', '-c', String.raw`
import sys, importlib.util, json, tempfile
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,'scripts/release')
from common import version_key,validate_evidence,digest
spec=importlib.util.spec_from_file_location('updater','site/demo/hk-update.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
versions=['v0.1.0-alpha.2','v0.1.0-alpha.10','v0.1.0-beta.1','v0.1.0-rc.1','v0.1.0','v0.2.0-alpha.1']
assert sorted(versions,key=version_key)==versions
for invalid in ['v01.2.3','v1.2','v1.2.3; echo bad','master','v1.2.3-alpha.01']:
 try: version_key(invalid)
 except ValueError: pass
 else: raise AssertionError('Accepted invalid tag '+invalid)
config='other.example {\n reverse_proxy other:80\n}\nbutterfly.baizhukui.com {\n encode gzip\n reverse_proxy halo-butterfly-next:8090\n}\n'
result=m.candidate_config(config,'hbn-demo-123456789abc')
assert result==config.replace('halo-butterfly-next:8090','hbn-demo-123456789abc:8090')
for bad in [config+config,config.replace('halo-butterfly-next','unrelated'),config.replace('reverse_proxy halo-butterfly-next:8090','reverse_proxy halo-butterfly-next:8090\n reverse_proxy halo-butterfly-next:8090')]:
 try: m.candidate_config(bad,'hbn-demo-123456789abc')
 except RuntimeError: pass
 else: raise AssertionError('Accepted ambiguous shared route')
expected={'tag':'v1.0.0','sourceSha':'a'*40,'themeSha256':'b'*64}
assert m.expected_receipt(dict(expected,ready=True),expected)
assert not m.expected_receipt(dict(expected,ready=False),expected)
assert not m.expected_receipt(dict(expected,ready=True,sourceSha='c'*40),expected)
with tempfile.TemporaryDirectory() as tmp:
 p=Path(tmp)/'evidence';p.write_text('checked')
 # All required release gates and real, tracked-style evidence digests are mandatory.
 evidence={'tag':'v1.0.0','sourceSha':'a'*40,'themeSha256':'b'*64,'reviewer':'independent','decision':'approved','gates':{k:'passed' for k in ['realHalo','installUpgradeRollback','resourcesAndLicenses','sourceRebuild']},'knownLimitations':[],'evidence':[{'path':'README.md','sha256':digest('README.md')}]}
 with patch('common.subprocess.run'),patch('common.run',return_value=''):
  validate_evidence(evidence,'v1.0.0','c'*40,'b'*64)
  for modify in [lambda e:e['gates'].update(realHalo='failed'),lambda e:e.update(themeSha256='d'*64),lambda e:e.update(evidence=[]),lambda e:e['evidence'][0].update(sha256='0'*64)]:
   item=json.loads(json.dumps(evidence));modify(item)
   try:validate_evidence(item,'v1.0.0','c'*40,'b'*64)
   except ValueError:pass
   else:raise AssertionError('Invalid evidence accepted')
 with patch('common.subprocess.run'),patch('common.run',return_value='site/demo/entrypoint.py'):
  try:validate_evidence(evidence,'v1.0.0','c'*40,'b'*64)
  except ValueError:pass
  else:raise AssertionError('Accepted product changes after review')
 # Simulate process death immediately after route write: recover both route and state.
 m.ROOT=Path(tmp);m.CADDY=Path(tmp)/'Caddyfile';m.CADDY.write_text(result)
 before={'container':'halo-butterfly-next'}
 m.write(m.ROOT/'pending.json',{'beforeText':config,'beforeState':before,'afterSha':m.sha(result)})
 with patch.object(m,'run'),patch.object(m,'check_container'),patch.object(m,'apply_caddy',side_effect=lambda text,expected:m.CADDY.write_text(text)):
  m.recover()
 assert m.CADDY.read_text()==config and m.read(m.ROOT/'state.json')==before
 assert not (m.ROOT/'pending.json').exists()
 # Even if disk was restored before a crash, Caddy memory must be reloaded.
 m.write(m.ROOT/'pending.json',{'beforeText':config,'beforeState':before,'afterSha':m.sha(result)})
 with patch.object(m,'run'),patch.object(m,'check_container'),patch.object(m,'apply_caddy') as reload:
  m.recover();reload.assert_called_once_with(config,m.sha(config))
 # Unrelated administrator edits must never be overwritten by recovery.
 m.CADDY.write_text('another change')
 m.write(m.ROOT/'pending.json',{'beforeText':config,'beforeState':before,'afterSha':m.sha(result)})
 try:m.recover()
 except RuntimeError:pass
 else:raise AssertionError('Overwrote unrelated Caddy edits')
 # Rollback intent survives death after committing the route/state, before stopping the candidate.
 (m.ROOT/'pending.json').unlink();m.CADDY.write_text(result)
 current={'container':'hbn-demo-123456789abc','previous':before}
 m.write(m.ROOT/'state.json',current)
 def interrupt_stop(*args,**kwargs):
  assert m.read(m.ROOT/'paused.json')
  assert m.read(m.ROOT/'state.json')==before
  assert not (m.ROOT/'pending.json').exists()
  raise KeyboardInterrupt('simulated process death')
 with patch.object(m,'start_deployment'),patch.object(m,'check_container',return_value={'State':{'Health':{'Status':'healthy'}}}),patch.object(m,'apply_caddy',side_effect=lambda text,expected:m.CADDY.write_text(text)),patch.object(m,'run',side_effect=interrupt_stop):
  try:m.rollback()
  except KeyboardInterrupt:pass
  else:raise AssertionError('Missing simulated interruption')
 assert m.read(m.ROOT/'paused.json') and m.CADDY.read_text()==config
 # A failure while starting the previous deployment must also leave polling paused.
 m.write(m.ROOT/'state.json',current);(m.ROOT/'paused.json').unlink()
 with patch.object(m,'start_deployment',side_effect=RuntimeError('cannot start old version')):
  try:m.rollback()
  except RuntimeError:pass
  else:raise AssertionError('Missing start failure')
 assert m.read(m.ROOT/'paused.json')
`], {stdio:'pipe'});
});

test('plugin startup retries metadata conflict but rejects specification drift',()=>{
 execFileSync('python3',['-B','-c',String.raw`
import sys,copy
from unittest.mock import patch
sys.path[:0]=['site/deploy','site/tools']
from initialize import set_plugin_enabled
from runtime import ApiError
class Client:
 def __init__(self,drift=False):self.count=0;self.drift=drift;self.value={'spec':{'enabled':True,'version':'1.7.1'}}
 def api(self,path,method='GET',obj=None):
  if method=='GET':return copy.deepcopy(self.value)
  self.count+=1
  if self.count==1:
   if self.drift:self.value['spec']['version']='different'
   raise ApiError(method,path,409)
  self.value=obj
with patch('initialize.time.sleep'):
 c=Client();set_plugin_enabled(c,'PluginSearchWidget',False);assert c.count==2 and not c.value['spec']['enabled']
 c=Client(True)
 try:set_plugin_enabled(c,'PluginSearchWidget',False)
 except RuntimeError:pass
 else:raise AssertionError('Accepted plugin drift')
`],{stdio:'pipe'});
});

test('published release verification rejects missing, duplicated and modified attachments',()=>{
 execFileSync('python3',['-B','-c',String.raw`
import sys,json,tempfile
from pathlib import Path
sys.path.insert(0,'scripts/release')
from common import digest,verify_asset_directory
with tempfile.TemporaryDirectory() as d:
 p=Path(d);tag='v1.2.3';package=p/'halo-butterfly-next-1.2.3.zip';source=p/'halo-butterfly-next-1.2.3-source.tar.gz'
 package.write_bytes(b'checked package');source.write_bytes(b'checked source')
 (p/'release-validation.json').write_text(json.dumps({'tag':tag,'themeSha256':digest(package),'sourceArchiveSha256':digest(source)}))
 rows=[digest(f)+'  '+f.name for f in p.iterdir()]
 manifest='\n'.join(rows)+'\n';(p/'SHA256SUMS').write_text(manifest)
 names=[f.name for f in p.iterdir()]
 verify_asset_directory(p,names,tag)
 for bad in ['',rows[0]+'\n',manifest+rows[0]+'\n']:
  (p/'SHA256SUMS').write_text(bad)
  try:verify_asset_directory(p,names,tag)
  except ValueError:pass
  else:raise AssertionError('Accepted incomplete/duplicate sums')
 (p/'SHA256SUMS').write_text(manifest);package.write_bytes(b'modified')
 try:verify_asset_directory(p,names,tag)
 except ValueError:pass
 else:raise AssertionError('Accepted modified release attachment')
`],{stdio:'pipe'});
});
