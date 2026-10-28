#!/usr/bin/env python3
"""Create synthetic Moment coverage only in an explicitly owned loopback lab."""
import argparse, importlib.util, json, os, secrets, time
from pathlib import Path
parser=argparse.ArgumentParser(); parser.add_argument('--runtime',required=True);parser.add_argument('--downloads',required=True);parser.add_argument('--allow-synthetic-writes',choices=['yes'],required=True)
a=parser.parse_args();runtime=Path(a.runtime).resolve();repo=Path(__file__).resolve().parents[2]
assert runtime.is_relative_to(repo/'.runtime'), 'Only this worktree runtime is allowed'
marker=json.loads((runtime/'lab.json').read_text());assert marker['owner']=='halo-butterfly-next-comparison' and marker['schema']==1
os.environ.update(LAB_RUNTIME=str(runtime),HALO_PORT=str(marker['ports']['halo']),HEXO_PORT=str(marker['ports']['hexo']))
spec=importlib.util.spec_from_file_location('lab',repo/'scripts/lab/lab.py');lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab)
assert lab.owned_process('halo') and (runtime/'seed.json').exists()
client=lab.Client();owner='halo-butterfly-next-moments-fixture';snapshot=runtime/'moments-fixture.json'
if snapshot.exists():
 assert json.loads(snapshot.read_text())['owner']==owner
 print('Existing owned fixture preserved');raise SystemExit(0)
plugin_resource='/apis/plugin.halo.run/v1alpha1/plugins';config_path='/apis/api.console.halo.run/v1alpha1/themes/halo-butterfly-next/json-config'
def optional(path):
 try:return client.api(path)
 except lab.ApiError as e:
  if e.status!=404:raise
for name,filename,sha in [('PluginMoments','plugin-moments-1.18.0.jar','f4f5fd5a35fffca6da80405b72546aa5ce55601c240c353fd63fc9dfbe1e41bc'),('PluginCommentWidget','plugin-comment-widget-3.3.2.jar','e569a4bd8aade89383c8c7fee169fd822cfa80ff01341fdaa292cd2cd9db8f3f')]:
 jar=Path(a.downloads)/filename
 if sha:assert lab.digest(jar)==sha
 existing=optional(plugin_resource+'/'+name)
 expected='1.18.0' if name=='PluginMoments' else '3.3.2'
 if existing is None or existing['spec']['version']!=expected:
  boundary='moments-'+secrets.token_hex(10)
  body=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: application/java-archive\r\n\r\n'.encode()+jar.read_bytes()+f'\r\n--{boundary}--\r\n'.encode())
  client.api('/apis/api.console.halo.run/v1alpha1/plugins/'+(name+'/upgrade' if existing else 'install'),'POST',body,'multipart/form-data; boundary='+boundary)
 plugin=client.api(plugin_resource+'/'+name)
 if not plugin['spec'].get('enabled'):
  client.api('/apis/api.console.halo.run/v1alpha1/plugins/'+name+'/plugin-state','PUT',{'enable':True,'async':False})
 for _ in range(60):
  plugin=client.api(plugin_resource+'/'+name)
  if plugin.get('status',{}).get('phase')=='STARTED':break
  time.sleep(.5)
 else:raise RuntimeError('Plugin startup failed')
 assert plugin['spec']['version']==expected
original_config=client.api(config_path);original_system=client.api('/api/v1alpha1/configmaps/system')
lab.write_json(runtime/'moments-original.private.json',{'config':original_config,'systemComment':original_system['data'].get('comment')},private=True)
for i in range(1,15):
 name=f'moment-fixture-{i:02}'
 obj={'apiVersion':'moment.halo.run/v1alpha1','kind':'Moment','metadata':{'name':name,'labels':{'moments-fixture':owner}},'spec':{'content':{'raw':'合成瞬间 '+str(i),'html':'<p>合成瞬间 '+str(i)+'</p>','medium':[{'type':'PHOTO','url':'/lab/avatar.svg'}]},'releaseTime':f'2026-10-{i:02}T20:00:00Z','visible':'PRIVATE' if i==13 else 'PUBLIC','approved':i!=14,'owner':client.auth['username'],'tags':['山川','标签 & 空格']}}
 lab_path='/apis/moment.halo.run/v1alpha1/moments';existing=optional(lab_path+'/'+name)
 if existing:assert existing['metadata'].get('labels',{}).get('moments-fixture')==owner
 else:client.api(lab_path,'POST',obj)
for suffix,subject,approved,hidden in [('public','moment-fixture-12',True,False),('old','moment-fixture-01',True,False),('private','moment-fixture-13',True,False),('pending','moment-fixture-12',False,False),('hidden','moment-fixture-12',True,True)]:
 name='moment-fixture-comment-'+suffix;path='/apis/content.halo.run/v1alpha1/comments'
 if optional(path+'/'+name):continue
 text='<p>瞬间测试评论 '+suffix+'</p>'
 client.api(path,'POST',{'apiVersion':'content.halo.run/v1alpha1','kind':'Comment','metadata':{'name':name,'labels':{'moments-fixture':owner}},'spec':{'subjectRef':{'group':'moment.halo.run','version':'v1alpha1','kind':'Moment','name':subject},'owner':{'kind':'User','name':client.auth['username']},'raw':text,'content':text,'approved':approved,'hidden':hidden,'top':False,'priority':0,'allowNotification':False,'creationTime':'2026-10-14T10:00:00Z'}})
config=json.loads(json.dumps(original_config));config.setdefault('moments',{}).update({'timezone':'Asia/Shanghai'})
config.setdefault('comments',{}).update({'lazyload':True,'jump':True});config.setdefault('aside',{})['card_newest_comments']={'enable':True,'limit':6,'storage':0,'avatar':True,'sort_order':25}
client.api(config_path,'PUT',config)
system=client.api('/api/v1alpha1/configmaps/system');system['data']['comment']=json.dumps({'enable':True,'systemUserOnly':False,'requireReviewForNew':True});client.api('/api/v1alpha1/configmaps/system','PUT',system)
for _ in range(60):
 result=client.api('/apis/api.moment.halo.run/v1alpha1/moments?page=1&size=100')
 if any(x['metadata']['name']=='moment-fixture-12' and x.get('stats',{}).get('approvedComment',0)>0 for x in result['items']):break
 time.sleep(.5)
else:raise RuntimeError('Comment statistics not ready')
lab.write_json(snapshot,{'schema':1,'owner':owner,'plugins':{'PluginMoments':'1.18.0','PluginCommentWidget':'3.3.2'},'publicMoments':sum(x['spec'].get('visible')=='PUBLIC' for x in result['items']),'latestRelease':max(x['spec']['releaseTime'] for x in result['items'] if x['spec'].get('visible')=='PUBLIC'),'pendingRetained':not any(x['metadata']['name']=='moment-fixture-14' and x['spec'].get('approved') for x in result['items']),'privateMoment':'moment-fixture-13','unapprovedMoment':'moment-fixture-14'})
cookies=[{'name':x.name,'value':x.value,'domain':x.domain,'path':x.path,'expires':x.expires or -1,'httpOnly':x.has_nonstandard_attr('HttpOnly'),'secure':x.secure,'sameSite':'Lax'} for x in client.jar]
lab.write_json(runtime/'moments-auth.private.json',{'cookies':cookies,'csrf':client.csrf},private=True)
print('Owned moment/native comment fixtures ready')
