#!/usr/bin/env python3
"""Fixed hk demo deployment controller. Runs on the host, never from an image."""
import argparse, fcntl, hashlib, json, os, re, subprocess, sys, time, urllib.request
from pathlib import Path
ROOT=Path('/root/docker/app/halo-butterfly-next/h2')
CADDY=Path('/root/docker/app/caddy/Caddyfile')
IMAGE='ghcr-mirror.infra.baizhukui.com/songxychn/halo-butterfly-next/demo'
DOMAIN='butterfly.baizhukui.com'
sys.path.insert(0,str(Path(__file__).parent))
from common import version_key
HTTP=urllib.request.build_opener(urllib.request.ProxyHandler({}))

def run(*args, data=None):
    return subprocess.check_output(args,input=data,text=True).strip()
def read(path,default=None): return json.loads(path.read_text()) if path.exists() else default
def write(path,value):
    temporary=path.with_suffix('.tmp')
    with temporary.open('w') as stream:
        os.fchmod(stream.fileno(),0o600);stream.write(json.dumps(value,indent=2)+'\n');stream.flush();os.fsync(stream.fileno())
    temporary.replace(path)
    directory=os.open(path.parent,os.O_RDONLY)
    try:os.fsync(directory)
    finally:os.close(directory)
def sha(value): return hashlib.sha256(value.encode()).hexdigest()
def inspect(name): return json.loads(run('docker','inspect',name))[0]
def check_container(name):
    obj=inspect(name)
    if name=='halo-butterfly-next':
        if obj['Config']['Labels'].get('com.docker.compose.project')!='halo-butterfly-next': raise RuntimeError('Legacy container ownership mismatch')
    elif obj['Config']['Labels'].get('hbn.demo.owner')!='release-h2': raise RuntimeError('Unexpected demo container')
    return obj

def start_deployment(state):
    database=state.get('database')
    if database:
        if state['container']!='halo-butterfly-next' or database!='halo-butterfly-next-db': raise RuntimeError('Unexpected legacy database')
        db=inspect(database)
        if db['Config']['Labels'].get('com.docker.compose.project')!='halo-butterfly-next': raise RuntimeError('Unexpected database owner')
        run('docker','start',database)
        for _ in range(60):
            if inspect(database)['State'].get('Health',{}).get('Status')=='healthy':break
            time.sleep(2)
        else:raise RuntimeError('Legacy database is not healthy')
    check_container(state['container'])
    run('docker','start',state['container'])

def candidate_config(text,upstream):
    # Only the previously deployed, simple domain block is eligible for substitution.
    match=re.search(r'(?m)^butterfly\.baizhukui\.com\s*\{\n(.*?)^\}',text,re.S)
    if not match or len(re.findall(r'(?m)^butterfly\.baizhukui\.com\s*\{',text))!=1: raise RuntimeError('Unexpected Caddy domain block')
    body=match.group(1)
    pattern=r'(?m)^([ \t]*reverse_proxy[ \t]+)(halo-butterfly-next|hbn-demo-[a-f0-9]{12}):8090[ \t]*$'
    changed,count=re.subn(pattern,lambda m:m.group(1)+upstream+':8090',body)
    if count!=1: raise RuntimeError('Unexpected demo upstream')
    return text[:match.start(1)]+changed+text[match.end(1):]

def apply_caddy(text,expected):
    if sha(CADDY.read_text())!=expected: raise RuntimeError('Shared Caddy config changed concurrently')
    run('docker','exec','-i','caddy','sh','-c','cat > /tmp/hbn-demo-candidate.conf',data=text)
    run('docker','exec','caddy','caddy','validate','--config','/tmp/hbn-demo-candidate.conf','--adapter','caddyfile')
    if sha(CADDY.read_text())!=expected: raise RuntimeError('Caddy config changed during validation')
    # Preserve inode: Caddy mounts the file itself.
    with CADDY.open('r+') as stream:
        stream.seek(0);stream.write(text);stream.truncate();stream.flush();os.fsync(stream.fileno())
    run('docker','exec','caddy','caddy','reload','--config','/etc/caddy/Caddyfile','--adapter','caddyfile')

def recover():
    pending=read(ROOT/'pending.json')
    if not pending:return
    current=sha(CADDY.read_text())
    if current not in [pending['afterSha'],sha(pending['beforeText'])]: raise RuntimeError('Interrupted update and unrelated Caddy changes; manual recovery required')
    # Disk may already be restored while Caddy still serves the candidate. Always reload.
    previous=pending['beforeState']
    start_deployment(previous)
    if previous.get('identity'): healthy(previous['container'],previous['identity'])
    apply_caddy(pending['beforeText'],current)
    if previous.get('identity') and not expected_receipt(receipt('https://'+DOMAIN),previous['identity']): raise RuntimeError('Recovered route is not serving previous identity')
    write(ROOT/'state.json',pending['beforeState'])
    (ROOT/'pending.json').unlink()

def receipt(base):
    request=urllib.request.Request(base+'/site-assets/demo-version.json?t='+str(time.time_ns()),headers={
        'User-Agent':'halo-butterfly-next-demo/1.0 (+https://github.com/songxychn/halo-butterfly-next)',
        'Accept':'application/json','Cache-Control':'no-cache'})
    with HTTP.open(request,timeout=15) as response: return json.load(response)
def expected_receipt(actual,expected):
    return actual.get('ready') is True and all(actual.get(k)==expected[k] for k in ['tag','sourceSha','themeSha256'])
def healthy(name,expected):
    for _ in range(100):
        value=check_container(name)
        if value['State'].get('Health',{}).get('Status')=='healthy':
            port=value['NetworkSettings']['Ports']['8090/tcp'][0]['HostPort']
            if expected_receipt(receipt('http://127.0.0.1:'+port),expected): return
            raise RuntimeError('Candidate identity mismatch')
        if value['State']['Status']=='exited': break
        time.sleep(5)
    raise RuntimeError('Candidate failed initialization or health check')

def deploy(image,bootstrap=False,retry=False):
    current=read(ROOT/'state.json')
    info=json.loads(run('docker','image','inspect',image))[0]
    image_id=info['Id']
    if current.get('imageId')==image_id:return
    if read(ROOT/'failed.json',{}).get('imageId')==image_id and not retry: raise RuntimeError('This image previously failed; explicit --retry required')
    # Metadata extraction runs only cat, with no networking, mounts or credentials.
    identity=json.loads(run('docker','run','--rm','--network','none','--entrypoint','cat',image_id,'/opt/demo/bundle/release.json'))
    version_key(identity['tag'])
    if not re.fullmatch('[a-f0-9]{40}',identity['sourceSha']) or not re.fullmatch('[a-f0-9]{64}',identity['themeSha256']):raise RuntimeError('Invalid release identity')
    if not bootstrap and identity.get('published') is not True: raise RuntimeError('Channel is not a published release')
    if current.get('identity',{}).get('published'):
        if version_key(identity['tag'])<=version_key(current['identity']['tag']):raise RuntimeError('Refusing downgrade or changed image for same version')
    name='hbn-demo-'+image_id.split(':')[1][:12]
    directory=ROOT/'instances'/name
    if not directory.exists(): directory.mkdir(mode=0o700,parents=True)
    exists=subprocess.run(['docker','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
    if exists:
        value=check_container(name)
        if value['Image']!=image_id or not any(m['Source']==str(directory) and m['Destination']=='/root/.halo2' for m in value['Mounts']):raise RuntimeError('Existing candidate does not match')
        run('docker','start',name)
    else:
        run('docker','run','-d','--name',name,'--restart','unless-stopped','--memory','896m','--cpus','1.5','--security-opt','no-new-privileges',
            '--log-driver','json-file','--log-opt','max-size=10m','--log-opt','max-file=3',
            '--label','hbn.demo.owner=release-h2','--label','com.centurylinklabs.watchtower.enable=false',
            '--network','reverse-proxy','-p','127.0.0.1::8090','--mount','type=bind,src='+str(directory)+',dst=/root/.halo2',image_id)
    try:
        healthy(name,identity)
        before=CADDY.read_text()
        if candidate_config(before,current['container'])!=before: raise RuntimeError('Active route differs from deployment state')
        after=candidate_config(before,name)
        check_container(current['container'])
        write(ROOT/'pending.json',{'beforeText':before,'beforeState':current,'afterSha':sha(after),'candidate':name})
        apply_caddy(after,sha(before))
        last_error='no receipt'
        for _ in range(12):
            try:
                actual=receipt('https://'+DOMAIN)
                if expected_receipt(actual,identity):break
                last_error='mismatched tag/source/theme or not ready'
            except (OSError,ValueError) as error:last_error=str(error)
            time.sleep(5)
        else:raise RuntimeError('Public deployment identity did not switch: '+last_error)
        updated={'container':name,'imageId':image_id,'identity':identity,'previous':current,'updatedAt':int(time.time())}
        write(ROOT/'state.json',updated)
        (ROOT/'pending.json').unlink()
        # Old data stays on disk, old image stays local. Stop only the owned old Halo.
        run('docker','stop','-t','60',current['container'])
        if current.get('database')=='halo-butterfly-next-db':
            db=inspect(current['database'])
            if db['Config']['Labels'].get('com.docker.compose.project')=='halo-butterfly-next':run('docker','stop','-t','60',current['database'])
        print('Demo deployed:',identity['tag'])
    except BaseException:
        recover()
        write(ROOT/'failed.json',{'imageId':image_id,'container':name,'at':int(time.time())})
        # Keep failed data for diagnosis, stop only its process.
        if read(ROOT/'state.json')['container']!=name:run('docker','stop','-t','60',name)
        raise

def rollback():
    state=read(ROOT/'state.json');old=state.get('previous')
    if not old:raise RuntimeError('No previous deployment')
    # Persist operator intent first: interruption must never re-enable the bad release.
    write(ROOT/'paused.json',{'reason':'explicit rollback; resume only after investigation'})
    start_deployment(old)
    if old.get('identity'):healthy(old['container'],old['identity'])
    else:
        for _ in range(60):
            if check_container(old['container'])['State'].get('Health',{}).get('Status')=='healthy':break
            time.sleep(3)
        else:raise RuntimeError('Legacy Halo did not become healthy')
    before=CADDY.read_text()
    if candidate_config(before,state['container'])!=before:raise RuntimeError('Active route differs from deployment state')
    after=candidate_config(before,old['container'])
    write(ROOT/'pending.json',{'beforeText':before,'beforeState':state,'afterSha':sha(after),'candidate':old['container']})
    try:
        apply_caddy(after,sha(before))
        if old.get('identity') and not expected_receipt(receipt('https://'+DOMAIN),old['identity']):raise RuntimeError('Rollback public identity mismatch')
        write(ROOT/'state.json',old);(ROOT/'pending.json').unlink()
        run('docker','stop','-t','60',state['container'])
    except BaseException:recover();raise

def main():
    os.umask(0o077)
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['poll','bootstrap','rollback','resume']);parser.add_argument('--image');parser.add_argument('--retry',action='store_true');args=parser.parse_args()
    if not ROOT.is_dir() or read(ROOT/'owner.json')!={'host':'hk','domain':DOMAIN,'project':'halo-butterfly-next'}:raise RuntimeError('Missing hk deployment owner')
    with (ROOT/'update.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);recover()
        if args.command=='rollback':return rollback()
        if args.command=='resume':(ROOT/'paused.json').unlink(missing_ok=True);return
        if (ROOT/'paused.json').exists():print('Demo updater paused');return
        if args.command=='bootstrap':
            if not args.image or not re.fullmatch(r'halo-butterfly-demo:rehearsal-[a-z0-9-]+',args.image):raise RuntimeError('Only local rehearsal bootstrap images are allowed')
            if read(ROOT/'state.json').get('identity',{}).get('published'):raise RuntimeError('Cannot bootstrap over a released demo')
            return deploy(args.image,bootstrap=True,retry=args.retry)
        # Before the first managed release there is no package/channel to pull.
        with HTTP.open('https://api.github.com/repos/songxychn/halo-butterfly-next/releases?per_page=100',timeout=20) as response: releases=json.load(response)
        managed=[]
        for item in releases:
            if item['draft'] or 'SHA256SUMS' not in {a['name'] for a in item.get('assets',[])}: continue
            try: version_key(item['tag_name'])
            except ValueError: continue
            managed.append(item['tag_name'])
        if not managed: print('No managed Release yet; keeping current demo');return
        run('docker','pull',IMAGE+':demo')
        value=json.loads(run('docker','image','inspect',IMAGE+':demo'))[0]
        pinned=next(x for x in value['RepoDigests'] if x.startswith(IMAGE+'@sha256:'))
        deploy(pinned,retry=args.retry)
if __name__=='__main__':main()
