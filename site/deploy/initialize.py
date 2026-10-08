#!/usr/bin/env python3
"""One-time import of a checksummed public source bundle into the owned hk stack.
Run on hk only. Credentials are generated there; no local site backup is used.
"""
import copy
import fcntl
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path('/root/docker/app/halo-butterfly-next')
BUNDLE = ROOT / 'operations/public'
sys.path.insert(0, str(ROOT / 'operations/source/site/tools'))
from runtime import ApiError, Client, read_json, write_json

RESOURCE = '/apis/content.halo.run/v1alpha1/'
CONSOLE = '/apis/api.console.halo.run/v1alpha1/'
OWNER = 'site.halo-butterfly-next/owner'
THEME = 'halo-butterfly-next'

class Deployment:
    root = ROOT / 'operations'
    base = 'http://127.0.0.1:18142'

    def check(self):
        expected = {'project': THEME, 'host': 'hk', 'domain': 'butterfly.baizhukui.com', 'created': '2026-10-05'}
        if read_json(ROOT / 'deployment-owner.json') != expected or ROOT.resolve() != ROOT:
            raise RuntimeError('Deployment ownership mismatch')
        value = json.loads(subprocess.check_output(['docker', 'inspect', THEME]))[0]
        if value['Config']['Labels'].get('com.docker.compose.project') != THEME:
            raise RuntimeError('Unexpected Compose owner')
        if value['Config']['Image'] != 'docker-mirror.infra.baizhukui.com/halohub/halo:2.26.1@sha256:bfe89bf70c44ea94a7dd33f8ec98e8e59088adfb7a9fb7b6f013f82391c33bee':
            raise RuntimeError('Unexpected Halo image')
        if not any(x['Source'] == str(ROOT / 'halo2') and x['Destination'] == '/root/.halo2' for x in value['Mounts']):
            raise RuntimeError('Unexpected data mount')
        if value['NetworkSettings']['Ports'].get('8090/tcp') != [{'HostIp': '127.0.0.1', 'HostPort': '18142'}]:
            raise RuntimeError('Unexpected port binding')
        if not value['State']['Running']:
            raise RuntimeError('Halo is not running')
        return value['State']['Pid']

    def owned_pid(self):
        return self.check()


def merge(base, patch):
    out = copy.deepcopy(base)
    for key, value in patch.items():
        out[key] = merge(out.get(key, {}), value) if isinstance(value, dict) else value
    return out


def verify_content(obj, spec):
    if obj['metadata'].get('annotations', {}).get(OWNER) != 'halo-butterfly-next-docs-site':
        raise RuntimeError('Content ownership changed')
    if any(obj['spec'].get(k) != v for k, v in spec.items() if k != 'publish'):
        raise RuntimeError('Content fields differ from public bundle')


def set_plugin_enabled(client, name, enabled):
    path = '/apis/plugin.halo.run/v1alpha1/plugins/' + name
    original = client.api(path)
    expected = {k: v for k, v in original['spec'].items() if k != 'enabled'}
    for _ in range(30):
        current = client.api(path)
        if {k: v for k, v in current['spec'].items() if k != 'enabled'} != expected:
            raise RuntimeError('Plugin specification changed during initial setup')
        if current['spec'].get('enabled') == enabled:
            return
        current['spec']['enabled'] = enabled
        try:
            client.api(path, 'PUT', current)
            return
        except ApiError as error:
            if error.status != 409:
                raise
            time.sleep(.5)
    raise RuntimeError('Plugin reconciliation did not stabilize')


def import_public(runtime, bundle, data_root, public_url):
    # Reused by the isolated image runtime; the legacy hk adapter stays strict.
    BUNDLE = bundle
    runtime.check()
    checksums = read_json(BUNDLE / 'checksums.json')
    for name, expected in checksums.items():
        file = (BUNDLE / name).resolve()
        if not file.is_relative_to(BUNDLE) or hashlib.sha256(file.read_bytes()).hexdigest() != expected:
            raise RuntimeError('Public bundle checksum mismatch: ' + name)
    if (runtime.root / 'import-complete.json').exists():
        raise RuntimeError('Initial import already completed; use a separately reviewed update procedure')
    manifest = read_json(BUNDLE / 'manifest.json')
    profile = read_json(BUNDLE / 'theme-profile.json')
    assets = read_json(BUNDLE / 'sources.json')['assets']
    rendered = {x['id']: x['html'] for x in read_json(BUNDLE / 'rendered-public.json')['content']}
    mapping = read_json(BUNDLE / 'permalinks.json')
    started = runtime.root / 'import-started.json'
    if started.exists() and read_json(started) != {'checksums': checksums}:
        raise RuntimeError('Interrupted import bundle changed')
    client = Client(runtime, initialize=not started.exists())
    if not started.exists() and not client.initialized_now:
        raise RuntimeError('Import requires a freshly initialized instance; do not adopt existing data')
    write_json(started, {'checksums': checksums})
    if client.initialized_now:
        for post in client.api(RESOURCE + 'posts?size=100')['items']:
            if post['spec'].get('publish'):
                client.api(CONSOLE + 'posts/' + post['metadata']['name'] + '/unpublish', 'PUT')
        for plugin in client.api('/apis/plugin.halo.run/v1alpha1/plugins?size=100')['items']:
            if plugin['spec'].get('enabled'):
                set_plugin_enabled(client, plugin['metadata']['name'], False)
        write_json(runtime.root / 'initial-prepared.json', {'freshDefaultsPrepared': True})
    elif not (runtime.root / 'initial-prepared.json').exists():
        raise RuntimeError('Interrupted initial preparation requires manual inspection; no global cleanup on resume')
    client.install(BUNDLE / ('halo-butterfly-next-' + manifest['baseline']['themeVersion'] + '.zip'))
    urls = {}
    target = data_root / 'attachments/site-assets'
    target.mkdir(parents=True, exist_ok=True)
    for asset in assets:
        filename = asset['id'] + '-' + asset['sha256'][:16] + '.webp'
        src = BUNDLE / asset['file']
        if hashlib.sha256(src.read_bytes()).hexdigest() != asset['sha256']:
            raise RuntimeError('Asset checksum mismatch')
        destination = target / filename
        if destination.exists():
            if hashlib.sha256(destination.read_bytes()).hexdigest() != asset['sha256']:
                raise RuntimeError('Existing asset differs from public bundle')
        else:
            with destination.open('xb') as stream:
                stream.write(src.read_bytes())
        urls[asset['id']] = '/site-assets/' + filename
    def create(path, kind, name, spec):
        existing = client.maybe(path + '/' + name)
        if existing:
            if existing['metadata'].get('annotations', {}).get(OWNER) != 'halo-butterfly-next-docs-site' or any(existing['spec'].get(k) != v for k, v in spec.items()):
                raise RuntimeError('Existing resource differs from public bundle: ' + name)
            return existing
        return client.api(path, 'POST', {'apiVersion': 'content.halo.run/v1alpha1' if path.startswith(RESOURCE) else 'v1alpha1',
            'kind': kind, 'metadata': {'name': name, 'annotations': {OWNER: 'halo-butterfly-next-docs-site'}}, 'spec': spec})
    for plural, kind in [('categories', 'Category'), ('tags', 'Tag')]:
        for item in manifest[plural]:
            create(RESOURCE + plural, kind, item['resourceName'], dict(displayName=item['name'], slug=item['slug'], **({'priority': 0} if plural == 'categories' else {})))
    for item in manifest['content']:
        plural, key = ('posts', 'post') if item['kind'] == 'Post' else ('singlepages', 'page')
        spec = {'title': item['title'], 'slug': item['slug'], 'cover': urls[item['coverAsset']], 'publish': False,
            'deleted': False, 'visible': 'PUBLIC', 'owner': client.auth['username'], 'allowComment': False,
            'pinned': item['pinned'], 'priority': 100 - item['pinOrder'] if item['pinned'] else 0,
            'excerpt': {'autoGenerate': False, 'raw': item['excerpt']}}
        if key == 'post':
            spec.update(categories=[x['resourceName'] for x in manifest['categories'] if x['id'] in item['categories']],
                        tags=[x['resourceName'] for x in manifest['tags'] if x['id'] in item['tags']])
        value = {'apiVersion': 'content.halo.run/v1alpha1', 'kind': item['kind'],
                 'metadata': {'name': item['id'], 'annotations': {OWNER: 'halo-butterfly-next-docs-site'}}, 'spec': spec}
        existing = client.maybe(RESOURCE + plural + '/' + item['id'])
        if existing:
            verify_content(existing, spec)
        else:
            client.api(CONSOLE + plural, 'POST', {key: value, 'content': {'raw': rendered[item['id']], 'content': rendered[item['id']], 'rawType': 'HTML'}})
        for _ in range(30):
            obj = client.api(RESOURCE + plural + '/' + item['id'])
            permalink = obj.get('status', {}).get('permalink')
            if permalink:
                if urlparse(permalink).path != mapping[item['id']]:
                    raise RuntimeError('Actual permalink differs from compiled links')
                break
            time.sleep(.2)
        else:
            raise RuntimeError('Permalink reconciliation timed out')
        snapshot = obj['spec'].get('headSnapshot') or obj['spec']['baseSnapshot']
        # Only tolerate initial controller metadata reconciliation. Never follow
        # a new snapshot or changed body when retrying a checked resource PUT.
        for _ in range(10):
            obj = client.api(RESOURCE + plural + '/' + item['id'])
            verify_content(obj, spec)
            if (obj['spec'].get('headSnapshot') or obj['spec']['baseSnapshot']) != snapshot:
                raise RuntimeError('Snapshot changed during initial publication')
            head = client.api(CONSOLE + plural + '/' + item['id'] + '/head-content')
            if head['content'] != rendered[item['id']] or head.get('snapshotName') != snapshot:
                raise RuntimeError('Draft readback mismatch')
            obj['spec'].update(publish=True, headSnapshot=snapshot, releaseSnapshot=snapshot)
            try:
                client.api(RESOURCE + plural + '/' + item['id'], 'PUT', obj)
                break
            except ApiError as error:
                if error.status != 409:
                    raise
                time.sleep(.2)
        else:
            raise RuntimeError('Initial publication did not stabilize')
    def url(target):
        if target['type'] == 'asset': return urls[target['key']]
        if target['type'] == 'content': return mapping[target['key']]
        if target['type'] == 'route': return manifest['routes'][target['key']]
        if target['type'] == 'publication': return manifest['publication'][target['key']]
        raise RuntimeError('Unsupported public navigation target')
    menu_ids = []
    for index, item in enumerate(x for x in manifest['navigation'] if x['enabled']):
        name = 'hbn-site-menu-' + item['target']['type'] + '-' + item['target']['key']
        create('/api/v1alpha1/menuitems', 'MenuItem', name, {'displayName': item['label'], 'href': url(item['target']), 'target': '_self', 'priority': index, 'menuName': 'hbn-site-menu'})
        menu_ids.append(name)
    create('/api/v1alpha1/menus', 'Menu', 'hbn-site-menu', {'displayName': '文档演示站导航', 'menuItems': menu_ids})
    patch = copy.deepcopy(profile['settings'])
    for binding in profile['bindings']:
        group, key = binding['path'].split('.')
        if binding['target']['type'] == 'manifest':
            value = [{'title': x['label'], 'url': url(x['target'])} for x in manifest['footer'] if x['enabled']]
        elif binding['path'] == 'aside.button': value = {'name': binding['label'], 'link': url(binding['target'])}
        elif binding.get('operation') == 'append-link': value = patch[group][key] + ' <a href="' + url(binding['target']) + '">' + binding['label'] + '</a>'
        else: value = url(binding['target'])
        patch.setdefault(group, {})[key] = value
    theme_path = CONSOLE + 'themes/' + THEME + '/json-config'
    client.api(theme_path, 'PUT', merge(client.api(theme_path), patch))
    system = client.api('/api/v1alpha1/configmaps/system')
    for group, patch in {'basic': {'title': manifest['title'], 'subtitle': ''}, 'seo': {'description': manifest['description']}, 'menu': {'primary': 'hbn-site-menu'}, 'post': {'pageSize': 10}}.items():
        system['data'][group] = json.dumps(merge(json.loads(system['data'].get(group, '{}')), patch), ensure_ascii=False)
    client.api('/api/v1alpha1/configmaps/system', 'PUT', system)
    # Halo first-setup installs its bundled 1.7.1 even when a newer JAR is staged.
    # Upgrade through the supported API before enabling the pinned official artifact.
    jar = data_root / 'plugins/PluginSearchWidget-1.8.0.jar'
    expected_search_sha = '4ada3473c55a1428134f0373fc7069cb6a906ae44582fd5e7319687f7d27cc2d'
    if hashlib.sha256(jar.read_bytes()).hexdigest() != expected_search_sha:
        raise RuntimeError('Staged search plugin does not match verified artifact')
    search_path = '/apis/plugin.halo.run/v1alpha1/plugins/PluginSearchWidget'
    search = client.api(search_path)
    if search['spec']['version'] != '1.8.0':
        set_plugin_enabled(client, 'PluginSearchWidget', False)
        for _ in range(60):
            if client.api(search_path).get('status', {}).get('phase') == 'DISABLED':
                break
            time.sleep(.5)
        else:
            raise RuntimeError('Bundled search plugin did not stop')
        boundary = 'demo-search-upgrade'
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{jar.name}"\r\nContent-Type: application/java-archive\r\n\r\n'.encode()
                + jar.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
        client.api(CONSOLE + 'plugins/PluginSearchWidget/upgrade', 'POST', body, 'multipart/form-data; boundary=' + boundary)
    search = client.api(search_path)
    if search['spec']['version'] != '1.8.0' or hashlib.sha256(jar.read_bytes()).hexdigest() != expected_search_sha:
        raise RuntimeError('Search plugin does not match verified artifact')
    set_plugin_enabled(client, 'PluginSearchWidget', True)
    for _ in range(60):
        state = client.api('/apis/plugin.halo.run/v1alpha1/plugins/PluginSearchWidget')
        if state.get('status', {}).get('phase') == 'STARTED':
            break
        time.sleep(1)
    else:
        raise RuntimeError('Search plugin did not start')
    for item in manifest['content']:
        plural = 'posts' if item['kind'] == 'Post' else 'singlepages'
        actual = client.api(RESOURCE + plural + '/' + item['id'])
        released = client.api(CONSOLE + plural + '/' + item['id'] + '/release-content')
        if not actual['spec']['publish'] or released['content'] != rendered[item['id']]:
            raise RuntimeError('Published content readback mismatch: ' + item['id'])
    write_json(runtime.root / 'import-complete.json', {'content': len(manifest['content']), 'assets': len(assets), 'source': checksums, 'publicUrl': public_url})
    print('Imported public content, photos, theme and search; credentials remain in the instance data directory')

def main():
    import_public(Deployment(), BUNDLE, ROOT / 'halo2', 'https://butterfly.baizhukui.com')

if __name__ == '__main__':
    with (ROOT / 'operations/import.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        main()
