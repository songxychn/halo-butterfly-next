#!/usr/bin/env python3
"""Export only the owned comparison lab's synthetic session for the browser run."""
import argparse
import importlib.util
import json
import os
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--lab-runtime', required=True, type=Path)
a = p.parse_args()
runtime = a.lab_runtime.resolve()
marker = json.loads((runtime / 'lab.json').read_text())
if marker.get('owner') != 'halo-butterfly-next-comparison' or marker.get('schema') != 1:
    raise RuntimeError('An owned comparison lab is required')
if not (runtime / 'seed.json').is_file():
    raise RuntimeError('Synthetic fixture seed is required')
os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(marker['ports']['halo']), HEXO_PORT=str(marker['ports']['hexo']))
spec = importlib.util.spec_from_file_location('lab', Path(__file__).resolve().parents[1] / 'lab/lab.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
c = lab.Client()
cookies = [{'name': x.name, 'value': x.value, 'domain': x.domain, 'path': x.path,
            'expires': x.expires or -1, 'httpOnly': x.has_nonstandard_attr('HttpOnly'),
            'secure': x.secure, 'sameSite': 'Lax'} for x in c.jar]
lab.write_json(runtime / 'plugin-auth.private.json', {'cookies': cookies, 'csrf': c.csrf}, private=True)
print('Saved owned synthetic lab session with mode 0600; do not publish it.')
