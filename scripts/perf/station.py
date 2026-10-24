"""Read-only owned-Halo preflight and narrow deterministic long-article seeding."""
import argparse, contextlib, hashlib, importlib.util, json, os, re, shutil, subprocess, sys, time
from pathlib import Path
from zipfile import ZipFile
ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / 'fixtures/performance'

def sha(data): return hashlib.sha256(data).hexdigest()
def canonical(data): return json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
def fixture():
    meta = json.loads((FIXTURE / 'longform/fixture.json').read_text())
    for name, digest in meta['files'].items():
        if Path(name).is_absolute() or '..' in Path(name).parts: raise ValueError('Unsafe longform path')
        if sha((FIXTURE / 'longform' / name).read_bytes()) != digest: raise ValueError('Longform digest mismatch')
    body=(FIXTURE / 'longform/article.html').read_text()
    if meta.get('schema')!=1 or meta.get('name')!='perf-longform-v1' or meta.get('title')!='性能基准：固定长文章' or meta.get('date')!='2026-08-01T04:00:00Z' or meta.get('cover')!='/lab/perf-chart-01.svg':raise ValueError('Unexpected longform identity')
    if meta.get('counts')!={'sections':20,'codeBlocks':8,'tables':2,'images':12,'minimumHanCharacters':10000}:raise ValueError('Unexpected longform coverage')
    if [len(re.findall(pattern,body)) for pattern in [r'<h2\b',r'<pre>',r'<table>',r'<img\b']]!=[20,8,2,12] or len(re.findall(r'[\u4e00-\u9fff]',body))<10000:raise ValueError('Missing longform semantic coverage')
    if re.search(r'https?:|//|<script|<iframe|<link|\bon\w+=',body,re.I):raise ValueError('External/active longform content')
    expected_files={'article.html',*[f'assets/perf-chart-{i:02}.svg' for i in range(1,13)]}
    if set(meta['files'])!=expected_files:raise ValueError('Missing/extra longform files')
    if set(re.findall(r'src="([^"]+)"',body))!={f'/lab/perf-chart-{i:02}.svg' for i in range(1,13)}:raise ValueError('Wrong longform images')
    return meta, body
def load_lab(runtime):
    runtime = runtime.resolve(); identity = json.loads((runtime / 'lab.json').read_text())
    if identity.get('owner') != 'halo-butterfly-next-comparison' or identity.get('schema') != 1: raise ValueError('Not an owned comparison lab')
    ports = identity['ports']; os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(ports['halo']), HEXO_PORT=str(ports['hexo']))
    spec = importlib.util.spec_from_file_location('perf_lab', ROOT / 'scripts/lab/lab.py'); lab = importlib.util.module_from_spec(spec); spec.loader.exec_module(lab)
    # PERF compares two Halo packages on the same station; Hexo is only a visual
    # parity reference and is not an input to these Lighthouse measurements.
    if not lab.owned_process('halo'): raise ValueError('Owned Halo process must match runtime and port')
    return lab, lab.Client()
def check_post(client, meta, body, published=True):
    obj = client.api('/apis/content.halo.run/v1alpha1/posts/' + meta['name'])
    expected = {'title': meta['title'], 'slug': meta['name'], 'cover': meta['cover'], 'publishTime': meta['date'], 'visible': 'PUBLIC'}
    if any(obj['spec'].get(k) != v for k,v in expected.items()): raise ValueError('Existing performance post conflicts with fixture')
    if published and not obj['spec'].get('publish'): raise ValueError('Longform is not published')
    endpoint = 'release-content' if obj['spec'].get('publish') else 'content'
    content = client.api('/apis/api.console.halo.run/v1alpha1/posts/' + meta['name'] + '/' + endpoint)
    if content['raw'] != body: raise ValueError('Published/draft longform body differs')
    return obj

def seed(lab, client):
    meta, body = fixture(); directory = lab.RUNTIME / 'halo/data/attachments/lab'
    # Check every existing object/asset before any write; never overwrite content.
    try: existing = client.api('/apis/content.halo.run/v1alpha1/posts/' + meta['name'])
    except lab.ApiError as error:
        if error.status != 404: raise
        existing = None
    if existing is not None: check_post(client, meta, body, published=False)
    for name,digest in meta['files'].items():
        if not name.startswith('assets/'): continue
        dest = directory / Path(name).name
        if dest.exists() and sha(dest.read_bytes()) != digest: raise ValueError('Existing attachment conflicts; no mutation')
    directory.mkdir(parents=True, exist_ok=True)
    for name in meta['files']:
        if name.startswith('assets/'):
            dest = directory / Path(name).name
            if not dest.exists(): shutil.copyfile(FIXTURE / 'longform' / name, dest)
    if existing is None:
        spec = {'title':meta['title'],'slug':meta['name'],'cover':meta['cover'],'publishTime':meta['date'],'visible':'PUBLIC','owner':client.auth['username'],'deleted':False,'publish':False,'allowComment':True,'pinned':False,'priority':0,'excerpt':{'autoGenerate':True},'tags':[],'categories':[]}
        existing = client.api('/apis/api.console.halo.run/v1alpha1/posts','POST',{'post':{'apiVersion':'content.halo.run/v1alpha1','kind':'Post','metadata':{'name':meta['name']},'spec':spec},'content':{'content':body,'raw':body,'rawType':'HTML'}})
    if not existing['spec'].get('publish'): client.api('/apis/api.console.halo.run/v1alpha1/posts/'+meta['name']+'/publish','PUT')
    for _ in range(30):
        try: check_post(client,meta,body); break
        except ValueError: time.sleep(.2)
    else: raise ValueError('Longform publish did not settle')
    return {'result':'seeded-and-checked','name':meta['name'],'bodySha256':sha(body.encode()),'assets':12}

def plugin_collections(client, enabled, base, owner, lock):
    for file,key in [('versions.json','pluginLockSha256'),('content.json','pluginContentSha256')]:
        if sha((ROOT/'fixtures/plugins'/file).read_bytes())!=lock[key]:raise ValueError('The shared plugin fixture changed; re-freeze and remeasure both sides')
    expected_locks={'fixtures/search-comment/versions.json','fixtures/math/versions.json'}
    if set(lock.get('additionalDependencyLocks',{}))!=expected_locks:raise ValueError('Missing current recommended plugin dependency locks')
    for file,digest in lock['additionalDependencyLocks'].items():
        if sha((ROOT/file).read_bytes())!=digest:raise ValueError('The recommended plugin dependency lock changed; re-freeze and remeasure both sides')
    spec=importlib.util.spec_from_file_location('performance_plugin_contract', ROOT/'scripts/plugins/lab.py')
    contract=importlib.util.module_from_spec(spec);spec.loader.exec_module(contract)
    expected=contract.desired('populated',base,owner);collections={}
    for plugin,kinds in [('PluginPhotos',['photos','photogroups']),('PluginLinks',['links','linkgroups']),('PluginMoments',['moments'])]:
        if plugin not in enabled:continue
        for kind in kinds:
            items=client.api(contract.api(kind)+'?page=0&size=1000')['items']
            normalized=sorted([contract.clean(item) for item in items],key=lambda p:p['metadata']['name'])
            target=sorted(expected[kind],key=lambda p:p['metadata']['name'])
            if canonical(normalized)!=canonical(target):raise ValueError('Actual plugin objects differ from fixed populated fixture: '+kind)
            collections[kind]=normalized
    return collections

def validate_enabled_plugins(plugins, enabled):
    if {p['metadata']['name'] for p in plugins if p['spec'].get('enabled')}!=enabled:raise ValueError('Enabled plugins differ from fixed profile')
    for plugin in plugins:
        expected='STARTED' if plugin['metadata']['name'] in enabled else 'DISABLED'
        if plugin.get('status',{}).get('phase')!=expected:
            raise ValueError('Performance plugin is not '+expected+': '+plugin['metadata']['name'])

def plugin_configs(client, plugins, api_error):
    """Snapshot every installed plugin's settings, including disabled plugins.

    Hashes go into reports; configuration values stay inside the local process.
    All installed plugins are included so profile toggles cannot hide drift.
    """
    configs={}
    for plugin in sorted(plugins,key=lambda p:p['metadata']['name']):
        name=plugin['metadata']['name'];reference=plugin['spec'].get('configMapName')
        if reference is None:
            configs[name]={'configMapName':None};continue
        if not isinstance(reference,str) or not re.fullmatch(r'[A-Za-z0-9_.-]+',reference):raise ValueError('Unsafe plugin ConfigMap reference')
        try:
            value=client.api('/api/v1alpha1/configmaps/'+reference)
        except api_error as error:
            if error.status!=404:raise
            configs[name]={'configMapName':reference,'exists':False};continue
        configs[name]={'configMapName':reference,'exists':True,'data':value.get('data',{})}
    return configs

def authenticated_principal(client):
    current=client.api('/apis/api.console.halo.run/v1alpha1/users/-')
    name=current.get('user',{}).get('metadata',{}).get('name')
    if name!=client.auth['username']:raise ValueError('Performance station authenticated principal changed')
    return name

def inspect(lab,client,args):
    principal=authenticated_principal(client)
    package=args.package.resolve(); raw=package.read_bytes(); installed=json.loads((lab.RUNTIME/'installed-package.json').read_text())
    if installed['sha256']!=sha(raw) or not re.fullmatch('[a-f0-9]{40}',installed.get('sourceCommit','')): raise ValueError('Package/installation identity mismatch')
    with ZipFile(package) as z:
        if sha(z.read('settings.yaml'))!=json.loads((FIXTURE/'theme-defaults.json').read_text())['settingsSha256']:raise ValueError('Frozen theme defaults no longer match package settings; re-freeze and remeasure both sides')
        for name in z.namelist():
            if name.endswith('/'): continue
            if Path(name).is_absolute() or '..' in Path(name).parts: raise ValueError('Unsafe package path')
            if (lab.RUNTIME/'halo/data/themes/halo-butterfly-next'/name).read_bytes()!=z.read(name): raise ValueError('Installed package bytes differ')
    jar=lab.RUNTIME/'halo'/lab.HALO_JAR_NAME; jarsha=sha(jar.read_bytes())
    if jarsha!=lab.VERSIONS['halo']['sha256']: raise ValueError('Wrong official Halo JAR')
    process=json.loads((lab.RUNTIME/'halo-process.json').read_text())
    command=subprocess.check_output(['ps','-p',str(process['pid']),'-o','command='],text=True)
    if process['identity']!=str(jar) or str(jar) not in command or str(lab.RUNTIME/'halo/data') not in command:
        raise ValueError('Running Halo differs from pinned official JAR')
    meta,body=fixture(); post=check_post(client,meta,body)
    lock=json.loads((FIXTURE/'plugin-profile.json').read_text()); enabled=set(lock['profiles'][args.profile][args.route]); actual=client.api('/apis/plugin.halo.run/v1alpha1/plugins?size=100')['items']
    validate_enabled_plugins(actual,enabled)
    expected={p['name']:p for p in lock['plugins']+[lock['probe']]}; versions=[]
    for name in sorted(enabled):
        p=next(p for p in actual if p['metadata']['name']==name); fixed=expected[name]
        if p['spec']['version']!=fixed['version']: raise ValueError('Wrong plugin version')
        jar=lab.RUNTIME/'halo/data/plugins'/(name+'-'+fixed['version']+'.jar')
        if sha(jar.read_bytes())!=fixed['sha256']: raise ValueError('Wrong installed plugin JAR')
        versions.append({'name':name,'version':fixed['version'],'sha256':fixed['sha256']})
    # Preserve the entire installed inventory, including disabled optional plugins.
    inventory=[]
    for plugin in sorted(actual,key=lambda p:p['metadata']['name']):
        name=plugin['metadata']['name'];version=plugin['spec']['version']
        if not re.fullmatch(r'[A-Za-z0-9_.-]+',name) or not re.fullmatch(r'[A-Za-z0-9_.+-]+',version):raise ValueError('Unsafe installed plugin identity')
        jar=lab.RUNTIME/'halo/data/plugins'/(name+'-'+version+'.jar')
        inventory.append({'name':name,'version':version,'enabled':bool(plugin['spec'].get('enabled')),'phase':plugin.get('status',{}).get('phase'),'sha256':sha(jar.read_bytes())})
    collections=plugin_collections(client, enabled, lab.BASE['halo'], client.auth['username'], lock)
    plugin_settings=plugin_configs(client,actual,lab.ApiError)
    config=client.api('/apis/api.console.halo.run/v1alpha1/themes/halo-butterfly-next/json-config')
    expected_config=json.loads((FIXTURE/'theme-defaults.json').read_text())['config']
    if canonical(config)!=canonical(expected_config):raise ValueError('Theme config differs from frozen actual defaults; default/recommended coverage remains incomplete')
    posts=client.api('/apis/content.halo.run/v1alpha1/posts?size=1000')['items']; content=[]
    for p in sorted(posts,key=lambda p:p['metadata']['name']):
        if not p['spec'].get('publish'):continue
        text=client.api('/apis/api.console.halo.run/v1alpha1/posts/'+p['metadata']['name']+'/release-content')['raw']
        content.append({'name':p['metadata']['name'],'spec':{k:v for k,v in p['spec'].items() if k not in ['headSnapshot','releaseSnapshot','baseSnapshot']},'bodySha256':sha(text.encode())})
    system=client.api('/api/v1alpha1/configmaps/system')['data']
    users=client.api('/api/v1alpha1/users?size=1000')['items']
    public_users=sorted([{'name':u['metadata']['name'],**{k:u['spec'].get(k) for k in ['displayName','bio','avatar']}} for u in users],key=lambda u:u['name'])
    menus={k:sorted([{'name':v['metadata']['name'],'spec':v['spec']} for v in client.api('/api/v1alpha1/'+k+'?size=1000')['items']],key=lambda v:v['name']) for k in ['menus','menuitems']}
    asset_hashes={}
    for name,digest in meta['files'].items():
        if name.startswith('assets/'):
            h=sha((lab.RUNTIME/'halo/data/attachments/lab'/Path(name).name).read_bytes())
            if h!=digest:raise ValueError('Installed performance image differs')
            asset_hashes[name]=h
    routes={'home':'/','longform':post['status']['permalink'],'photos':'/photos','public-layout':'/__layout-probe/head'}
    base=lab.BASE['halo']
    from urllib.parse import urlsplit
    for key,url in routes.items():
        parsed=urlsplit(url)
        if parsed.netloc and parsed.netloc!=urlsplit(base).netloc:raise ValueError('Nonlocal performance route')
        routes[key]=parsed.path+('?' + parsed.query if parsed.query else '')
    identity={'sourceSha':installed['sourceCommit'],'packageSha256':sha(raw),'haloJarSha256':jarsha,'fixtureSha256':sha(canonical({'longform':meta,'plugins':lock,'assets':asset_hashes})),'configSha256':sha(canonical({'theme':config,'system':system,'users':public_users,'menus':menus,'pluginConfigs':plugin_settings})),'contentSha256':sha(canonical({'posts':content,'pluginCollections':collections})),'pluginsSha256':sha(canonical({'installed':inventory,'enabledArtifacts':versions})),'pluginConfigSha256':sha(canonical(plugin_settings))}
    return {'schema':1,'authenticatedPrincipal':principal,'base':base,'profile':args.profile,'route':args.route,'requiredPlugins':lock['requiredPlugins'][args.route],'routes':routes,'identity':identity,'sourceAttribution':installed.get('sourceCommitAttribution','installer-record; independently verify source-to-artifact provenance'),'installed':installed,'plugins':inventory,'enabledArtifacts':versions,'contentCounts':{'posts':len(content),**{k:len(v) for k,v in collections.items()}},'result':'passed'}

def paired_inspections(lab,client,args,input_stream,output_stream):
    # The same client and immutable CLI parameters are used for both snapshots.
    # The protocol only permits requesting the after snapshot, never mutations.
    def snapshot():
        with contextlib.redirect_stdout(sys.stderr):result=inspect(lab,client,args)
        output_stream.write(json.dumps(result,ensure_ascii=False)+'\n');output_stream.flush()
    snapshot()
    if input_stream.readline(64)!='after\n':raise ValueError('Expected one after-snapshot command; EOF or other commands are invalid')
    snapshot()

def main():
    p=argparse.ArgumentParser();p.add_argument('command',choices=['seed-longform','inspect','session']);p.add_argument('--lab-runtime',type=Path,required=True);p.add_argument('--package',type=Path);p.add_argument('--profile',choices=['default','recommended'],default='default');p.add_argument('--route',choices=['home','longform','photos','public-layout']);args=p.parse_args()
    if args.command in ['inspect','session'] and (args.package is None or args.route is None):p.error('--package and --route required')
    with contextlib.redirect_stdout(sys.stderr):lab,client=load_lab(args.lab_runtime)
    if args.command=='session':paired_inspections(lab,client,args,sys.stdin,sys.stdout)
    else:print(json.dumps(seed(lab,client) if args.command=='seed-longform' else inspect(lab,client,args),ensure_ascii=False))
if __name__=='__main__':main()
