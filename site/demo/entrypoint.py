#!/usr/bin/env python3
"""One version, one H2 directory. Never adopts an unrelated work directory."""
import fcntl, hashlib, json, os, shlex, shutil, signal, subprocess, sys, time, urllib.request
from pathlib import Path
SOURCE=Path('/opt/demo/source')
sys.path[:0]=[str(SOURCE/'site/tools'), str(SOURCE/'site/deploy')]
from runtime import write_json, read_json
from initialize import import_public
DATA=Path('/root/.halo2')
BUNDLE=Path('/opt/demo/bundle')
LOCAL=urllib.request.build_opener(urllib.request.ProxyHandler({}))

class Runtime:
    root=DATA/'demo-operations'
    base='http://127.0.0.1:8090'
    external_url='https://butterfly.baizhukui.com'
    def __init__(self, process): self.process=process
    def check(self):
        if self.process.poll() is not None: raise RuntimeError('Owned Halo process exited')
        if read_json(DATA/'demo-owner.json')!=read_json(BUNDLE/'release.json'): raise RuntimeError('Instance ownership mismatch')
        return self.process.pid
    owned_pid=check

def check_pages():
    mapping=read_json(BUNDLE/'permalinks.json')
    for path in ['/', '/page/2', '/docs', *mapping.values()]:
        with LOCAL.open(urllib.request.Request('http://127.0.0.1:8090'+path,headers={'Host':'butterfly.baizhukui.com','X-Forwarded-Proto':'https'}),timeout=20) as response:
            body=response.read()
        if b'127.0.0.1:8090' in body or b'localhost:8090' in body: raise RuntimeError('Loopback URL in public page: '+path)
    assets=read_json(BUNDLE/'sources.json')['assets']
    for asset in assets:
        path='/site-assets/'+asset['id']+'-'+asset['sha256'][:16]+'.webp'
        with LOCAL.open(urllib.request.Request('http://127.0.0.1:8090'+path,headers={'Host':'butterfly.baizhukui.com','X-Forwarded-Proto':'https'}),timeout=20) as response: data=response.read()
        if hashlib.sha256(data).hexdigest()!=asset['sha256']: raise RuntimeError('Public asset mismatch')

def health():
    if not (DATA/'demo-operations/ready.json').exists(): return 1
    with LOCAL.open('http://127.0.0.1:8090/actuator/health/readiness',timeout=5) as r:
        return 0 if json.load(r).get('status')=='UP' else 1

def main():
    os.umask(0o077)
    DATA.mkdir(parents=True,exist_ok=True)
    marker=DATA/'demo-owner.json'
    release=read_json(BUNDLE/'release.json')
    if marker.exists():
        if read_json(marker)!=release: raise RuntimeError('Use a new empty directory for a different demo version')
    else:
        if any(DATA.iterdir()): raise RuntimeError('Refusing to initialize a nonempty unowned directory')
        write_json(marker,release)
    operations=DATA/'demo-operations';operations.mkdir(exist_ok=True)
    lock=(operations/'instance.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    ready=operations/'ready.json'
    ready.unlink(missing_ok=True)
    if not (operations/'import-started.json').exists():
        (DATA/'plugins').mkdir(exist_ok=True)
        shutil.copyfile('/opt/demo/search.jar',DATA/'plugins/PluginSearchWidget-1.7.1.jar')
    public_url=os.environ.get('HALO_EXTERNAL_URL','https://butterfly.baizhukui.com')
    if public_url!='https://butterfly.baizhukui.com': raise RuntimeError('Unexpected demo public URL')
    # No inherited external database configuration is allowed.
    if any(k.startswith('SPRING_R2DBC_') for k in os.environ): raise RuntimeError('Demo requires its embedded H2 database')
    cmd=['java',*shlex.split(os.environ.get('JVM_OPTS','-Xmx512m')),'-XX:SharedArchiveFile=application.jsa','-jar','application.jar',
         '--halo.work-dir='+str(DATA),'--halo.external-url='+public_url,'--spring.sql.init.platform=h2',
         '--spring.r2dbc.url=r2dbc:h2:file:///'+str(DATA)+'/db/halo-next?MODE=MySQL&DB_CLOSE_ON_EXIT=FALSE',
         '--halo.attachment.resource-mappings[0].path-pattern=/site-assets/**','--halo.attachment.resource-mappings[0].locations[0]=site-assets','--springdoc.api-docs.enabled=false']
    process=subprocess.Popen(cmd)
    def stop(signum=None, frame=None):
        if process.poll() is None: process.terminate()
    signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
    try:
        runtime=Runtime(process)
        for _ in range(180):
            runtime.check()
            try:
                with LOCAL.open(runtime.base+'/actuator/health/readiness',timeout=2) as r:
                    if json.load(r).get('status')=='UP': break
            except Exception: pass
            time.sleep(1)
        else: raise RuntimeError('Halo startup timeout')
        if not (operations/'import-complete.json').exists(): import_public(runtime,BUNDLE,DATA,public_url)
        check_pages()
        # Public, non-sensitive receipt for CI to distinguish delivery from deployment.
        receipt={**release,'contentCount':len(read_json(BUNDLE/'permalinks.json')),'database':'h2','ready':True}
        write_json(DATA/'attachments/site-assets/demo-version.json',receipt)
        write_json(ready,receipt)
        return process.wait()
    finally:
        ready.unlink(missing_ok=True)
        stop()
        try: process.wait(timeout=45)
        except subprocess.TimeoutExpired: process.kill();process.wait()

if __name__=='__main__':
    if sys.argv[1:]==['health']:
        try: sys.exit(health())
        except Exception: sys.exit(1)
    sys.exit(main())
