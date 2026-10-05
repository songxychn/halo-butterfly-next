#!/usr/bin/env python3
"""Disposable Docker smoke, including restart; never mounts local credentials/data."""
import json, subprocess, sys, time, uuid
from pathlib import Path
image=sys.argv[1]; name='hbn-demo-smoke-'+uuid.uuid4().hex[:10]
def run(*args): return subprocess.check_output(args,text=True).strip()
def healthy():
    for _ in range(90):
        state=json.loads(run('docker','inspect',name))[0]['State']
        if state.get('Health',{}).get('Status')=='healthy': return
        if state['Status']=='exited': break
        time.sleep(5)
    raise RuntimeError('Demo did not initialize/return healthy')
try:
    subprocess.run(['docker','run','-d','--name',name,'--memory','896m','--cpus','2','--label','com.centurylinklabs.watchtower.enable=false',image],check=True)
    healthy()
    first=run('docker','exec',name,'cat','/root/.halo2/demo-operations/ready.json')
    credentials=run('docker','exec',name,'sha256sum','/root/.halo2/demo-operations/credentials.json').split()[0]
    subprocess.run(['docker','restart','-t','60',name],check=True)
    healthy()
    second=run('docker','exec',name,'cat','/root/.halo2/demo-operations/ready.json')
    if first!=second or credentials!=run('docker','exec',name,'sha256sum','/root/.halo2/demo-operations/credentials.json').split()[0]: raise RuntimeError('Restart changed initialized identity')
    Path('.runtime/demo-smoke.json').write_text(json.dumps({'passed':True,'restartPreservedCredentials':True,'receipt':json.loads(second)},indent=2)+'\n')
finally:
    subprocess.run(['docker','logs','--tail','100',name],check=False)
    # Only the random, job-owned disposable container and its anonymous volume.
    subprocess.run(['docker','rm','-f','-v',name],check=False)
