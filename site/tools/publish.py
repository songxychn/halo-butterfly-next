"""Content publisher for the separately owned loopback Halo site."""
import copy
from datetime import datetime, timezone
import html
import json
from pathlib import Path
import subprocess
import time
from urllib.parse import urlparse
from runtime import REPO, OWNER, THEME, ApiError, read_json, sha, write_json

ANNOTATION = 'site.halo-butterfly-next/owner'
RESOURCE = '/apis/content.halo.run/v1alpha1/'
CONSOLE = '/apis/api.console.halo.run/v1alpha1/'
SNAPSHOT_KEYS = {'headSnapshot', 'baseSnapshot', 'releaseSnapshot'}


def digest(value):
    return sha(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode())


def deep_merge(base, patch):
    result = copy.deepcopy(base)
    for key, value in patch.items():
        result[key] = deep_merge(result.get(key, {}), value) if isinstance(value, dict) else copy.deepcopy(value)
    return result


def matches(current, expected):
    return all(key in current and (matches(current[key], value) if isinstance(value, dict) else current[key] == value)
               for key, value in expected.items())


def annotation_owned(obj):
    return obj.get('metadata', {}).get('annotations', {}).get(ANNOTATION) == OWNER


def post_snapshot(obj, content):
    return {'spec': {k: v for k, v in obj['spec'].items() if k not in SNAPSHOT_KEYS},
            'content': {k: content.get(k, '') for k in ['content', 'raw', 'rawType']}}


def classify(saved, current, owned, desired=None):
    """Pure preflight decision; a missing ledger never silently adopts a resource."""
    if current is None:
        if saved and saved.get('fingerprint'):
            raise RuntimeError('Previously managed resource is missing; restore or resolve explicitly')
        return 'create'
    if not owned:
        raise RuntimeError('Resource name belongs to another owner')
    if not saved:
        raise RuntimeError('Owned-looking resource has no local ledger; refusing adoption')
    if saved.get('pending'):
        expected = saved['pending']
        if current == expected:
            return 'recover'
        if saved.get('fingerprint') == digest(current):
            return 'retry'
        raise RuntimeError('Interrupted write differs from its journal; manual resolution required')
    if saved.get('fingerprint') != digest(current):
        raise RuntimeError('Remote edit conflict; preserving backend content')
    return 'unchanged' if desired is not None and matches(current, desired) else 'update'


class Publisher:
    def __init__(self, client):
        self.client = client
        self.runtime = client.runtime
        self.root = self.runtime.root
        self.manifest = read_json(REPO / 'site/manifest.json')
        self.profile = read_json(REPO / 'site' / self.manifest['themeProfile'])
        self.assets = read_json(REPO / 'site' / self.manifest['assetsManifest'])['assets']
        subprocess.run(['node', 'site/check.mjs'], cwd=REPO, check=True, capture_output=True)
        self.file = self.root / 'sync-state.json'
        self.state = read_json(self.file) if self.file.exists() else {'owner': OWNER, 'base': self.runtime.base, 'objects': {}, 'settings': {}}
        if self.state['owner'] != OWNER or self.state['base'] != self.runtime.base:
            raise RuntimeError('Sync ledger identity mismatch')
        self.counts = {'created': 0, 'updated': 0, 'unchanged': 0, 'published': 0}
        self.items = {item['id']: item for item in self.manifest['content']}
        self.asset_urls = {a['id']: '/site-assets/' + a['id'] + '-' + a['sha256'][:16] + Path(a['file']).suffix for a in self.assets}

    def save(self):
        write_json(self.file, self.state)

    def metadata(self, name):
        return {'name': name, 'annotations': {ANNOTATION: OWNER}}

    def collection(self, item):
        return 'posts' if item['kind'] == 'Post' else 'singlepages'

    def read_content(self, item):
        plural = self.collection(item)
        obj = self.client.maybe(RESOURCE + plural + '/' + item['id'])
        body = self.client.api(CONSOLE + plural + '/' + item['id'] + '/head-content') if obj else None
        return obj, post_snapshot(obj, body) if obj else None

    def guard(self, key, obj, snapshot, expected=None, recover=False):
        decision = classify(self.state['objects'].get(key), snapshot, annotation_owned(obj) if obj else False, expected)
        if recover and decision == 'recover':
            self.state['objects'][key] = {'fingerprint': digest(snapshot)}
            self.save()
        return decision

    def preflight(self):
        removed = set(self.state['objects']) - set(self.items) - {
            x['resourceName'] for x in self.manifest['categories'] + self.manifest['tags']
        } - {'hbn-site-menu'} - {self.menu_id(x) for x in self.manifest['navigation'] if x['enabled']}
        if removed:
            raise RuntimeError('Managed objects removed from manifest; no automatic deletion: ' + ', '.join(sorted(removed)))
        for item in self.manifest['content']:
            obj, snapshot = self.read_content(item)
            self.guard(item['id'], obj, snapshot)
        # Slug collisions with resources we do not own are rejected before writes.
        for plural in ['posts', 'singlepages', 'categories', 'tags']:
            items = self.list_all(RESOURCE + plural)
            desired = [x for x in self.manifest['content'] if self.collection(x) == plural] if plural in ['posts', 'singlepages'] else self.manifest[plural]
            for target in desired:
                name = target.get('resourceName', target.get('id'))
                for actual in items:
                    if actual['spec'].get('slug') == target['slug'] and actual['metadata']['name'] != name:
                        raise RuntimeError(f'Slug collision: {plural}/{target["slug"]}')
                if plural in ['categories', 'tags']:
                    actual = next((x for x in items if x['metadata']['name'] == name), None)
                    self.guard(name, actual, {'spec': actual['spec']} if actual else None)
        for asset in self.assets:
            target = self.root / 'halo/data/attachments/site-assets' / self.asset_urls[asset['id']].split('/')[-1]
            if target.exists() and sha(target.read_bytes()) != asset['sha256']:
                raise RuntimeError('Managed asset changed outside publisher: ' + asset['id'])

    def list_all(self, endpoint):
        result = []
        page = 0
        while True:
            data = self.client.api(endpoint + f'?page={page}&size=100')
            result.extend(data['items'])
            if len(result) >= data.get('total', len(result)) or not data['items']:
                return result
            page += 1

    def asset_sync(self):
        for asset in self.assets:
            body = (REPO / 'site' / asset['file']).read_bytes()
            if sha(body) != asset['sha256']:
                raise RuntimeError('Asset changed after preflight')
            target = self.root / 'halo/data/attachments/site-assets' / self.asset_urls[asset['id']].split('/')[-1]
            if target.exists():
                if sha(target.read_bytes()) != asset['sha256']:
                    raise RuntimeError('Asset collision')
            else:
                # The exclusive write never overwrites an attachment.
                with target.open('xb') as stream:
                    stream.write(body)

    def upsert_resource(self, endpoint, kind, name, spec):
        obj = self.client.maybe(endpoint + '/' + name)
        current = {'spec': obj['spec']} if obj else None
        expected = {'spec': spec}
        decision = self.guard(name, obj, current, expected, recover=True)
        if decision == 'recover':
            decision = self.guard(name, obj, current, expected)
        if decision == 'unchanged':
            self.counts['unchanged'] += 1
            return obj
        intended = {'spec': deep_merge(obj['spec'] if obj else {}, spec)}
        self.state['objects'].setdefault(name, {})['pending'] = intended
        self.save()
        value = copy.deepcopy(obj) if obj else {'apiVersion': 'content.halo.run/v1alpha1' if endpoint.startswith(RESOURCE) else 'v1alpha1', 'kind': kind, 'metadata': self.metadata(name)}
        value['spec'] = deep_merge(value.get('spec', {}), spec)
        self.client.api(endpoint + ('/' + name if obj else ''), 'PUT' if obj else 'POST', value)
        actual = self.client.api(endpoint + '/' + name)
        snapshot = {'spec': actual['spec']}
        if (snapshot != intended if obj else not matches(snapshot, expected)):
            raise RuntimeError('Resource readback differs: ' + name)
        self.state['objects'][name] = {'fingerprint': digest(snapshot)}
        self.save()
        self.counts['updated' if obj else 'created'] += 1
        return actual

    def spec(self, item):
        result = {'title': item['title'], 'slug': item['slug'], 'allowComment': item['allowComment'],
                  'deleted': False, 'pinned': item['pinned'], 'priority': 100 - item['pinOrder'] if item['pinned'] else 0,
                  'visible': 'PUBLIC', 'owner': self.client.auth['username'], 'cover': self.asset_urls[item['coverAsset']],
                  'excerpt': {'autoGenerate': False, 'raw': item['excerpt']}}
        if item['kind'] == 'Post':
            result['categories'] = [next(c['resourceName'] for c in self.manifest['categories'] if c['id'] == key) for key in item['categories']]
            result['tags'] = [next(t['resourceName'] for t in self.manifest['tags'] if t['id'] == key) for key in item['tags']]
        return result

    def upsert_content(self, item, rendered):
        obj, snapshot = self.read_content(item)
        body = {'content': rendered, 'raw': rendered, 'rawType': 'HTML'}
        spec = self.spec(item)
        if not obj:
            spec['publish'] = False
        expected = {'spec': spec, 'content': body}
        decision = self.guard(item['id'], obj, snapshot, expected, recover=True)
        if decision == 'recover':
            decision = self.guard(item['id'], obj, snapshot, expected)
        if decision == 'unchanged':
            self.counts['unchanged'] += 1
            return
        intended = {'spec': deep_merge(snapshot['spec'] if snapshot else {}, spec), 'content': copy.deepcopy(body)}
        self.state['objects'].setdefault(item['id'], {})['pending'] = intended
        self.save()
        value = copy.deepcopy(obj) if obj else {'apiVersion': 'content.halo.run/v1alpha1', 'kind': item['kind'], 'metadata': self.metadata(item['id'])}
        value['spec'] = deep_merge(value.get('spec', {}), spec)
        if obj and obj['spec'].get('headSnapshot'):
            snap = self.client.api(RESOURCE + 'snapshots/' + obj['spec']['headSnapshot'])
            body['version'] = snap['metadata']['version']
        key = 'post' if item['kind'] == 'Post' else 'page'
        endpoint = CONSOLE + self.collection(item) + ('/' + item['id'] if obj else '')
        self.client.api(endpoint, 'PUT' if obj else 'POST', {key: value, 'content': body})
        actual, updated = self.read_content(item)
        # ContentUpdateParam.version is transport metadata, not stored body content.
        expected['content'].pop('version', None)
        if (updated != intended if obj else not matches(updated, expected)):
            raise RuntimeError('Content readback differs: ' + item['id'])
        self.state['objects'][item['id']] = {'fingerprint': digest(updated)}
        self.save()
        self.counts['updated' if obj else 'created'] += 1

    def permalinks(self):
        mapping = {}
        for item in self.manifest['content']:
            endpoint = RESOURCE + self.collection(item) + '/' + item['id']
            for _ in range(40):
                obj = self.client.api(endpoint)
                value = obj.get('status', {}).get('permalink')
                if value:
                    parsed = urlparse(value)
                    if parsed.netloc and parsed.netloc != urlparse(self.runtime.base).netloc:
                        raise RuntimeError('Unexpected permalink origin')
                    if not parsed.path.startswith('/') or parsed.query or parsed.fragment:
                        raise RuntimeError('Unexpected permalink shape')
                    mapping[item['id']] = parsed.path
                    break
                time.sleep(.2)
            else:
                raise RuntimeError('Halo did not produce permalink: ' + item['id'])
        return mapping

    def compile(self, mapping):
        file = self.root / 'permalinks.json'
        write_json(file, mapping)
        result = subprocess.run(['node', 'site/render.mjs', str(file)], cwd=REPO, check=True, capture_output=True, text=True)
        return {item['id']: item['html'] for item in json.loads(result.stdout)['content']}

    def sync(self):
        self.preflight()
        self.asset_sync()
        for plural, kind in [('categories', 'Category'), ('tags', 'Tag')]:
            for item in self.manifest[plural]:
                spec = {'displayName': item['name'], 'slug': item['slug']}
                if plural == 'categories':
                    spec['priority'] = 0
                self.upsert_resource(RESOURCE + plural, kind, item['resourceName'], spec)
        for item in self.manifest['content']:
            if not self.client.maybe(RESOURCE + self.collection(item) + '/' + item['id']):
                self.upsert_content(item, '<p>内容准备中。</p>')
        mapping = self.permalinks()
        rendered = self.compile(mapping)
        for item in self.manifest['content']:
            self.upsert_content(item, rendered[item['id']])
        self.state['contentDigest'] = digest(rendered)
        self.save()
        return self.report('sync', mapping)

    def release_content(self, item, obj):
        # Halo 2.26.1 Post/SinglePageService publish performs this resource update.
        # Use the checked resource version directly; console endpoints retry with
        # fresh objects and SinglePage has no headSnapshot parameter.
        target = obj['spec'].get('headSnapshot') or obj['spec'].get('baseSnapshot')
        if not target or obj['metadata'].get('version') is None:
            raise RuntimeError('Publication requires a checked snapshot and resource version')
        value = copy.deepcopy(obj)
        value['spec'].update(publish=True, headSnapshot=target, releaseSnapshot=target)
        try:
            self.client.api(RESOURCE + self.collection(item) + '/' + item['id'], 'PUT', value)
        except ApiError as error:
            if error.status == 409:
                raise RuntimeError('Content changed during publication; refusing to publish a newer snapshot') from None
            raise
        return target

    def publish(self):
        self.preflight()
        mapping = self.permalinks()
        rendered = self.compile(mapping)
        # All documents must match source before releasing any of them.
        for item in self.manifest['content']:
            obj, snapshot = self.read_content(item)
            expected = {'spec': self.spec(item), 'content': {'content': rendered[item['id']], 'raw': rendered[item['id']], 'rawType': 'HTML'}}
            if not matches(snapshot, expected):
                raise RuntimeError('Source differs from saved draft; run sync first: ' + item['id'])
        for item in self.manifest['content']:
            obj, snapshot = self.read_content(item)
            self.guard(item['id'], obj, snapshot, recover=True)
            if obj['spec'].get('publish') and obj['spec'].get('releaseSnapshot') == (obj['spec'].get('headSnapshot') or obj['spec'].get('baseSnapshot')):
                self.counts['unchanged'] += 1
                continue
            expected = copy.deepcopy(snapshot)
            expected['spec']['publish'] = True
            self.state['objects'][item['id']]['pending'] = expected
            self.save()
            target = self.release_content(item, obj)
            actual, updated = self.read_content(item)
            if not matches(updated, expected) or actual['spec'].get('releaseSnapshot') != target:
                raise RuntimeError('Publication readback differs: ' + item['id'])
            released = self.client.api(CONSOLE + self.collection(item) + '/' + item['id'] + '/release-content')
            if not matches(released, expected['content']):
                raise RuntimeError('Released content differs from checked source: ' + item['id'])
            self.state['objects'][item['id']] = {'fingerprint': digest(updated)}
            self.save()
            self.counts['published'] += 1
        return self.report('publish', mapping)

    def target_url(self, target, mapping):
        if target['type'] == 'content':
            item = self.items[target['key']]
            obj, _ = self.read_content(item)
            if not obj['spec'].get('publish'):
                raise RuntimeError('Navigation cannot reference an unpublished document')
            return mapping[target['key']]
        if target['type'] == 'route':
            return self.manifest['routes'][target['key']]
        if target['type'] == 'asset':
            return self.asset_urls[target['key']]
        if target['type'] == 'publication':
            return self.manifest['publication'][target['key']]
        if target['type'] == 'category':
            category = next(x for x in self.manifest['categories'] if x['id'] == target['key'])
            return self.client.api(RESOURCE + 'categories/' + category['resourceName'])['status']['permalink']
        raise RuntimeError('Unsupported target')

    @staticmethod
    def menu_id(item):
        return 'hbn-site-menu-' + item['target']['type'] + '-' + item['target']['key']

    def guarded_settings(self, name, current, desired, setter):
        saved = self.state['settings'].get(name)
        if saved and digest(current) != saved['fingerprint']:
            if not (saved.get('pending') is not None and current == saved['pending']):
                raise RuntimeError('Settings changed outside publisher: ' + name)
        if current == desired:
            self.state['settings'][name] = {'fingerprint': digest(current)}
            self.save()
            return
        write_json(self.root / ('before-' + name + '-' + str(time.time_ns()) + '.json'), current)
        self.state['settings'][name] = {'fingerprint': digest(current), 'pending': desired}
        self.save()
        actual = setter(desired)
        if actual != desired:
            raise RuntimeError('Settings readback differs: ' + name)
        self.state['settings'][name] = {'fingerprint': digest(actual)}
        self.save()

    def configure(self):
        self.preflight()
        mapping = self.permalinks()
        theme_path = f'/apis/api.console.halo.run/v1alpha1/themes/{THEME}/json-config'
        current_theme = self.client.api(theme_path)
        system_path = '/api/v1alpha1/configmaps/system'
        system = self.client.api(system_path)
        current_system = copy.deepcopy(system['data'])
        # Preflight all settings before any menu or configuration mutation.
        for name, current in [('theme', current_theme), ('system', current_system)]:
            saved = self.state['settings'].get(name)
            if saved and digest(current) != saved['fingerprint'] and current != saved.get('pending'):
                raise RuntimeError('Settings changed outside publisher: ' + name)
        nav = [x for x in self.manifest['navigation'] if x['enabled']]
        menu_name = 'hbn-site-menu'
        for item in nav:
            endpoint = '/api/v1alpha1/menuitems/' + self.menu_id(item)
            obj = self.client.maybe(endpoint)
            self.guard(self.menu_id(item), obj, {'spec': obj['spec']} if obj else None)
        menu = self.client.maybe('/api/v1alpha1/menus/' + menu_name)
        self.guard(menu_name, menu, {'spec': menu['spec']} if menu else None)
        patch = copy.deepcopy(self.profile['settings'])
        for binding in self.profile['bindings']:
            group, key = binding['path'].split('.')
            if binding['target']['type'] == 'manifest':
                value = [{'title': x['label'], 'url': self.target_url(x['target'], mapping)} for x in self.manifest['footer'] if x['enabled']]
            else:
                url = self.target_url(binding['target'], mapping)
                if binding['path'] == 'aside.button':
                    value = {'name': binding['label'], 'link': url}
                elif binding.get('operation') == 'append-link':
                    value = patch[group][key] + f' <a href="{html.escape(url, quote=True)}">{html.escape(binding["label"])}</a>'
                else:
                    value = url
            patch.setdefault(group, {})[key] = value
        nav_urls = [self.target_url(item['target'], mapping) for item in nav]
        for index, item in enumerate(nav):
            self.upsert_resource('/api/v1alpha1/menuitems', 'MenuItem', self.menu_id(item),
                                 {'displayName': item['label'], 'href': nav_urls[index],
                                  'target': '_self', 'priority': index, 'menuName': menu_name})
        self.upsert_resource('/api/v1alpha1/menus', 'Menu', menu_name,
                             {'displayName': '文档演示站导航', 'menuItems': [self.menu_id(item) for item in nav]})
        desired_theme = deep_merge(current_theme, patch)
        def put_theme(value):
            if self.client.api(theme_path) != current_theme:
                raise RuntimeError('Theme settings changed during configuration')
            self.client.api(theme_path, 'PUT', value)
            return self.client.api(theme_path)
        self.guarded_settings('theme', current_theme, desired_theme, put_theme)
        desired_system = copy.deepcopy(current_system)
        for group, patch in {'basic': {'title': self.manifest['title'], 'subtitle': ''},
                             'seo': {'description': self.manifest['description']},
                             'menu': {'primary': menu_name}, 'post': {'pageSize': 10}}.items():
            desired_system[group] = json.dumps(deep_merge(json.loads(desired_system.get(group, '{}')), patch), ensure_ascii=False)
        def put_system(value):
            live = self.client.api(system_path)
            if live['data'] != current_system:
                raise RuntimeError('System settings changed during configuration')
            live['data'] = value
            self.client.api(system_path, 'PUT', live)
            return self.client.api(system_path)['data']
        self.guarded_settings('system', current_system, desired_system, put_system)
        return self.report('configure', mapping)

    def plan(self):
        self.preflight()
        changes = []
        complete = all(self.client.maybe(RESOURCE + self.collection(x) + '/' + x['id']) for x in self.manifest['content'])
        mapping = self.permalinks() if complete else {}
        rendered = self.compile(mapping) if complete else {}
        for item in self.manifest['content']:
            obj, snapshot = self.read_content(item)
            if not obj:
                action = 'create-draft'
            elif item['id'] in rendered:
                expected = {'spec': self.spec(item), 'content': {'content': rendered[item['id']], 'raw': rendered[item['id']], 'rawType': 'HTML'}}
                action = 'unchanged' if matches(snapshot, expected) else 'update-draft'
            else:
                action = 'resolve-links-after-creation'
            changes.append({'id': item['id'], 'action': action, 'published': bool(obj and obj['spec'].get('publish'))})
        return {'command': 'plan', 'base': self.runtime.base, 'changes': changes, 'mutations': 0}

    def report(self, command, mapping):
        result = {'command': command, 'base': self.runtime.base, 'counts': self.counts,
                  'permalinks': mapping, 'contentDigest': self.state.get('contentDigest'),
                  'recordedAt': datetime.now(timezone.utc).isoformat(), 'publicDeployment': False}
        write_json(self.root / f'{command}-{time.time_ns()}.json', result)
        return result
