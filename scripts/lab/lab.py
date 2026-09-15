#!/usr/bin/env python3
"""Fixed-version, loopback-only comparison lab. Requires Python 3.9+, Java 21+, Node 24, pnpm 11.19.0."""
import argparse
import base64
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

REPO = Path(__file__).resolve().parents[2]
FIXTURES = REPO / 'fixtures/comparison'
VERSIONS = json.loads((FIXTURES / 'versions.json').read_text())
CONTENT = json.loads((FIXTURES / 'content.json').read_text())
RUNTIME = Path(os.environ.get('LAB_RUNTIME', str(REPO / '.runtime/comparison'))).resolve()
PORTS = {'halo': int(os.environ.get('HALO_PORT', '18091')), 'hexo': int(os.environ.get('HEXO_PORT', '14000'))}
if any(p < 1024 or p > 65535 for p in PORTS.values()) or len(set(PORTS.values())) != 2:
    raise SystemExit('Ports must be distinct and in 1024..65535')
BASE = {key: f'http://127.0.0.1:{port}' for key, port in PORTS.items()}
THEME = 'halo-butterfly-next'
LOCAL = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def run(args, **kwargs):
    return subprocess.run([str(a) for a in args], check=True, **kwargs)


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def write_json(path, data, private=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    with os.fdopen(os.open(path, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600 if private else 0o644), 'w') as stream:
        json.dump(data, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    if private:
        path.chmod(0o600)


def body(post):
    return (FIXTURES / post['body']).read_text() if post.get('body') else '<h2 id="fixture">固定合成文章</h2><p>用于核对分页、归档、标签与无封面回退。两站使用同一份版本化内容。</p>'


def fixture_hash():
    h = hashlib.sha256()
    for path in sorted(FIXTURES.rglob('*')):
        if path.is_file() and 'node_modules' not in path.parts:
            h.update(str(path.relative_to(FIXTURES)).encode())
            h.update(path.read_bytes())
    return h.hexdigest()


def prepare():
    if RUNTIME.exists() and any(RUNTIME.iterdir()) and not (RUNTIME / 'lab.json').exists():
        raise RuntimeError('Refusing to claim a non-empty directory without lab.json')
    RUNTIME.mkdir(parents=True, exist_ok=True)
    marker = RUNTIME / 'lab.json'
    identity = {'schema': 1, 'ports': PORTS, 'owner': 'halo-butterfly-next-comparison'}
    if marker.exists() and json.loads(marker.read_text()) != identity:
        raise RuntimeError('Runtime belongs to a different lab/port configuration')
    if (RUNTIME / 'seed.json').exists():
        check_hexo_inputs(json.loads((RUNTIME / 'seed.json').read_text()))
    write_json(marker, identity)
    halo = RUNTIME / 'halo'
    halo.mkdir(exist_ok=True)
    jar = halo / 'halo-2.26.1.jar'
    if not jar.exists():
        source = os.environ.get('HALO_JAR_SOURCE')
        if source:
            shutil.copyfile(source, jar)
        else:
            run(['curl', '--fail', '--location', '--retry', '2', VERSIONS['halo']['url'], '-o', jar])
    if digest(jar) != VERSIONS['halo']['sha256']:
        raise RuntimeError('Halo JAR SHA-256 mismatch; refusing to execute it')
    site = RUNTIME / 'hexo'
    site.mkdir(exist_ok=True)
    upstream = site / 'themes/butterfly'
    if not upstream.exists():
        upstream.parent.mkdir(exist_ok=True)
        # A caller-supplied clone is only an object cache; tracked content is checked out by SHA.
        source = os.environ.get('HEXO_SOURCE', VERSIONS['butterfly']['repository'])
        run(['git', 'clone', '--no-checkout', source, upstream])
        run(['git', '-C', upstream, 'checkout', '--detach', VERSIONS['butterfly']['commit']])
    head = run(['git', '-C', upstream, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
    dirty = run(['git', '-C', upstream, 'status', '--porcelain'], capture_output=True, text=True).stdout
    if head != VERSIONS['butterfly']['commit'] or dirty:
        raise RuntimeError('Reference theme must be the clean pinned Butterfly commit')
    if json.loads((upstream / 'package.json').read_text())['version'] != VERSIONS['butterfly']['version']:
        raise RuntimeError('Butterfly version mismatch')
    for name in ['package.json', 'pnpm-lock.yaml']:
        shutil.copyfile(FIXTURES / 'hexo' / name, site / name)
    run(['pnpm', 'install', '--frozen-lockfile', '--ignore-scripts'], cwd=site)
    if (RUNTIME / 'seed.json').exists():
        check_hexo_inputs(json.loads((RUNTIME / 'seed.json').read_text()))
    else:
        render_hexo()
    assets = halo / 'data/attachments/lab'
    shutil.copytree(FIXTURES / 'assets', assets, dirs_exist_ok=True)
    print('Prepared pinned Halo and Butterfly; synthetic assets copied')


def render_hexo():
    site = RUNTIME / 'hexo'
    source = site / 'source'
    # Only files produced by this lab are replaced. Never remove arbitrary source trees.
    (source / '_posts').mkdir(parents=True, exist_ok=True)
    for post in CONTENT['posts']:
        front = {key: post[key] for key in ['title', 'date', 'cover']}
        front.update({'updated': post['date'], 'slug': post['name'], 'categories': [x['title'] for x in CONTENT['categories'] if x['name'] in post['categories']], 'tags': [x['title'] for x in CONTENT['tags'] if x['name'] in post['tags']], 'comments': True})
        # JSON is valid YAML, including within Hexo front matter.
        (source / '_posts' / (post['name'] + '.md')).write_text('---\n' + json.dumps(front, ensure_ascii=False) + '\n---\n' + body(post))
    for page in CONTENT['pages'] + [{'name': 'tags', 'title': '标签', 'type': 'tags', 'body': ''}, {'name': 'categories', 'title': '分类', 'type': 'categories', 'body': ''}]:
        directory = source / page['name']
        directory.mkdir(exist_ok=True)
        front = {'title': page['title'], 'date': '2026-08-01T04:00:00Z', 'updated': '2026-08-01T04:00:00Z', 'top_img': '/lab/cover.svg'}
        if 'type' in page:
            front['type'] = page['type']
        (directory / 'index.md').write_text('---\n' + json.dumps(front, ensure_ascii=False) + '\n---\n' + page['body'])
    shutil.copytree(FIXTURES / 'assets', source / 'lab', dirs_exist_ok=True)
    # Vendor only runtime browser dependencies used by the baseline. Versions/integrity are locked.
    browser_files = {'@fortawesome/fontawesome-free': ['css/all.min.css', 'webfonts'], '@fancyapps/ui': ['dist/fancybox/fancybox.umd.js', 'dist/fancybox/fancybox.css'], 'typed.js': ['dist/typed.umd.js']}
    for package, paths in browser_files.items():
        for relative in paths:
            origin = site / 'node_modules' / package / relative
            target = source / 'pluginsSrc' / package / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            if origin.is_dir(): shutil.copytree(origin, target, dirs_exist_ok=True)
            else: shutil.copyfile(origin, target)
    cfg = {**CONTENT['site'], 'language': 'zh-CN', 'timezone': VERSIONS['timezone'], 'url': BASE['hexo'], 'theme': 'butterfly', 'permalink': 'archives/:title/', 'default_category': '', 'category_map': {x['title']: x['name'] for x in CONTENT['categories']}, 'tag_map': {x['title']: x['name'] for x in CONTENT['tags']}, 'per_page': CONTENT['site']['pageSize'], 'index_generator': {'per_page': CONTENT['site']['pageSize'], 'order_by': '-date'}, 'archive_generator': {'per_page': CONTENT['site']['pageSize']}, 'highlight': {'enable': True, 'line_number': True}, 'syntax_highlighter': 'highlight.js', 'skip_render': ['lab/**', 'pluginsSrc/**']}
    write_json(site / '_config.yml', cfg)
    theme = {'menu': {x['title']: x['path'] + ' || ' + x['icon'] for x in CONTENT['menu']}, 'avatar': {'img': '/lab/avatar.svg', 'effect': False}, 'favicon': '/lab/avatar.svg', 'default_top_img': '/lab/cover.svg', 'index_img': '/lab/cover.svg', 'archive_img': '/lab/cover.svg', 'tag_img': '/lab/cover.svg', 'category_img': '/lab/cover.svg', 'cover': {'default_cover': ['/lab/cover.svg']}, 'subtitle': {'enable': False, 'effect': False, 'source': False, 'sub': []}, 'social': {}, 'aside': {'card_author': {'description': CONTENT['site']['description'], 'button': {'enable': True, 'text': '关于对照实验室', 'link': '/about-preview/', 'icon': 'fas fa-heart'}}, 'card_announcement': {'content': '共用合成内容；验收结果以证据记录为准。'}}, 'busuanzi': {'site_uv': False, 'site_pv': False, 'page_pv': False}, 'comments': {'use': []}, 'share': {'use': False}, 'CDN': {'internal_provider': 'local', 'third_party_provider': 'local', 'version': True}, 'darkmode': {'enable': True, 'autoChangeMode': False}, 'lazyload': {'enable': False}}
    write_json(site / '_config.butterfly.yml', theme)
    run(['pnpm', 'exec', 'hexo', 'clean', '--silent'], cwd=site)
    run(['pnpm', 'exec', 'hexo', 'generate', '--silent'], cwd=site)
    if not (site / 'public/index.html').is_file():
        raise RuntimeError('Hexo did not generate an index page')


class Inputs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.csrf = None
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'input' and values.get('name') == '_csrf':
            self.csrf = values.get('value')


class Client:
    def __init__(self, initialize=False):
        if not (RUNTIME / 'lab.json').exists() or not owned_process('halo'):
            raise RuntimeError('Refusing API mutations without an owned Halo lab process')
        self.initialized_now = False
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(self.jar))
        credentials = RUNTIME / 'halo/credentials.json'
        if not credentials.exists():
            if not initialize:
                raise RuntimeError('Run bootstrap to initialize the fresh lab')
            write_json(credentials, {'username': 'fixture-maintainer', 'password': secrets.token_hex(24)}, private=True)
        if credentials.stat().st_mode & 0o077:
            raise RuntimeError('Credentials must have mode 0600')
        self.auth = json.loads(credentials.read_text())
        if initialize:
            response = self.opener.open(BASE['halo'] + '/system/setup', timeout=30)
            parser = Inputs(); parser.feed(response.read().decode())
            if urllib.parse.urlparse(response.url).path == '/system/setup' and parser.csrf:
                payload = {**self.auth, '_csrf': parser.csrf, 'email': 'fixture@example.invalid', 'siteTitle': CONTENT['site']['title'], 'language': 'zh-CN', 'externalUrl': BASE['halo']}
                self.opener.open(urllib.request.Request(BASE['halo'] + '/system/setup', data=urllib.parse.urlencode(payload).encode()), timeout=60).read()
                self.initialized_now = True
        page = self.opener.open(BASE['halo'] + '/login', timeout=30).read().decode()
        parser = Inputs(); parser.feed(page)
        self.csrf = parser.csrf
        match = re.search(r'const publicKey = (".*?");', page)
        if not match or not self.csrf:
            raise RuntimeError('Expected Halo 2.26.1 login form')
        with tempfile.NamedTemporaryFile(mode='w', dir=RUNTIME / 'halo', suffix='.pem') as key:
            key.write('-----BEGIN PUBLIC KEY-----\n' + json.loads(match.group(1)) + '\n-----END PUBLIC KEY-----\n'); key.flush()
            encrypted = run(['openssl', 'pkeyutl', '-encrypt', '-pubin', '-inkey', key.name, '-pkeyopt', 'rsa_padding_mode:pkcs1'], input=self.auth['password'].encode(), capture_output=True).stdout
        payload = {'username': self.auth['username'], 'password': base64.b64encode(encrypted).decode(), '_csrf': self.csrf}
        for attempt in range(2):
            try:
                response = self.opener.open(urllib.request.Request(BASE['halo'] + '/login', data=urllib.parse.urlencode(payload).encode()), timeout=30)
                break
            except urllib.error.HTTPError as error:
                if error.code != 429 or attempt:
                    raise RuntimeError(f'Local login HTTP {error.code}') from None
                print('Halo authentication rate limit; retrying once after 61 seconds', flush=True)
                time.sleep(61)
        if '/login' in response.url:
            raise RuntimeError('Local Halo login failed')

    def api(self, path, method='GET', data=None, content_type='application/json'):
        headers = {'Accept': 'application/json', 'X-CSRF-TOKEN': self.csrf}
        if data is not None:
            if not isinstance(data, bytes):
                data = json.dumps(data).encode()
            headers['Content-Type'] = content_type
        try:
            response = self.opener.open(urllib.request.Request(BASE['halo'] + path, data=data, headers=headers, method=method), timeout=60)
            result = response.read()
            if 'text/html' in response.headers.get('Content-Type', ''):
                raise RuntimeError(f'Unexpected HTML for {path}')
            return json.loads(result) if result else None
        except urllib.error.HTTPError as error:
            raise ApiError(method, path, error.code) from None

    def ensure(self, path, obj):
        try:
            return self.api(path + '/' + obj['metadata']['name'])
        except ApiError as error:
            if error.status != 404:
                raise
        return self.api(path, 'POST', obj)


class ApiError(RuntimeError):
    def __init__(self, method, path, status):
        self.status = status
        super().__init__(f'{method} {path}: HTTP {status}')


def install(client, package, source_sha):
    if not re.fullmatch('[0-9a-f]{40}', source_sha or ''):
        raise RuntimeError('--source-sha must identify the checkout that built this package')
    package = Path(package).resolve()
    if not package.is_file():
        raise RuntimeError('Build the theme first and pass --package /path/to/theme.zip')
    themes = client.api('/apis/theme.halo.run/v1alpha1/themes')['items']
    path = f'/apis/api.console.halo.run/v1alpha1/themes/{THEME}/upgrade' if any(x['metadata']['name'] == THEME for x in themes) else '/apis/api.console.halo.run/v1alpha1/themes/install'
    boundary = 'comparison-' + secrets.token_hex(12)
    data = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="theme.zip"\r\nContent-Type: application/zip\r\n\r\n'.encode() + package.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
    result = client.api(path, 'POST', data, 'multipart/form-data; boundary=' + boundary)
    if result['metadata']['name'] != THEME:
        raise RuntimeError('Unexpected theme identity in package')
    client.api(f'/apis/api.console.halo.run/v1alpha1/themes/{THEME}/activation', 'PUT')
    write_json(RUNTIME / 'installed-package.json', {'name': package.name, 'sha256': digest(package), 'version': result['spec']['version'], 'sourceCommit': source_sha, 'sourceCommitAttribution': 'caller-supplied; package bytes identified by sha256'})
    print('Installed and activated theme:', result['spec']['version'])



def hexo_inputs():
    site = RUNTIME / 'hexo'
    paths = list(site.glob('_config*.yml')) + list((site / 'source').rglob('*.md')) + list((site / 'source/lab').glob('*'))
    return {str(path.relative_to(site)): digest(path) for path in sorted(paths) if path.is_file()}


def check_hexo_inputs(saved):
    if saved.get('fixtureSha256') != fixture_hash():
        raise RuntimeError('Fixture versions changed; use a fresh runtime and ports')
    if saved.get('hexoInputs') != hexo_inputs():
        raise RuntimeError('Reference content/config drift detected; bootstrap preserves existing files')


def capture_initial_content(client):
    snapshot = {kind: client.api('/apis/content.halo.run/v1alpha1/' + kind + '?size=100')['items'] for kind in ['posts', 'categories', 'tags']}
    expected = {'posts': ('title', 'Hello Halo', 'hello-halo'), 'categories': ('displayName', '默认分类', 'default'), 'tags': ('displayName', 'Halo', 'halo')}
    for kind, (field, title, slug) in expected.items():
        items = snapshot[kind]
        if len(items) != 1 or items[0]['spec'].get(field) != title or items[0]['spec'].get('slug') != slug:
            raise RuntimeError('Fresh Halo initial content differs from the known baseline; preserving it')
    welcome = snapshot['posts'][0]
    snapshot['welcomeContent'] = client.api('/apis/api.console.halo.run/v1alpha1/posts/' + welcome['metadata']['name'] + '/release-content')
    write_json(RUNTIME / 'initial-content.json', snapshot, private=True)


def cleanup_initial_taxonomies(client):
    snapshot_path = RUNTIME / 'initial-content.json'
    if not snapshot_path.exists():
        raise RuntimeError('Fresh initialization snapshot unavailable; use a new runtime before seeding')
    snapshot = json.loads(snapshot_path.read_text())
    original = snapshot['posts'][0]
    name = original['metadata']['name']
    api = '/apis/content.halo.run/v1alpha1/posts/' + name
    welcome = client.api(api)
    if any(welcome['spec'].get(key) != original['spec'].get(key) for key in ['title', 'slug', 'owner']):
        raise RuntimeError('Initial welcome article was edited; preserving its taxonomies')
    for key in ['categories', 'tags']:
        if welcome['spec'].get(key, []) not in [[], original['spec'].get(key, [])]:
            raise RuntimeError('Initial welcome taxonomy links changed; preserving them')
    if welcome['spec'].get('publish'):
        client.api('/apis/api.console.halo.run/v1alpha1/posts/' + name + '/unpublish', 'PUT')
    for _ in range(10):
        welcome = client.api(api)
        if any(welcome['spec'].get(key) != original['spec'].get(key) for key in ['title', 'slug', 'owner']):
            raise RuntimeError('Initial welcome article changed during cleanup; preserving it')
        if any(welcome['spec'].get(key, []) not in [[], original['spec'].get(key, [])] for key in ['categories', 'tags']):
            raise RuntimeError('Initial welcome taxonomy links changed during cleanup; preserving them')
        if not welcome['spec'].get('categories') and not welcome['spec'].get('tags'): break
        welcome['spec'].update({'categories': [], 'tags': []})
        try:
            client.api(api, 'PUT', welcome)
            break
        except ApiError as error:
            if error.status != 409: raise
            time.sleep(0.2)  # Halo's status reconciler may advance metadata.version after unpublish.
    else:
        raise RuntimeError('Welcome article remained busy; preserving recovery snapshot')
    removed = []
    for kind in ['categories', 'tags']:
        for item in snapshot[kind]:
            item_name = item['metadata']['name']
            endpoint = '/apis/content.halo.run/v1alpha1/' + kind + '/' + item_name
            for _ in range(30):
                posts = client.api('/apis/content.halo.run/v1alpha1/posts?size=100')['items']
                if any(item_name in post['spec'].get(kind, []) for post in posts):
                    raise RuntimeError('Initial taxonomy is referenced by another article; preserving it')
                try:
                    current = client.api(endpoint)
                except ApiError as error:
                    if error.status != 404: raise
                    break
                if any(current['spec'].get(key) != value for key, value in item['spec'].items()):
                    raise RuntimeError('Initial taxonomy was edited; preserving it')
                if current['metadata'].get('deletionTimestamp'): break
                if current.get('status', {}).get('postCount') != 0:
                    time.sleep(0.2)
                    continue
                try:
                    client.api(endpoint, 'DELETE')
                    break
                except ApiError as error:
                    if error.status != 409: raise
                    time.sleep(0.2)
            else:
                raise RuntimeError('Initial taxonomy remained busy; preserving recovery snapshot')
            removed.append({'kind': kind, 'name': item_name, 'slug': item['spec']['slug']})
    for _ in range(30):
        remaining = {kind: {x['metadata']['name'] for x in client.api('/apis/content.halo.run/v1alpha1/' + kind + '?size=100')['items']} for kind in ['categories', 'tags']}
        if all(x['name'] not in remaining[x['kind']] for x in removed): break
        time.sleep(1)
    else:
        raise RuntimeError('Initial taxonomy deletion has not reconciled; preserving recovery snapshot')
    write_json(RUNTIME / 'initial-cleanup.json', {'initialSnapshotSha256': digest(snapshot_path), 'preservedWelcomeId': name, 'removedTaxonomies': removed})


def validate_menu(client):
    names = ['comparison-menu-' + str(index) for index in range(len(CONTENT['menu']))]
    menu = client.api('/api/v1alpha1/menus/comparison-primary')
    if menu['spec'].get('menuItems') != names:
        raise RuntimeError('Primary menu order differs from fixture')
    for index, item in enumerate(CONTENT['menu']):
        actual = client.api('/api/v1alpha1/menuitems/' + names[index])
        expected = {'displayName': item['title'], 'href': item['path'], 'target': '_self', 'priority': index, 'children': [], 'menuName': 'comparison-primary'}
        if any(actual['spec'].get(key) != value for key, value in expected.items()) or actual['metadata'].get('annotations', {}).get('icon') != item['icon']:
            raise RuntimeError('Menu item or icon differs from fixture: ' + names[index])


def validate_taxonomies(client, models):
    for plural, kind in [('categories', 'Category'), ('tags', 'Tag')]:
        actual = client.api('/apis/content.halo.run/v1alpha1/' + plural + '?size=100')['items']
        values = {(x['metadata']['name'], x['spec']['slug'], x['spec']['displayName']) for x in actual}
        expected = {(x['name'], x['name'], x['title']) for x in CONTENT[plural]}
        if values != expected or {x['name'] for x in models[kind]} != {x['title'] for x in CONTENT[plural]}:
            raise RuntimeError('Taxonomy collection differs from fixture: ' + plural)


def validate_config(client, saved):
    plugins = client.api('/apis/plugin.halo.run/v1alpha1/plugins?size=100')['items']
    if any(x['spec'].get('enabled') for x in plugins):
        raise RuntimeError('Baseline plugin state drifted; bootstrap preserves current plugin choices')
    config = client.api(f'/apis/api.console.halo.run/v1alpha1/themes/{THEME}/json-config')
    system = client.api('/api/v1alpha1/configmaps/system')['data']
    for actual, expected in [(config, saved['themeConfig']), ({k: json.loads(v) for k, v in system.items()}, saved['systemConfig'])]:
        for group, fields in expected.items():
            for key, value in fields.items():
                if actual.get(group, {}).get(key) != value:
                    raise RuntimeError(f'Configuration drift at {group}.{key}; existing value preserved')
    validate_menu(client)


def validate_content(client):
    posts = client.api('/apis/content.halo.run/v1alpha1/posts?size=100')['items']
    published = {x['metadata']['name']: x for x in posts if x['spec'].get('publish')}
    if set(published) != {p['name'] for p in CONTENT['posts']}:
        raise RuntimeError('Published Halo content set differs from the fixture; existing posts preserved')
    models = json.loads((RUNTIME / 'hexo/db.json').read_text())['models']
    validate_taxonomies(client, models)
    reference = {x['slug']: x for x in models['Post']}
    if set(reference) != set(published):
        raise RuntimeError('Hexo post set differs from Halo')
    for post in CONTENT['posts']:
        spec = published[post['name']]['spec']
        for key in ['title', 'cover', 'categories', 'tags']:
            if spec[key] != post[key]:
                raise RuntimeError(f"Halo fixture drift: {post['name']}.{key}")
        if spec['publishTime'] != post['date']:
            raise RuntimeError('Halo publish time differs from fixed date')
        released = client.api('/apis/api.console.halo.run/v1alpha1/posts/' + post['name'] + '/release-content')
        if released['raw'] != body(post):
            raise RuntimeError('Halo released body differs from fixture')
        ref = reference[post['name']]
        if any(ref[key] != post[key] for key in ['title', 'cover']) or ref['date'].replace('.000Z', 'Z') != post['date'] or ref['_content'].strip() != body(post).strip():
            raise RuntimeError('Hexo title/date/cover/body differs from fixture')
        for kind in ['Category', 'Tag']:
            field = 'categories' if kind == 'Category' else 'tags'
            links = {x[kind.lower() + '_id'] for x in models['Post' + kind] if x['post_id'] == ref['_id']}
            actual = {x['name'] for x in models[kind] if x['_id'] in links}
            expected = {x['title'] for x in CONTENT[field] if x['name'] in post[field]}
            if actual != expected:
                raise RuntimeError('Hexo taxonomy differs from fixture')
    pages = client.api('/apis/content.halo.run/v1alpha1/singlepages?size=100')['items']
    for item in CONTENT['pages']:
        page = next((x for x in pages if x['metadata']['name'] == item['name']), None)
        if not page or not page['spec'].get('publish') or any(page['spec'][key] != item[key] for key in ['title', 'cover']):
            raise RuntimeError('Halo single page differs from fixture')
    return sorted(published)


def disable_initial_plugin(client, name):
    """Disable one fresh-lab plugin without replaying a stale resource on conflict."""
    path = '/apis/plugin.halo.run/v1alpha1/plugins/' + name
    for attempt in range(4):
        plugin = client.api(path)
        if not plugin['spec'].get('enabled'):
            return
        plugin['spec']['enabled'] = False
        try:
            client.api(path, 'PUT', plugin)
            return
        except ApiError as error:
            if error.status != 409 or attempt == 3:
                raise
            print(f'Initial plugin {name}: resource conflict; retry {attempt + 1}/3', flush=True)
            time.sleep(0.1 * 2 ** attempt)


def seed(client):
    current = fixture_hash()
    stamp = RUNTIME / 'seed.json'
    if stamp.exists() and json.loads(stamp.read_text())['fixtureSha256'] != current:
        raise RuntimeError('Fixtures changed: use a fresh LAB_RUNTIME/ports; existing content is preserved')
    if stamp.exists():
        saved = json.loads(stamp.read_text())
        check_hexo_inputs(saved)
        validate_content(client)
        validate_config(client, saved)
        print('Seed unchanged; created 0 content objects; existing configuration preserved')
        return
    cleanup_initial_taxonomies(client)
    # Baseline profile isolates theme rendering from Halo's bundled optional plugins.
    plugins = client.api('/apis/plugin.halo.run/v1alpha1/plugins?size=100')['items']
    for plugin in plugins:
        if plugin['spec'].get('enabled'):
            disable_initial_plugin(client, plugin['metadata']['name'])
    owner = client.auth['username']
    user = client.api('/api/v1alpha1/users/' + owner)
    user['spec'].update({'displayName': CONTENT['site']['author'], 'bio': CONTENT['site']['description'], 'avatar': '/lab/avatar.svg'})
    client.api('/api/v1alpha1/users/' + owner, 'PUT', user)
    for plural, kind in [('tags', 'Tag'), ('categories', 'Category')]:
        for item in CONTENT[plural]:
            client.ensure('/apis/content.halo.run/v1alpha1/' + plural, {'apiVersion': 'content.halo.run/v1alpha1', 'kind': kind, 'metadata': {'name': item['name']}, 'spec': {'displayName': item['title'], 'slug': item['name'], 'priority': 0}})
    created = 0
    for plural, kind, key, items in [('posts', 'Post', 'post', CONTENT['posts']), ('singlepages', 'SinglePage', 'page', CONTENT['pages'])]:
        for item in items:
            api = '/apis/content.halo.run/v1alpha1/' + plural
            console = '/apis/api.console.halo.run/v1alpha1/' + plural
            try:
                existing = client.api(api + '/' + item['name'])
            except ApiError as error:
                if error.status != 404:
                    raise
                markup = body(item) if plural == 'posts' else item['body']
                spec = {'title': item['title'], 'slug': item['name'], 'allowComment': True, 'deleted': False, 'pinned': False, 'priority': 0, 'publish': False, 'visible': 'PUBLIC', 'owner': owner, 'excerpt': {'autoGenerate': True}, 'cover': item['cover'], 'publishTime': item.get('date', '2026-08-01T04:00:00Z')}
                if plural == 'posts':
                    spec.update({x: item[x] for x in ['tags', 'categories']})
                existing = client.api(console, 'POST', {key: {'apiVersion': 'content.halo.run/v1alpha1', 'kind': kind, 'metadata': {'name': item['name']}, 'spec': spec}, 'content': {'content': markup, 'raw': markup, 'rawType': 'HTML'}})
                created += 1
            # Recover a previous run interrupted between create and publish.
            if not existing.get('spec', {}).get('publish'):
                client.api(console + '/' + item['name'] + '/publish', 'PUT')
    menu = client.ensure('/api/v1alpha1/menus', {'apiVersion': 'v1alpha1', 'kind': 'Menu', 'metadata': {'name': 'comparison-primary'}, 'spec': {'displayName': '对照导航', 'menuItems': []}})
    names = []
    for index, item in enumerate(CONTENT['menu']):
        name = 'comparison-menu-' + str(index)
        client.ensure('/api/v1alpha1/menuitems', {'apiVersion': 'v1alpha1', 'kind': 'MenuItem', 'metadata': {'name': name, 'annotations': {'icon': item['icon']}}, 'spec': {'displayName': item['title'], 'href': item['path'], 'target': '_self', 'priority': index, 'children': [], 'menuName': 'comparison-primary'}})
        names.append(name)
    menu['spec']['menuItems'] = names
    client.api('/api/v1alpha1/menus/comparison-primary', 'PUT', menu)
    system = client.api('/api/v1alpha1/configmaps/system')
    system_patches = {'basic': {'title': CONTENT['site']['title'], 'subtitle': CONTENT['site']['subtitle'], 'logo': '/lab/avatar.svg', 'favicon': '/lab/avatar.svg'}, 'seo': {'description': CONTENT['site']['description']}, 'menu': {'primary': 'comparison-primary'}, 'post': {'pageSize': CONTENT['site']['pageSize']}}
    for group, patch in system_patches.items():
        value = json.loads(system['data'].get(group, '{}')); value.update(patch); system['data'][group] = json.dumps(value, ensure_ascii=False)
    client.api('/api/v1alpha1/configmaps/system', 'PUT', system)
    config_path = f'/apis/api.console.halo.run/v1alpha1/themes/{THEME}/json-config'
    for _ in range(30):
        config = client.api(config_path)
        if config and config.get('index'):
            break
        time.sleep(1)
    else:
        raise RuntimeError('Theme config reconciler did not become ready')
    patches = {'base': {'metadata_name': owner}, 'index': {'above_background': '/lab/cover.svg', 'typewriter_custom_text': '', 'enable_typewriter_random_text': False}, 'cover': {'default_cover': '/lab/cover.svg'}, 'style': {'mode': 'user'}, 'aside': {'notice': '共用合成内容；验收结果以证据记录为准。', 'social': [], 'button': {'name': '关于对照实验室', 'link': '/about-preview/'}}}
    for group in ['archives', 'tags', 'categories']:
        patches[group] = {'above_background': '/lab/cover.svg'}
    for group, patch in patches.items():
        config.setdefault(group, {}).update(patch)
    client.api(config_path, 'PUT', config)
    validate_content(client)
    validate_menu(client)
    write_json(stamp, {'fixtureSha256': current, 'posts': 12, 'pages': 1, 'themeConfig': patches, 'systemConfig': system_patches, 'hexoInputs': hexo_inputs()})
    print(f'Seed ready; created {created} content objects (repeat run creates 0)')


def listening(port):
    with socket.socket() as sock:
        return sock.connect_ex(('127.0.0.1', port)) == 0


def owned_process(name):
    path = RUNTIME / (name + '-process.json')
    if not path.exists():
        return None
    state = json.loads(path.read_text())
    result = subprocess.run(['ps', '-p', str(state['pid']), '-o', 'command='], capture_output=True, text=True)
    return state['pid'] if result.returncode == 0 and state['identity'] in result.stdout else None


def start():
    for name in ['halo', 'hexo']:
        if owned_process(name) and not listening(PORTS[name]):
            continue  # A previously launched owned process may still be starting.
        if listening(PORTS[name]):
            if not owned_process(name):
                raise RuntimeError(f'{name} port {PORTS[name]} is occupied by a process this lab does not own')
            continue
        if name == 'halo':
            identity = str(RUNTIME / 'halo/halo-2.26.1.jar')
            command = ['java', '-Xms128m', '-Xmx512m', '-Duser.timezone=' + VERSIONS['timezone'], '-jar', identity, '--server.address=127.0.0.1', '--server.port=' + str(PORTS[name]), '--halo.work-dir=' + str(RUNTIME / 'halo/data'), '--halo.external-url=' + BASE[name], '--spring.thymeleaf.cache=false', '--springdoc.api-docs.enabled=true', '--halo.attachment.resource-mappings[0].path-pattern=/lab/**', '--halo.attachment.resource-mappings[0].locations[0]=lab', '--logging.level.org.thymeleaf.TemplateEngine=ERROR']
        else:
            identity = str(RUNTIME / 'hexo/public')
            command = [sys.executable, '-m', 'http.server', str(PORTS[name]), '--bind', '127.0.0.1', '--directory', identity]
        log = (RUNTIME / (name + '.log')).open('ab')
        proc = subprocess.Popen(command, cwd=RUNTIME, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        log.close()
        write_json(RUNTIME / (name + '-process.json'), {'pid': proc.pid, 'identity': identity})
    deadline = time.monotonic() + 150
    while time.monotonic() < deadline:
        try:
            for name in BASE:
                LOCAL.open(BASE[name] + ('/actuator/health/readiness' if name == 'halo' else '/'), timeout=5).read()
            print('Healthy:', BASE)
            return
        except (OSError, urllib.error.URLError):
            time.sleep(2)
    raise RuntimeError('Startup timed out; inspect runtime logs')


class Resources(HTMLParser):
    def __init__(self):
        super().__init__(); self.urls = set()
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ['script', 'img', 'source']:
            for key in ['src', 'data-lazy-src']:
                if attrs.get(key): self.urls.add(attrs[key])
        rel = set(attrs.get('rel', '').lower().split())
        if tag == 'link' and rel.intersection({'stylesheet', 'icon'}) and attrs.get('href'):
            self.urls.add(attrs['href'])


class RenderedMenus(HTMLParser):
    VOID_TAGS = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self, platform):
        super().__init__()
        self.platform = platform
        self.stack = []
        self.menus = {}
        self.active = None
        self.anchor = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = set(attrs.get('class', '').split())
        ancestors = {node[1].get('id') for node in self.stack}
        label = None
        if self.platform == 'halo' and tag == 'menu':
            if 'menu' in classes: label = 'desktop'
            elif 'bar' in classes: label = 'mobile'
        elif self.platform == 'hexo' and tag == 'div' and 'menus_items' in classes:
            if 'sidebar-menus' in ancestors: label = 'mobile'
            elif 'menus' in ancestors: label = 'desktop'
        if label:
            if label in self.menus:
                raise RuntimeError('Duplicate rendered navigation container: ' + label)
            self.menus[label] = []
            self.active = (label, len(self.stack))
        if self.active and tag == 'a':
            self.anchor = {'text': [], 'href': attrs.get('href', ''), 'icons': []}
        if self.anchor and tag == 'i':
            self.anchor['icons'].append(sorted(classes))
        if tag not in self.VOID_TAGS:
            self.stack.append((tag, attrs))

    def handle_data(self, data):
        if self.anchor:
            self.anchor['text'].append(data)

    def handle_endtag(self, tag):
        if tag == 'a' and self.anchor is not None:
            self.anchor['text'] = ' '.join(''.join(self.anchor['text']).split())
            self.menus[self.active[0]].append(self.anchor)
            self.anchor = None
        index = next((index for index in range(len(self.stack) - 1, -1, -1) if self.stack[index][0] == tag), None)
        if index is not None:
            self.stack = self.stack[:index]
        if self.active and len(self.stack) <= self.active[1]:
            self.active = None


def validate_rendered_menus(markup, platform):
    parser = RenderedMenus(platform)
    parser.feed(markup)
    if set(parser.menus) != {'desktop', 'mobile'}:
        raise RuntimeError(platform + ' rendered navigation containers are missing')
    for label, links in parser.menus.items():
        if len(links) != len(CONTENT['menu']):
            raise RuntimeError(f'{platform} rendered {label} menu count differs from fixture: {len(links)}')
        for actual, expected in zip(links, CONTENT['menu']):
            if actual['text'] != expected['title'] or actual['href'] != expected['path'] or len(actual['icons']) != 1 or set(actual['icons'][0]) - {'fa-fw'} != set(expected['icon'].split()):
                raise RuntimeError(f'{platform} rendered {label} navigation differs from fixture: {actual}')
    return parser.menus


def resource_result(url):
    with LOCAL.open(url, timeout=15) as response:
        content_type = response.headers.get('Content-Type', '').split(';', 1)[0].strip().lower()
        if response.status != 200 or content_type in {'text/html', 'application/xhtml+xml'}:
            raise RuntimeError(f'Resource did not return asset content: {url} (HTTP {response.status}, {content_type})')
        data = response.read()
        return {'status': response.status, 'contentType': content_type, 'sha256': hashlib.sha256(data).hexdigest()}


def evidence():
    report = {'schema': 1, 'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'versions': VERSIONS, 'fixtureSha256': fixture_hash(), 'installedPackage': json.loads((RUNTIME / 'installed-package.json').read_text()), 'sites': {}, 'limitations': ['HTTP evidence does not certify visual parity, browser interaction or plugin integration.']}
    report['labCommit'] = run(['git', '-C', REPO, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
    report['labWorkingTreeClean'] = not run(['git', '-C', REPO, 'status', '--porcelain'], capture_output=True, text=True).stdout.strip()
    routes = ['/', '/page/2/', '/archives/', '/categories/', '/categories/development/', '/tags/', '/tags/butterfly/', '/archives/preview-1/', '/archives/preview-2/', '/about-preview/']
    for name, base in BASE.items():
        results = []
        resources = set()
        for route in routes:
            response = LOCAL.open(base + route, timeout=30)
            markup = response.read().decode()
            if response.status != 200 or CONTENT['site']['title'] not in markup:
                raise RuntimeError(f'{name} route did not render expected site: {route}')
            if route == '/archives/preview-1/' and not all(x in markup for x in ['固定内容与验收范围', '正文末尾', '/lab/cover.svg']):
                raise RuntimeError(f'{name} article content mismatch')
            if route == '/':
                order = list(dict.fromkeys(re.findall(r'href=[\"\'](?:https?://[^/]+)?/archives/(preview-\d+)/?[\"\']', markup)))
                expected = [p['name'] for p in CONTENT['posts'][:CONTENT['site']['pageSize']]]
                if order[:len(expected)] != expected:
                    raise RuntimeError(f'{name} home order differs from fixture: {order}')
            parser = Resources(); parser.feed(markup); resources.update(parser.urls)
            navigation = validate_rendered_menus(markup, name)
            results.append({'path': route, 'status': response.status, 'bytes': len(markup.encode()), 'sha256': hashlib.sha256(markup.encode()).hexdigest(), 'navigation': navigation})
        assets = []
        for asset in sorted((FIXTURES / 'assets').iterdir()):
            data = LOCAL.open(base + '/lab/' + asset.name, timeout=15).read()
            if hashlib.sha256(data).hexdigest() != digest(asset):
                raise RuntimeError(f'{name} shared asset mismatch: {asset.name}')
            assets.append({'path': '/lab/' + asset.name, 'sha256': digest(asset)})
        loaded = []
        for url in sorted(resources):
            if url.startswith(('data:', '#', 'javascript:')): continue
            full = urllib.parse.urljoin(base, url)
            if urllib.parse.urlparse(full).netloc != urllib.parse.urlparse(base).netloc:
                raise RuntimeError(f'Baseline page requires an external resource: {full}')
            loaded.append({'url': url, **resource_result(full)})
        report['sites'][name] = {'url': base, 'routes': results, 'assets': assets, 'resources': loaded}
    client = Client()
    validate_content(client)
    validate_config(client, json.loads((RUNTIME / 'seed.json').read_text()))
    posts = client.api('/apis/content.halo.run/v1alpha1/posts?size=100')['items']
    names = sorted(x['metadata']['name'] for x in posts if x['spec'].get('publish'))
    if names != sorted(p['name'] for p in CONTENT['posts']):
        raise RuntimeError('Published Halo content set does not equal the fixture')
    report['haloPublishedPosts'] = names
    report['initialContentCleanup'] = json.loads((RUNTIME / 'initial-cleanup.json').read_text())
    report['taxonomies'] = {kind: CONTENT[kind] for kind in ['categories', 'tags']}
    report['menu'] = CONTENT['menu']
    report['haloPlugins'] = [{'name': x['metadata']['name'], 'enabled': x['spec'].get('enabled'), 'version': x['spec'].get('version')} for x in client.api('/apis/plugin.halo.run/v1alpha1/plugins?size=100')['items']]
    if shutil.which('jcmd'):
        pid = owned_process('halo')
        result = run(['jcmd', str(pid), 'VM.system_properties'], capture_output=True, text=True)
        properties = dict(line.split('=', 1) for line in result.stdout.splitlines() if line.startswith(('user.timezone=', 'java.version=')))
        if properties.get('user.timezone') != VERSIONS['timezone']:
            raise RuntimeError('Running JVM time zone differs from the fixed profile')
        report['verifiedJvmProperties'] = properties
    else:
        report['limitations'].append('jcmd unavailable; JVM timezone argument is configured but not independently inspected.')
    write_json(RUNTIME / 'evidence.json', report)
    print('Evidence:', RUNTIME / 'evidence.json', '— 20 routes, 4 shared assets, 12 published posts')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'start', 'bootstrap', 'install', 'seed', 'health', 'evidence', 'stop'])
    parser.add_argument('--source-sha', help='Exact git SHA of the checkout used to build --package')
    parser.add_argument('--package', help='Absolute or relative path to an already-built Halo theme ZIP')
    args = parser.parse_args()
    if args.command in ['bootstrap', 'install'] and (not args.package or not args.source_sha):
        parser.error('--package and --source-sha are required; build the intended checkout first')
    if args.command == 'prepare': prepare()
    elif args.command == 'start': start()
    elif args.command == 'bootstrap':
        prepare(); start(); client = Client(initialize=True)
        if client.initialized_now:
            capture_initial_content(client)
        if (RUNTIME / 'seed.json').exists():
            installed = json.loads((RUNTIME / 'installed-package.json').read_text())
            if installed['sha256'] != digest(args.package):
                raise RuntimeError('Bootstrap preserves installed themes; use install for an explicit upgrade')
        else:
            install(client, args.package, args.source_sha)
        seed(client)
    elif args.command == 'install': install(Client(), args.package, args.source_sha)
    elif args.command == 'seed': seed(Client())
    elif args.command == 'evidence': evidence()
    elif args.command == 'health':
        for name, url in BASE.items():
            response = LOCAL.open(url + ('/actuator/health/readiness' if name == 'halo' else '/'), timeout=15)
            print(name, response.status, url, 'owned=' + str(bool(owned_process(name))))
    elif args.command == 'stop':
        for name in BASE:
            pid = owned_process(name)
            if pid:
                os.kill(pid, signal.SIGTERM)
                print('Stopped owned process:', name, pid)
            elif listening(PORTS[name]):
                raise RuntimeError(f'Refusing to stop unowned listener: {name}')
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            if all(not owned_process(name) and not listening(PORTS[name]) for name in BASE):
                return
            time.sleep(1)
        raise RuntimeError('Owned processes are still shutting down; runtime preserved')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, subprocess.CalledProcessError) as error:
        print('Lab error:', error, file=sys.stderr)
        sys.exit(1)
