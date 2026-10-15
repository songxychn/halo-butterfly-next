#!/usr/bin/env python3
"""Own, restore and remove only the local native-image acceptance fixture."""
import argparse
import copy
import hashlib
import html
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.parse

REPO = Path(__file__).resolve().parents[2]
CONFIG = '/apis/api.console.halo.run/v1alpha1/themes/halo-butterfly-next/json-config'
POSTS = '/apis/content.halo.run/v1alpha1/posts'
CONSOLE = '/apis/api.console.halo.run/v1alpha1/posts'
PROFILES = {'native-site': {'enable': True, 'native': True, 'field': 'site', 'blur': False},
            'native-post': {'enable': True, 'native': True, 'field': 'post', 'blur': True},
            'disabled': {'enable': False, 'native': True, 'field': 'site', 'blur': False}}


def require(value, message):
    if not value:
        raise RuntimeError(message)


def output(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--run-id', required=True)
    parser.add_argument('--allow-synthetic-writes', choices=['yes'], required=True)
    args = parser.parse_args()
    require(re.fullmatch('[a-f0-9]{40}', args.source_sha), 'Exact source SHA required')
    require(re.fullmatch('[a-f0-9]{16}', args.run_id), 'Unique hex run ID required')
    runtime = args.runtime.resolve()
    require(runtime.is_relative_to(REPO / '.runtime'), 'Only this worktree runtime is allowed')
    marker = json.loads((runtime / 'lab.json').read_text())
    require(marker.get('owner') == 'halo-butterfly-next-comparison' and marker.get('schema') == 1, 'Lab owner mismatch')
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(marker['ports']['halo']), HEXO_PORT=str(marker['ports']['hexo']))
    spec = importlib.util.spec_from_file_location('native_images_lab', REPO / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(spec); spec.loader.exec_module(lab)
    require(lab.owned_process('halo') and (runtime / 'seed.json').exists(), 'Owned seeded Halo process required')
    require(lab.digest(runtime / 'halo/halo-2.26.1.jar') == lab.VERSIONS['halo']['sha256'], 'Halo digest mismatch')
    installed = json.loads((runtime / 'installed-package.json').read_text())
    require(installed.get('sourceCommit') == args.source_sha, 'Installed source mismatch')
    package = REPO / 'dist' / installed['name']
    require(package.resolve().parent == (REPO / 'dist').resolve() and lab.digest(package) == installed['sha256'], 'Installed package digest mismatch')
    installed_record_sha = lab.digest(runtime / 'installed-package.json')
    client = lab.Client()

    def active_theme():
        active = client.api('/apis/api.console.halo.run/v1alpha1/themes/-/activation')
        require(active.get('metadata', {}).get('name') == lab.THEME, 'Candidate theme is not active')
        require(active.get('spec', {}).get('version') == installed.get('version'), 'Active theme version differs from candidate')
        require(not active.get('metadata', {}).get('deletionTimestamp'), 'Active theme is being deleted')
        return {'name': active['metadata']['name'], 'version': active['spec']['version'], 'uid': active['metadata'].get('uid')}

    active = active_theme()
    original = client.api(CONFIG)
    names = {letter: 'native-images-' + args.run_id + '-' + letter for letter in ['a', 'b']}
    snapshot = runtime / ('native-images-' + args.run_id + '.private.json')
    lab.write_json(snapshot, {'owner': 'native-images', 'runId': args.run_id, 'config': original, 'names': names}, private=True)
    made = []
    fixture = (REPO / 'fixtures/images/native-content.html').read_text()

    def owned(name):
        post = client.api(POSTS + '/' + name)
        require(post['metadata'].get('labels', {}).get('native-images-owner') == args.run_id, 'Fixture owner mismatch')
        return post

    stage = 'create-fixture'
    last_observed = None
    try:
        require(active_theme() == active, 'Active theme changed before fixture writes')
        routes = {}
        for letter, name in names.items():
            content = fixture.replace('__RUN__', args.run_id).replace('__PAGE__', letter).replace('__NEXT_URL__', '#')
            obj = {'apiVersion': 'content.halo.run/v1alpha1', 'kind': 'Post',
                   'metadata': {'name': name, 'labels': {'native-images-owner': args.run_id}},
                   'spec': {'title': 'Native image fixture ' + letter, 'slug': name, 'owner': client.auth['username'], 'allowComment': False,
                            'deleted': False, 'visible': 'PUBLIC', 'publish': False, 'pinned': False, 'priority': 0,
                            'cover': '/lab/cover-autumn-forest.webp?native-cover=' + args.run_id + '-' + letter,
                            'publishTime': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'tags': [], 'categories': [], 'excerpt': {'autoGenerate': True}}}
            client.api(CONSOLE, 'POST', {'post': obj, 'content': {'rawType': 'HTML', 'raw': content, 'content': content}})
            made.append(name)
            stage = 'publish-' + name
            client.api(CONSOLE + '/' + name + '/publish', 'PUT')
            for _ in range(40):
                post = owned(name)
                last_observed = {'name': name, 'spec': {key: post.get('spec', {}).get(key) for key in ['publish', 'publishTime', 'visible']},
                                 'status': {key: post.get('status', {}).get(key) for key in ['phase', 'permalink']},
                                 'publishLabels': {key: value for key, value in post.get('metadata', {}).get('labels', {}).items() if 'publish' in key.lower()}}
                if post.get('spec', {}).get('publish') is True and post.get('status', {}).get('permalink'):
                    routes[letter] = post['status']['permalink']; break
                time.sleep(.25)
            else:
                raise RuntimeError('Fixture not published: ' + json.dumps(last_observed, ensure_ascii=False))
        stage = 'publish-real-permalinks'
        # Halo owns permalink formatting; publish links only after both actual URLs are known.
        for letter, name in names.items():
            target = routes['b' if letter == 'a' else 'a']
            resolved = urllib.parse.urlparse(urllib.parse.urljoin(lab.BASE['halo'], target))
            origin = urllib.parse.urlparse(lab.BASE['halo'])
            require((resolved.scheme, resolved.netloc) == (origin.scheme, origin.netloc), 'Fixture permalink escaped loopback origin')
            content = fixture.replace('__RUN__', args.run_id).replace('__PAGE__', letter).replace('__NEXT_URL__', html.escape(target, quote=True))
            client.api(CONSOLE + '/' + name + '/content', 'PUT', {'rawType': 'HTML', 'raw': content, 'content': content})
            client.api(CONSOLE + '/' + name + '/publish', 'PUT')
        output({'event': 'ready', 'routes': routes, 'names': names, 'runId': args.run_id, 'fixtureSha256': hashlib.sha256(fixture.encode()).hexdigest(), 'installed': installed, 'activeTheme': active, 'installedRecordSha256': installed_record_sha})
        stage = 'configure-profile'
        for line in sys.stdin:
            command = line.strip()
            if command == 'restore':
                break
            require(command in PROFILES, 'Unknown image profile')
            config = copy.deepcopy(original)
            config['lazyload'] = copy.deepcopy(PROFILES[command])
            config['pjax'] = {'enable': True, 'exclude': ''}
            config.setdefault('loading', {}).update({'enable': False, 'instantpage': False})
            config.setdefault('comments', {})['lazyload'] = True
            config.setdefault('post', {})['enable_above'] = True
            config.setdefault('image', {})['disable_top_img'] = False
            client.api(CONFIG, 'PUT', config)
            require(client.api(CONFIG) == config, 'Configuration readback mismatch')
            output({'event': 'configured', 'profile': command})
    except Exception as error:
        output({'event': 'error', 'stage': stage, 'errorType': type(error).__name__, 'message': str(error)[:2000], 'lastObserved': last_observed})
        raise
    finally:
        errors = []
        for name in reversed(made):
            try:
                owned(name); client.api(POSTS + '/' + name, 'DELETE')
                for _ in range(80):
                    try:
                        owned(name)
                    except lab.ApiError as error:
                        if error.status != 404:
                            raise
                        break
                    time.sleep(.25)
                else:
                    raise RuntimeError('Fixture delete not reconciled')
            except Exception as error:
                errors.append(name + ': ' + str(error))
        try:
            client.api(CONFIG, 'PUT', original)
            require(client.api(CONFIG) == original, 'Original theme configuration not restored')
            require(active_theme() == active, 'Active theme changed during acceptance')
            require(lab.digest(runtime / 'installed-package.json') == installed_record_sha, 'Installed package record changed during acceptance')
        except Exception as error:
            errors.append('configuration: ' + str(error))
        result = {'event': 'restored', 'result': 'failed' if errors else 'passed', 'errors': errors, 'runId': args.run_id, 'snapshot': snapshot.name}
        lab.write_json(runtime / ('native-images-restoration-' + args.run_id + '.json'), result)
        output(result)
        if errors:
            raise RuntimeError('Restoration requires attention')


if __name__ == '__main__':
    main()
