#!/usr/bin/env python3
"""Prepare a strictly allowlisted Docker context. No runtime data or credentials."""
import hashlib, json, shutil, sys, urllib.request
from pathlib import Path
bundle, target = map(Path, sys.argv[1:])
target.mkdir(mode=0o700)
for name in ['site/demo/entrypoint.py', 'site/deploy/initialize.py', 'site/tools/runtime.py', 'fixtures/comparison/versions.json']:
    dest=target/'source'/name
    dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(name,dest)
shutil.copytree(bundle,target/'bundle')
shutil.copyfile('site/demo/Dockerfile',target/'Dockerfile')
plugin=json.loads(Path('fixtures/search-comment/versions.json').read_text())['plugins'][0]
with urllib.request.urlopen(plugin['url'],timeout=90) as response:
    data=response.read()
if hashlib.sha256(data).hexdigest()!=plugin['sha256']:
    raise RuntimeError('Search plugin checksum mismatch')
(target/'search.jar').write_bytes(data)
