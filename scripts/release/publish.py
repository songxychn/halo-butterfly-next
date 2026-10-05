#!/usr/bin/env python3
"""Publish only staged, checked assets. Existing public bytes are never overwritten."""
import json, os, subprocess, sys, tempfile
from pathlib import Path
from common import REPO,digest,gh,run,version_key

def verify(tag,expected):
    record=gh('releases/tags/'+tag)
    assets={a['name']:a for a in record['assets']}
    if set(assets)!={p.name for p in expected.iterdir()}: raise RuntimeError('Release asset inventory mismatch')
    with tempfile.TemporaryDirectory() as directory:
        subprocess.run(['gh','release','download',tag,'--repo',REPO,'--dir',directory],check=True)
        for path in expected.iterdir():
            if digest(Path(directory)/path.name)!=digest(path): raise RuntimeError('Release attachment differs: '+path.name)
    return record

def main():
    tag=sys.argv[1];version_key(tag)
    expected=Path('.runtime/release-assets')
    known=json.loads(run('gh','release','list','--repo',REPO,'--limit','1000','--json','tagName,isDraft'))
    existing=next((r for r in known if r['tagName']==tag),None)
    if not existing:
        cmd=['gh','release','create',tag,'--repo',REPO,'--verify-tag','--draft','--title',tag,'--notes-file','releases/'+tag+'.md']
        if '-' in tag: cmd.append('--prerelease')
        subprocess.run(cmd,check=True)
        existing={'isDraft':True}
    current=gh('releases/tags/'+tag);names={a['name'] for a in current['assets']}
    if existing['isDraft']:
        # Resume missing uploads; existing attachments must already match.
        for file in expected.iterdir():
            if file.name not in names:
                subprocess.run(['gh','release','upload',tag,str(file),'--repo',REPO],check=True)
    record=verify(tag,expected)
    if record['draft']:
        subprocess.run(['gh','release','edit',tag,'--repo',REPO,'--draft=false'],check=True)
    record=verify(tag,expected)
    if record['draft']: raise RuntimeError('Release still draft')
    print('Published and downloaded verified release:',record['html_url'])
if __name__=='__main__':main()
