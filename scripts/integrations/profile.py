"""Configure synthetic integrations only on an owned, loopback comparison lab."""
import argparse,copy,importlib.util,json,os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--runtime',required=True,type=Path)
parser.add_argument('--profile',required=True,choices=['disabled','all','chatra','tidio','crisp','knocket','native','failed','resources','bad-resources','invalid-resources','versionless','layout6','layout7','jsdelivr','unpkg','cdnjs','restore','serve'])
a=parser.parse_args(); runtime=a.runtime.resolve()
identity=json.loads((runtime/'lab.json').read_text())
if identity.get('owner')!='halo-butterfly-next-comparison' or identity.get('schema')!=1:
 raise RuntimeError('Only a comparison lab owned by this project may be configured')
os.environ.update(LAB_RUNTIME=str(runtime),HALO_PORT=str(identity['ports']['halo']),HEXO_PORT=str(identity['ports']['hexo']))
spec=importlib.util.spec_from_file_location('integration_lab',ROOT/'scripts/lab/lab.py');lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab)
if not lab.owned_process('halo'):
 raise RuntimeError('Only an owned lab process may be configured')
client=lab.Client();url='/apis/api.console.halo.run/v1alpha1/themes/halo-butterfly-next/json-config'
backup=runtime/'integrations-config-before.json'
if not backup.exists():lab.write_json(backup,client.api(url),private=True)
def configure(name):
 config=copy.deepcopy(json.loads(backup.read_text()))
 layout=name[-1] if name in ['layout6','layout7'] else None
 if layout:name='all'
 if name!='restore':
  config['analytics']={};config['chat']={'use':''};config['google_adsense']={'enable':False};config['ad']={};config['CDN']={'internal_provider':'local','third_party_provider':'local','version':True,'option':{}}
  if name=='all':
   config['pjax']={'enable':True}
   config['analytics']={'baidu_analytics':'a'*32,'google_analytics':'G-TEST123','cloudflare_analytics':'test-token','microsoft_clarity':'test123','google_tag_manager':{'tag_id':'GTM-TEST'},'umami_analytics':{'enable':True,'website_id':'12345678-1234-1234-1234-123456789abc','option':'{"data-domains":"127.0.0.1","data-tag":"synthetic"}','UV_PV':{'site_uv':True,'site_pv':True,'page_pv':True,'stats_url':'/integration-stats','token':'synthetic-token-must-not-render'}}}
   config['google_adsense']={'enable':True,'auto_ads':True,'enable_page_level_ads':False,'client':'ca-pub-1234567890123456'}
   config['ad']={key:'<ins class="adsbygoogle" data-ad-slot="synthetic-'+key+'"></ins><span data-ad-text>'+key+'</span>' for key in ['index','aside','post']}
   for key in ['baidu_analytics','google_analytics','cloudflare_analytics','microsoft_clarity','google_tag_manager','umami_analytics','google_adsense']:config['CDN']['option'][key]='/integration-stub.js?provider='+key
  if name in ['all','chatra','tidio','crisp','knocket','native','failed']:
   provider=name if name in ['chatra','tidio','crisp','knocket'] else 'chatra'
   keys={'chatra':'id','tidio':'public_key','crisp':'website_id','knocket':'identifier'}
   config['chat']={'use':provider,'rightside_button':name!='native','button_hide_show':name=='native',provider:{keys[provider]:'synthetic-id'}}
   config['CDN']['option']['chat_'+provider]=('/integration-fail.js' if name=='failed' else '/integration-stub.js?provider='+provider)
  if name=='resources':config['CDN'].update(internal_provider='custom',third_party_provider='custom',custom_format='/theme-mirror/${file}?version=${version}')
  if name=='bad-resources':
   config['CDN']['option']={key:'/integration-fail.js?resource='+key for key in ['main','main_css','fontawesome','prismjs_js','prismjs_css','code_light','code_dark']}
  if layout:config['index']['index_layout']=layout
  if name=='versionless':config['CDN']['version']=False
  if name=='invalid-resources':config['CDN']['option']={'main':'//evil.test/x.js','fontawesome':'javascript:bad','prismjs_js':'//evil.test/prism.js'}
  if name in ['jsdelivr','unpkg','cdnjs']:config['CDN']['third_party_provider']=name
 client.api(url,'PUT',config)
 return {'profile':name,'base':lab.BASE['halo']}
if a.profile=='serve':
 print(json.dumps({'ready':True}),flush=True)
 for line in sys.stdin:
  name=json.loads(line)
  if name not in ['disabled','all','chatra','tidio','crisp','knocket','native','failed','resources','bad-resources','invalid-resources','versionless','layout6','layout7','jsdelivr','unpkg','cdnjs','restore']:
   raise RuntimeError('Unknown integration profile')
  print(json.dumps(configure(name)),flush=True)
else:
 print(json.dumps(configure(a.profile)))
