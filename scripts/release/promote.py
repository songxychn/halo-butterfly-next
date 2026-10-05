#!/usr/bin/env python3
import json, os, subprocess, sys
from pathlib import Path
from common import latest_tag,run,version_key

def main():
    tag,image=sys.argv[1:];version_key(tag)
    if image!='ghcr.io/songxychn/halo-butterfly-next/demo': raise ValueError('Unexpected image repository')
    if latest_tag()!=tag: raise RuntimeError('Newer release exists; no promotion')
    immutable=image+':'+tag
    probe=subprocess.run(['docker','manifest','inspect',immutable],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    identity=json.loads(Path('.runtime/demo-bundle/release.json').read_text())
    if probe.returncode==0:
        subprocess.run(['docker','pull',immutable],check=True)
        old=run('docker','run','--rm','--entrypoint','cat',immutable,'/opt/demo/bundle/release.json')
        if json.loads(old)!=identity: raise RuntimeError('Existing release image identity mismatch')
        selected=immutable
    else:
        # Auth/network errors are not absence. Only an explicit missing manifest permits creation.
        if not any(x in probe.stderr.decode().lower() for x in ['manifest unknown','no such manifest']): raise RuntimeError('Cannot establish immutable image absence')
        subprocess.run(['docker','tag','demo-candidate',immutable],check=True)
        subprocess.run(['docker','push',immutable],check=True)
        selected=immutable
    if latest_tag()!=tag: raise RuntimeError('Newer release appeared; no channel promotion')
    subprocess.run(['docker','tag',selected,image+':demo'],check=True)
    subprocess.run(['docker','push',image+':demo'],check=True)
    digest=run('docker','image','inspect',selected,'--format','{{index .RepoDigests 0}}')
    Path('.runtime/demo-promotion.json').write_text(json.dumps({'tag':tag,'image':digest,'identity':identity},indent=2)+'\n')
if __name__=='__main__': main()
