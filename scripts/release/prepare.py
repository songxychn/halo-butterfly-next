#!/usr/bin/env python3
"""Validate release qualification and stage immutable public assets. No publishing."""
import json, re, shutil, subprocess, sys, tarfile
from pathlib import Path
from common import digest,run,validate_evidence,version_key

def main():
    tag=sys.argv[1];version_key(tag);version=tag[1:]
    source=run('git','rev-parse','HEAD')
    if run('git','rev-parse',tag+'^{commit}')!=source: raise ValueError('Checkout does not match release tag')
    subprocess.run(['git','merge-base','--is-ancestor',source,'origin/master'],check=True)
    if json.loads(Path('package.json').read_text())['version']!=version: raise ValueError('Tag/package version mismatch')
    package=Path('dist')/('halo-butterfly-next-'+version+'.zip')
    if not package.is_file(): raise ValueError('Missing verified theme archive')
    evidence=json.loads((Path('releases')/(tag+'.json')).read_text())
    validate_evidence(evidence,tag,source,digest(package))
    notes=Path('releases')/(tag+'.md')
    if not notes.is_file() or len(notes.read_text().strip())<40: raise ValueError('Missing version-specific release notes')
    out=Path('.runtime/release-assets');out.mkdir(parents=True,exist_ok=False)
    shutil.copyfile(package,out/package.name)
    archive=out/('halo-butterfly-next-'+version+'-source.tar.gz')
    with archive.open('wb') as stream: subprocess.run(['git','archive','--format=tar.gz','--prefix=halo-butterfly-next/','HEAD'],stdout=stream,check=True)
    # Independently rebuild the exact distributed source archive.
    unpack=Path('.runtime/release-source');unpack.mkdir()
    with tarfile.open(archive) as tar: tar.extractall(unpack,filter='data')
    clean=unpack/'halo-butterfly-next'
    subprocess.run(['bun','install','--frozen-lockfile','--ignore-scripts'],cwd=clean,check=True)
    subprocess.run(['bun','run','build'],cwd=clean,check=True)
    if digest(clean/package)!=digest(package): raise ValueError('Corresponding source does not reproduce theme ZIP')
    record={'schema':1,'tag':tag,'sourceSha':source,'themeSha256':digest(package),'sourceArchiveSha256':digest(archive),'acceptance':evidence}
    (out/'release-validation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
    (out/'SHA256SUMS').write_text(''.join(digest(p)+'  '+p.name+'\n' for p in sorted(out.iterdir())))
if __name__=='__main__': main()
