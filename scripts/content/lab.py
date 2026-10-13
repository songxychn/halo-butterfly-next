#!/usr/bin/env python3
"""Owned Halo-only portable-content lab; uses the locked comparison API and JAR."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import sys
import time

REPO = Path(__file__).resolve().parents[2]
os.environ.setdefault('LAB_RUNTIME', str(REPO / '.runtime/content/halo-lab'))
os.environ.setdefault('HALO_PORT', '18531')
os.environ.setdefault('HEXO_PORT', '14531')
spec = importlib.util.spec_from_file_location('comparison_lab', REPO / 'scripts/lab/lab.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)


def start():
    marker = {'schema': 1, 'ports': lab.PORTS, 'owner': 'halo-butterfly-next-comparison'}
    runtime = lab.RUNTIME
    if (runtime / 'lab.json').exists():
        if json.loads((runtime / 'lab.json').read_text()) != marker:
            raise RuntimeError('Content lab ownership/ports differ')
    else:
        if runtime.exists() and any(runtime.iterdir()):
            raise RuntimeError('Refusing to claim a nonempty runtime')
        source = Path(os.environ['HALO_JAR_SOURCE']).resolve()
        if lab.digest(source) != lab.VERSIONS['halo']['sha256']:
            raise RuntimeError('Halo JAR differs from the pinned official digest')
        lab.write_json(runtime / 'lab.json', marker)
        (runtime / 'halo').mkdir()
        shutil.copyfile(source, runtime / 'halo/halo-2.26.1.jar')
        shutil.copytree(lab.FIXTURES / 'assets', runtime / 'halo/data/attachments/lab')
    lab.start(halo_only=True)


def seed_content(client):
    markup = (REPO / 'fixtures/content-extensions/article.html').read_text()
    for plural, kind, key, name in [('posts', 'Post', 'post', 'portable-content'), ('singlepages', 'SinglePage', 'page', 'portable-content-page')]:
        console = '/apis/api.console.halo.run/v1alpha1/' + plural
        spec = {'title': '可移植正文扩展', 'slug': name, 'allowComment': False, 'deleted': False, 'pinned': False, 'priority': 0, 'publish': False, 'visible': 'PUBLIC', 'owner': client.auth['username'], 'excerpt': {'autoGenerate': True}, 'cover': '', 'publishTime': '2026-10-13T12:00:00Z'}
        if plural == 'posts':
            spec.update({'tags': [], 'categories': []})
        client.api(console, 'POST', {key: {'apiVersion': 'content.halo.run/v1alpha1', 'kind': kind, 'metadata': {'name': name}, 'spec': spec}, 'content': {'content': markup, 'raw': markup, 'rawType': 'HTML'}})
        client.api(console + '/' + name + '/publish', 'PUT')
    lab.write_json(lab.RUNTIME / 'content-fixture.json', {'sha256': lab.digest(REPO / 'fixtures/content-extensions/article.html'), 'input': 'HTML through authenticated Halo content API; no GUI editor roundtrip', 'routes': ['/archives/portable-content/', '/portable-content-page/']})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['start', 'bootstrap', 'install', 'stop'])
    parser.add_argument('--package', type=Path)
    parser.add_argument('--source-sha')
    args = parser.parse_args()
    if args.command in ['bootstrap', 'install'] and (not args.package or not args.source_sha):
        parser.error('--package and --source-sha are required')
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
    elif args.command == 'start':
        start()
    elif args.command == 'install':
        lab.install(lab.Client(), args.package, args.source_sha)
    else:
        start()
        if (lab.RUNTIME / 'seed.json').exists():
            raise RuntimeError('Bootstrap preserves existing content; use install for package updates')
        client = lab.Client(initialize=True)
        lab.install(client, args.package, args.source_sha)
        lab.capture_initial_content(client)
        lab.seed(client, reference=False)
        seed_content(client)
        print('Portable content lab ready:', lab.BASE['halo'], flush=True)


if __name__ == '__main__':
    try:
        main()
    except (lab.ApiError, RuntimeError, OSError, KeyError) as error:
        print('Content lab error:', error, file=sys.stderr)
        sys.exit(1)
