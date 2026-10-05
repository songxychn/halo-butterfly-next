#!/usr/bin/env python3
"""Publish only staged, checked assets. Existing public bytes are never overwritten."""
import subprocess, sys, tempfile
from pathlib import Path
from common import REPO,digest,gh,version_key

def release_record(tag):
    # The tag endpoint excludes drafts, including drafts just created by this publisher.
    for page in range(1,101):
        rows=gh('releases?per_page=100&page='+str(page))
        record=next((r for r in rows if r['tag_name']==tag),None)
        if record is not None: return record
        if len(rows)<100: return None
    raise RuntimeError('Release pagination exceeded bound')

def verify(tag,expected):
    record=release_record(tag)
    if record is None: raise RuntimeError('Release not found: '+tag)
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
    current=release_record(tag)
    if current is None:
        cmd=['gh','release','create',tag,'--repo',REPO,'--verify-tag','--draft','--title',tag,'--notes-file','releases/'+tag+'.md']
        if '-' in tag: cmd.append('--prerelease')
        subprocess.run(cmd,check=True)
        current=release_record(tag)
    if current is None: raise RuntimeError('Created release not found: '+tag)
    names={a['name'] for a in current['assets']}
    if current['draft']:
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
