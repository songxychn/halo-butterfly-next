#!/usr/bin/env python3
"""Owned loopback KaTeX fixture lab; reuses the comparison lab's authenticated API."""
import argparse
import importlib.util
import signal
import html
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import time
import zipfile

REPO = Path(__file__).resolve().parents[2]
os.environ.setdefault('LAB_RUNTIME', str(REPO / '.runtime/math/halo-lab'))
os.environ.setdefault('HALO_PORT', '18400')
os.environ.setdefault('HEXO_PORT', '14400')
spec = importlib.util.spec_from_file_location('comparison_lab', REPO / 'scripts/lab/lab.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)

LOCK = json.loads((REPO / 'fixtures/math/versions.json').read_text())


def plugin_state(client, enabled):
    path = '/apis/plugin.halo.run/v1alpha1/plugins/' + LOCK['plugin']
    for attempt in range(8):
        plugin = client.api(path)
        plugin['spec']['enabled'] = enabled
        try:
            client.api(path, 'PUT', plugin)
            time.sleep(2)
            return
        except lab.ApiError as error:
            if error.status != 409 or attempt == 7:
                raise
            time.sleep(.25)


def bootstrap(package, source_sha, plugin):
    jar_source = Path(os.environ['HALO_JAR_SOURCE']).resolve()
    if lab.digest(jar_source) != lab.VERSIONS['halo']['sha256']:
        raise RuntimeError('Halo JAR digest differs from comparison lock')
    if lab.digest(plugin) != LOCK['sha256']:
        raise RuntimeError('Plugin JAR digest differs from math lock')
    marker = {'schema': 1, 'ports': lab.PORTS, 'owner': 'halo-butterfly-next-comparison'}
    runtime = lab.RUNTIME
    if runtime.exists() and any(runtime.iterdir()):
        raise RuntimeError('Bootstrap requires an empty fresh runtime; use install for updates')
    lab.write_json(runtime / 'lab.json', marker)
    (runtime / 'halo').mkdir(exist_ok=True)
    shutil.copyfile(jar_source, runtime / 'halo' / lab.HALO_JAR_NAME)
    shutil.copytree(lab.FIXTURES / 'assets', runtime / 'halo/data/attachments/lab')
    lab.start(halo_only=True)
    client = lab.Client(initialize=True)
    lab.install(client, package, source_sha)
    lab.capture_initial_content(client)
    lab.seed(client, reference=False)
    seed_math(client, plugin)


def seed_math(client, plugin):
    runtime = lab.RUNTIME
    # Test-fixture generation uses the plugin's own locked renderer, never a theme dependency.
    renderer = runtime / 'katex.cjs'
    with zipfile.ZipFile(plugin) as archive:
        renderer.write_bytes(archive.read('static/katex.min.js'))
    generator = """const k=require(process.argv[1]); const f=JSON.parse(await Bun.file(process.argv[2]).text());
if(k.version!==process.argv[3]) throw new Error('KaTeX version mismatch');
console.log(JSON.stringify(f.map(x=>({...x,html:k.renderToString(x.tex,{output:'mathml',displayMode:!x.inline,throwOnError:false,strict:false,maxSize:300})}))));"""
    fixtures = json.loads(subprocess.check_output(['bun', '-e', generator, str(renderer), str(REPO / 'fixtures/math/content.json'), LOCK['katex']], text=True))
    markup = '<h2 id="math-fixtures">数学公式 / KaTeX</h2><p>中文混排，价格 $5 与普通 prose 不应被扫描。</p>'
    for item in fixtures:
        tag, cls = ('span', 'katex-inline') if item.get('inline') else ('div', 'katex-block')
        markup += '<p>' + html.escape(item['id']) + '</p>' + f'<{tag} id="math-{item["id"]}" class="{cls}">{item["html"]}</{tag}>'
    markup += '<pre><code>$x$ &lt;span class="math-inline"&gt;example&lt;/span&gt;</code></pre>'
    for plural, kind, key, name, override in [
        ('posts', 'Post', 'post', 'math-inherit', 'inherit'),
        ('posts', 'Post', 'post', 'math-off', 'false'),
        ('posts', 'Post', 'post', 'math-on', 'true'),
        ('singlepages', 'SinglePage', 'page', 'math-page', 'inherit'),
        ('singlepages', 'SinglePage', 'page', 'math-page-off', 'false'),
        ('singlepages', 'SinglePage', 'page', 'math-page-on', 'true')]:
        spec = {'title': 'KaTeX ' + name, 'slug': name, 'allowComment': False, 'deleted': False, 'pinned': False, 'priority': 0, 'publish': False, 'visible': 'PUBLIC', 'owner': client.auth['username'], 'excerpt': {'autoGenerate': True}, 'cover': '', 'publishTime': '2026-10-11T04:00:00Z'}
        if plural == 'posts':
            spec.update({'tags': [], 'categories': []})
        console = '/apis/api.console.halo.run/v1alpha1/' + plural
        client.api(console, 'POST', {key: {'apiVersion': 'content.halo.run/v1alpha1', 'kind': kind, 'metadata': {'name': name, 'annotations': {'katex': override}}, 'spec': spec}, 'content': {'content': markup, 'raw': markup, 'rawType': 'HTML'}})
        client.api(console + '/' + name + '/publish', 'PUT')
    boundary = 'math-' + secrets.token_hex(12)
    data = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="plugin.jar"\r\nContent-Type: application/java-archive\r\n\r\n'.encode() + plugin.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
    result = client.api('/apis/api.console.halo.run/v1alpha1/plugins/install', 'POST', data, 'multipart/form-data; boundary=' + boundary)
    if result['metadata']['name'] != LOCK['plugin'] or result['spec']['version'] != LOCK['version']:
        raise RuntimeError('Installed plugin identity mismatch')
    plugin_state(client, True)
    print('Math lab ready:', lab.BASE['halo'], flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['bootstrap', 'install', 'enable', 'disable', 'config-on', 'config-off', 'stop'])
    parser.add_argument('--package', type=Path)
    parser.add_argument('--source-sha')
    parser.add_argument('--plugin', type=Path)
    args = parser.parse_args()
    if args.command in ['bootstrap', 'install'] and (not args.package or not args.source_sha):
        parser.error('--package and --source-sha are required')
    if args.command == 'bootstrap' and (not args.plugin or not os.environ.get('HALO_JAR_SOURCE')):
        parser.error('--plugin and HALO_JAR_SOURCE are required; downloads must be locked separately')
    if args.command == 'stop':
        pid = lab.owned_process('halo')
        if pid:
            os.kill(pid, signal.SIGTERM)
            deadline = time.monotonic() + 45
            while time.monotonic() < deadline and lab.listening(lab.PORTS['halo']):
                time.sleep(.25)
            if lab.listening(lab.PORTS['halo']):
                raise RuntimeError('Owned Halo is still shutting down')
        elif lab.listening(lab.PORTS['halo']):
            raise RuntimeError('Refusing to stop an unowned listener')
        return
    if args.command == 'bootstrap':
        bootstrap(args.package, args.source_sha, args.plugin); return
    client = lab.Client()
    if args.command == 'install':
        lab.install(client, args.package, args.source_sha)
    elif args.command in ['enable', 'disable']:
        plugin_state(client, args.command == 'enable')
    else:
        path = f'/apis/api.console.halo.run/v1alpha1/themes/{lab.THEME}/json-config'
        config = client.api(path)
        config['math'] = {'enable': args.command == 'config-on', 'copy_tex': True, 'hide_scrollbar': False}
        client.api(path, 'PUT', config)


if __name__ == '__main__':
    main()
