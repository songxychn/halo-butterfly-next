#!/usr/bin/env python3
import base64, json, os, subprocess, sys, urllib.request, urllib.error, urllib.parse
from pathlib import Path
from common import latest_tag,run,version_key

def manifest_exists(image,tag,actor,password,open_request=None):
    """Docker CLI collapses authorization errors into 'no such manifest'; preserve HTTP status."""
    if image!='ghcr.io/songxychn/halo-butterfly-next/demo' or not actor or not password:raise ValueError('Missing scoped GHCR identity')
    version_key(tag)
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    if open_request is None:open_request=urllib.request.build_opener(NoRedirect()).open
    repository=image.removeprefix('ghcr.io/')
    query=urllib.parse.urlencode({'service':'ghcr.io','scope':'repository:'+repository+':pull,push'})
    authentication=base64.b64encode((actor+':'+password).encode()).decode()
    request=urllib.request.Request('https://ghcr.io/token?'+query,headers={'Authorization':'Basic '+authentication,'Accept':'application/json'})
    with open_request(request,timeout=30) as response:
        if response.status!=200:raise RuntimeError('GHCR authentication did not succeed')
        token=json.load(response)
    bearer=token.get('token') or token.get('access_token')
    if not isinstance(bearer,str) or not bearer:raise RuntimeError('GHCR authentication returned no token')
    request=urllib.request.Request('https://ghcr.io/v2/'+repository+'/manifests/'+tag,headers={
        'Authorization':'Bearer '+bearer,
        'Accept':','.join(['application/vnd.oci.image.manifest.v1+json','application/vnd.oci.image.index.v1+json','application/vnd.docker.distribution.manifest.v2+json','application/vnd.docker.distribution.manifest.list.v2+json'])})
    try:
        with open_request(request,timeout=30) as response:
            if response.status!=200:raise RuntimeError('Unexpected GHCR manifest response')
            return True
    except urllib.error.HTTPError as error:
        if error.code==404:
            try:errors=json.load(error).get('errors',[])
            except (ValueError,AttributeError):errors=[]
            if isinstance(errors,list) and errors and all(isinstance(e,dict) and e.get('code') in ['MANIFEST_UNKNOWN','NAME_UNKNOWN'] for e in errors):return False
        raise RuntimeError('Cannot establish immutable image absence (HTTP '+str(error.code)+')') from None

def main():
    tag,image=sys.argv[1:];version_key(tag)
    if image!='ghcr.io/songxychn/halo-butterfly-next/demo': raise ValueError('Unexpected image repository')
    if latest_tag()!=tag: raise RuntimeError('Newer release exists; no promotion')
    immutable=image+':'+tag
    exists=manifest_exists(image,tag,os.environ.get('GITHUB_ACTOR'),os.environ.get('GH_TOKEN'))
    identity=json.loads(Path('.runtime/demo-bundle/release.json').read_text())
    if exists:
        subprocess.run(['docker','pull',immutable],check=True)
        old=run('docker','run','--rm','--entrypoint','cat',immutable,'/opt/demo/bundle/release.json')
        if json.loads(old)!=identity: raise RuntimeError('Existing release image identity mismatch')
        selected=immutable
    else:
        subprocess.run(['docker','tag','demo-candidate',immutable],check=True)
        subprocess.run(['docker','push',immutable],check=True)
        selected=immutable
    if latest_tag()!=tag: raise RuntimeError('Newer release appeared; no channel promotion')
    subprocess.run(['docker','tag',selected,image+':demo'],check=True)
    subprocess.run(['docker','push',image+':demo'],check=True)
    digest=run('docker','image','inspect',selected,'--format','{{index .RepoDigests 0}}')
    Path('.runtime/demo-promotion.json').write_text(json.dumps({'tag':tag,'image':digest,'identity':identity},indent=2)+'\n')
if __name__=='__main__': main()
