#!/usr/bin/env python3
"""Create gallery fixtures only on this project's owned loopback Halo lab."""
import argparse, importlib.util, json, os, shutil, subprocess, time, zipfile, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--runtime', required=True, type=Path)
p.add_argument('--data-base', required=True)
p.add_argument('--package', required=True, type=Path)
p.add_argument('--source-sha', required=True)
a = p.parse_args()
runtime = a.runtime.resolve()
identity = json.loads((runtime/'lab.json').read_text())
if identity.get('owner') != 'halo-butterfly-next-comparison' or identity.get('schema') != 1:
    raise RuntimeError('Only an owned comparison lab is allowed')
from urllib.parse import urlparse
data_url = urlparse(a.data_base)
if data_url.scheme != 'http' or data_url.hostname != '127.0.0.1' or not data_url.port or data_url.port < 1024 or data_url.username or data_url.path or data_url.query or data_url.fragment:
    raise RuntimeError('Gallery data fixtures require an explicit loopback origin')
os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(identity['ports']['halo']), HEXO_PORT=str(identity['ports']['hexo']))
spec = importlib.util.spec_from_file_location('gallery_lab', ROOT/'scripts/lab/lab.py')
lab = importlib.util.module_from_spec(spec); spec.loader.exec_module(lab)
shutil.copytree(ROOT/'fixtures/comparison/assets', runtime/'halo/data/attachments/lab', dirs_exist_ok=True)
lab.start(halo_only=True)
client = lab.Client(initialize=True)
if client.initialized_now: lab.capture_initial_content(client)
lab.install(client, str(a.package), a.source_sha)
# Compare every ZIP entry with Halo's extracted files, beyond API attribution.
installed = runtime/'halo/data/themes/halo-butterfly-next'
with zipfile.ZipFile(a.package) as archive:
    files = [name for name in archive.namelist() if not name.endswith('/')]
    for name in files:
        if hashlib.sha256(archive.read(name)).digest() != hashlib.sha256((installed/name).read_bytes()).digest():
            raise RuntimeError('Installed theme differs from package: '+name)
lab.write_json(runtime/'gallery-installed-files.json', {'sourceSha':a.source_sha,'artifactSha256':lab.digest(a.package),'files':len(files),'result':'passed'})
if not (runtime/'seed.json').exists(): lab.seed(client, reference=False)
body = subprocess.check_output(['bun', '-e', 'import {galleryBody} from "./fixtures/gallery/content.mjs"; process.stdout.write(galleryBody(process.argv[1]));', a.data_base], cwd=ROOT, text=True)
routes = {}
for plural, kind, key in [('posts','Post','post'), ('singlepages','SinglePage','page')]:
    name = 'article-gallery-' + key
    api = '/apis/content.halo.run/v1alpha1/' + plural + '/' + name
    console = '/apis/api.console.halo.run/v1alpha1/' + plural
    try:
        existing = client.api(api)
        content = client.api(console+'/'+name+'/release-content')
        if content.get('content') != body:
            raise RuntimeError('Existing gallery fixture differs; use a fresh isolated runtime')
    except lab.ApiError as error:
        if error.status != 404: raise
        existing = client.api(console, 'POST', {
            key: {'apiVersion':'content.halo.run/v1alpha1','kind':kind,
                  'metadata':{'name':name,'labels':{'article-gallery-fixture':'true'}},
                  'spec':{'title':'正文图库合成 '+kind,'slug':name,'owner':client.auth['username'],
                          'allowComment':False,'deleted':False,'publish':False,'visible':'PUBLIC',
                          'pinned':False,'priority':0,'excerpt':{'autoGenerate':True},
                          'cover':'/lab/home.svg','tags':[],'categories':[]}},
            'content':{'content':body,'raw':body,'rawType':'HTML'}})
    if not existing.get('spec',{}).get('publish'): client.api(console+'/'+name+'/publish','PUT')
    for _ in range(30):
        resource = client.api(api)
        permalink = resource.get('status',{}).get('permalink')
        if permalink: break
        time.sleep(1)
    else: raise RuntimeError('Fixture permalink unavailable')
    routes[key if key=='post' else 'single'] = permalink
lab.write_json(runtime/'gallery-fixture.json', {'owner':'halo-butterfly-next-gallery','base':lab.BASE['halo'],
               'runtime':str(runtime),'dataBase':a.data_base,'routes':routes})
print('Gallery fixtures created; synthetic content retained for repeat runs.')
