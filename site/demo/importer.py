#!/usr/bin/env python3
"""Import a demo bundle into a freshly initialized Halo instance."""
import copy
import hashlib
import json
import time
from pathlib import Path
from urllib.parse import urlparse

from runtime import ApiError, Client, read_json, write_json

RESOURCE = '/apis/content.halo.run/v1alpha1/'
CONSOLE = '/apis/api.console.halo.run/v1alpha1/'
OWNER = 'site.halo-butterfly-next/owner'
THEME = 'halo-butterfly-next'


def merge(base, patch):
    out = copy.deepcopy(base)
    for key, value in patch.items():
        out[key] = merge(out.get(key, {}), value) if isinstance(value, dict) else value
    return out


def set_plugin_enabled(client, name, enabled):
    path = '/apis/plugin.halo.run/v1alpha1/plugins/' + name
    for _ in range(30):
        current = client.api(path)
        if current['spec'].get('enabled') == enabled:
            return
        current['spec']['enabled'] = enabled
        try:
            client.api(path, 'PUT', current)
            return
        except ApiError as error:
            if error.status != 409:
                raise
            time.sleep(0.5)
    raise RuntimeError(f'Plugin state did not stabilize: {name}')


def import_public(runtime, bundle, data_root, public_url):
    runtime.check()
    checksums = read_json(bundle / 'checksums.json')
    for name, expected in checksums.items():
        file = (bundle / name).resolve()
        if not file.is_relative_to(bundle) or hashlib.sha256(file.read_bytes()).hexdigest() != expected:
            raise RuntimeError('Public bundle checksum mismatch: ' + name)
    if (runtime.root / 'import-complete.json').exists():
        return
    manifest = read_json(bundle / 'manifest.json')
    profile = read_json(bundle / 'theme-profile.json')
    assets = read_json(bundle / 'sources.json')['assets']
    rendered = {x['id']: x['html'] for x in read_json(bundle / 'rendered-public.json')['content']}
    mapping = read_json(bundle / 'permalinks.json')
    started = runtime.root / 'import-started.json'
    client = Client(runtime, initialize=not started.exists())
    write_json(started, {'checksums': checksums})
    if client.initialized_now:
        for post in client.api(RESOURCE + 'posts?size=100')['items']:
            if post['spec'].get('publish'):
                client.api(CONSOLE + 'posts/' + post['metadata']['name'] + '/unpublish', 'PUT')
        for plugin in client.api('/apis/plugin.halo.run/v1alpha1/plugins?size=100')['items']:
            if plugin['spec'].get('enabled'):
                set_plugin_enabled(client, plugin['metadata']['name'], False)
    client.install(bundle / f"halo-butterfly-next-{manifest['baseline']['themeVersion']}.zip")

    urls = {}
    target = data_root / 'attachments/site-assets'
    target.mkdir(parents=True, exist_ok=True)
    for asset in assets:
        filename = f"{asset['id']}-{asset['sha256'][:16]}.webp"
        src = bundle / asset['file']
        destination = target / filename
        if not destination.exists():
            destination.write_bytes(src.read_bytes())
        urls[asset['id']] = '/site-assets/' + filename

    def create(path, kind, name, spec):
        existing = client.maybe(path + '/' + name)
        if existing:
            return existing
        return client.api(path, 'POST', {
            'apiVersion': 'content.halo.run/v1alpha1' if path.startswith(RESOURCE) else 'v1alpha1',
            'kind': kind,
            'metadata': {'name': name, 'annotations': {OWNER: 'halo-butterfly-next-docs-site'}},
            'spec': spec,
        })

    for plural, kind in [('categories', 'Category'), ('tags', 'Tag')]:
        for item in manifest[plural]:
            spec = dict(displayName=item['name'], slug=item['slug'])
            if plural == 'categories':
                spec['priority'] = 0
            create(RESOURCE + plural, kind, item['resourceName'], spec)

    for item in manifest['content']:
        plural, key = ('posts', 'post') if item['kind'] == 'Post' else ('singlepages', 'page')
        spec = {
            'title': item['title'], 'slug': item['slug'], 'cover': urls[item['coverAsset']],
            'publish': False, 'deleted': False, 'visible': 'PUBLIC', 'owner': client.auth['username'],
            'allowComment': False, 'pinned': item['pinned'],
            'priority': 100 - item['pinOrder'] if item['pinned'] else 0,
            'excerpt': {'autoGenerate': False, 'raw': item['excerpt']},
        }
        if key == 'post':
            spec['categories'] = [x['resourceName'] for x in manifest['categories'] if x['id'] in item['categories']]
            spec['tags'] = [x['resourceName'] for x in manifest['tags'] if x['id'] in item['tags']]
        value = {
            'apiVersion': 'content.halo.run/v1alpha1', 'kind': item['kind'],
            'metadata': {'name': item['id'], 'annotations': {OWNER: 'halo-butterfly-next-docs-site'}},
            'spec': spec,
        }
        if not client.maybe(RESOURCE + plural + '/' + item['id']):
            client.api(CONSOLE + plural, 'POST', {key: value, 'content': {'raw': rendered[item['id']], 'content': rendered[item['id']], 'rawType': 'HTML'}})
        for _ in range(30):
            obj = client.api(RESOURCE + plural + '/' + item['id'])
            permalink = obj.get('status', {}).get('permalink')
            if permalink:
                if urlparse(permalink).path != mapping[item['id']]:
                    raise RuntimeError('Actual permalink differs from compiled links')
                break
            time.sleep(0.2)
        else:
            raise RuntimeError('Permalink reconciliation timed out')
        snapshot = obj['spec'].get('headSnapshot') or obj['spec']['baseSnapshot']
        for _ in range(10):
            obj = client.api(RESOURCE + plural + '/' + item['id'])
            obj['spec'].update(publish=True, headSnapshot=snapshot, releaseSnapshot=snapshot)
            try:
                client.api(RESOURCE + plural + '/' + item['id'], 'PUT', obj)
                break
            except ApiError as error:
                if error.status != 409:
                    raise
                time.sleep(0.2)
        else:
            raise RuntimeError('Initial publication did not stabilize')

    def resolve_url(t):
        if t['type'] == 'asset': return urls[t['key']]
        if t['type'] == 'content': return mapping[t['key']]
        if t['type'] == 'route': return manifest['routes'][t['key']]
        if t['type'] == 'publication': return manifest['publication'][t['key']]
        raise RuntimeError('Unsupported navigation target')

    menu_ids = []
    for index, item in enumerate(x for x in manifest['navigation'] if x['enabled']):
        name = f"hbn-site-menu-{item['target']['type']}-{item['target']['key']}"
        create('/api/v1alpha1/menuitems', 'MenuItem', name, {
            'displayName': item['label'], 'href': resolve_url(item['target']),
            'target': '_self', 'priority': index, 'menuName': 'hbn-site-menu',
        })
        menu_ids.append(name)
    create('/api/v1alpha1/menus', 'Menu', 'hbn-site-menu', {'displayName': '文档演示站导航', 'menuItems': menu_ids})

    patch = copy.deepcopy(profile['settings'])
    for binding in profile['bindings']:
        parts = binding['path'].split('.')
        target_url = resolve_url(binding['target'])
        if binding['target']['type'] == 'manifest':
            value = [{'title': x['label'], 'url': resolve_url(x['target'])} for x in manifest['footer'] if x['enabled']]
        elif binding.get('operation') == 'append-link':
            cur = patch
            for p in parts[:-1]:
                cur = cur.setdefault(p, {})
            value = cur.get(parts[-1], '') + f' <a href="{target_url}">{binding["label"]}</a>'
        elif binding.get('operation') == 'button':
            value = {'name': binding['label'], 'link': target_url}
        elif binding['path'] == 'aside.button':
            value = {'name': binding['label'], 'link': target_url}
        else:
            value = target_url
        cur = patch
        for p in parts[:-1]:
            cur = cur.setdefault(p, {})
        cur[parts[-1]] = value

    theme_path = CONSOLE + 'themes/' + THEME + '/json-config'
    client.api(theme_path, 'PUT', merge(client.api(theme_path), patch))
    system = client.api('/api/v1alpha1/configmaps/system')
    for group, gpatch in {
        'basic': {'title': manifest['title'], 'subtitle': ''},
        'seo': {'description': manifest['description']},
        'menu': {'primary': 'hbn-site-menu'},
        'post': {'pageSize': 10},
    }.items():
        system['data'][group] = json.dumps(merge(json.loads(system['data'].get(group, '{}')), gpatch), ensure_ascii=False)
    client.api('/api/v1alpha1/configmaps/system', 'PUT', system)

    jar = data_root / 'plugins/PluginSearchWidget-1.8.0.jar'
    search_path = '/apis/plugin.halo.run/v1alpha1/plugins/PluginSearchWidget'
    if jar.exists():
        search = client.api(search_path)
        if search['spec']['version'] != '1.8.0':
            set_plugin_enabled(client, 'PluginSearchWidget', False)
            for _ in range(60):
                if client.api(search_path).get('status', {}).get('phase') == 'DISABLED':
                    break
                time.sleep(0.5)
            boundary = 'demo-search-upgrade'
            body = (
                f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{jar.name}"\r\n'
                f'Content-Type: application/java-archive\r\n\r\n'.encode()
                + jar.read_bytes()
                + f'\r\n--{boundary}--\r\n'.encode()
            )
            client.api(CONSOLE + 'plugins/PluginSearchWidget/upgrade', 'POST', body, 'multipart/form-data; boundary=' + boundary)
        set_plugin_enabled(client, 'PluginSearchWidget', True)
        for _ in range(60):
            if client.api(search_path).get('status', {}).get('phase') == 'STARTED':
                break
            time.sleep(1)

    write_json(runtime.root / 'import-complete.json', {
        'content': len(manifest['content']),
        'assets': len(assets),
        'publicUrl': public_url,
    })
    print('Demo content, theme, and search plugin initialized.')
