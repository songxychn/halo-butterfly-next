#!/usr/bin/env python3
"""Validate a published release and download its exact theme, never rebuild it."""
import json, subprocess, sys
from pathlib import Path
from common import REPO,digest,gh,latest_tag,run,version_key,validate_evidence,verify_asset_directory

def main():
    tag=sys.argv[1];version_key(tag)
    if latest_tag()!=tag: raise RuntimeError('Only the newest published version may promote the demo')
    release=gh('releases/tags/'+tag)
    if release['draft']: raise RuntimeError('Cannot deploy a draft')
    output=Path('.runtime/published');output.mkdir(parents=True,exist_ok=False)
    subprocess.run(['gh','release','download',tag,'--repo',REPO,'--dir',str(output)],check=True)
    package='halo-butterfly-next-'+tag[1:]+'.zip'
    evidence=verify_asset_directory(output,[a['name'] for a in release['assets']],tag)
    source=run('git','rev-parse','HEAD')
    if run('git','rev-parse',tag+'^{commit}')!=source: raise RuntimeError('Tag checkout mismatch')
    subprocess.run(['git','merge-base','--is-ancestor',source,'origin/master'],check=True)
    if json.loads(Path('package.json').read_text())['version']!=tag[1:]: raise RuntimeError('Tag version mismatch')
    if evidence['tag']!=tag or evidence['sourceSha']!=source or evidence['themeSha256']!=digest(output/package): raise RuntimeError('Release identity mismatch')
    validate_evidence(evidence['acceptance'],tag,source,digest(output/package))
    asset=next(a for a in release['assets'] if a['name']==package)
    (output/'release-identity.json').write_text(json.dumps({'releaseId':release['id'],'themeAssetId':asset['id'],'tag':tag,'sourceSha':source,'themeSha256':digest(output/package)},indent=2)+'\n')
if __name__=='__main__': main()
