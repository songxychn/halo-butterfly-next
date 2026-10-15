#!/usr/bin/env python3
"""Anonymous RSS/Sitemap acceptance against an explicitly owned local Halo lab."""
import argparse
import copy
import hashlib
from html.parser import HTMLParser
import importlib.util
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

REPO = Path(__file__).resolve().parents[2]
OWNER = 'halo-butterfly-next-feed-sitemap'
RESOURCE = '/apis/plugin.halo.run/v1alpha1/plugins'
CONSOLE = '/apis/api.console.halo.run/v1alpha1/plugins'
POSTS = '/apis/content.halo.run/v1alpha1/posts'
POST_CONSOLE = '/apis/api.console.halo.run/v1alpha1/posts'
CONFIG = '/apis/api.console.halo.run/v1alpha1/themes/halo-butterfly-next/json-config'
PLUGINS = {
    'PluginFeed': ('1.5.0', 'd7e97df76e502c0f1bd0605d4f3a6dc8b047ed20e1de50fbbed992e95fd33a87', 'feed'),
    'PluginSitemap': ('1.3.0', '06cccf55a6d6e9369c818de7a52049fddb4b7f20bb83af52ebc329f89a637c8e', 'sitemap'),
}
NS = '{http://www.sitemaps.org/schemas/sitemap/0.9}'


def require(value, message):
    if not value:
        raise AssertionError(message)


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.head = False
        self.links = []
        self.anchors = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'head':
            self.head = True
        if tag == 'link' and self.head:
            self.links.append(attrs)
        if tag == 'a':
            self.anchors.append(attrs)

    def handle_endtag(self, tag):
        if tag == 'head':
            self.head = False


def check_page(markup, base, rss, sitemap, canonical=None):
    page = Page(); page.feed(markup)
    for enabled, path, rel, kind, marker in [
        (rss, '/rss.xml', 'alternate', 'application/rss+xml', 'data-theme-rss'),
        (sitemap, '/sitemap.xml', 'sitemap', 'application/xml', 'data-theme-sitemap'),
    ]:
        # Count all equivalent discovery links, including unwanted external injection duplicates.
        links = [x for x in page.links if rel in x.get('rel', '').split()
                 and (rel == 'sitemap' or x.get('type') == kind)]
        require(len(links) == int(enabled), 'Missing/duplicate discovery link: ' + path)
        anchors = [x for x in page.anchors if marker in x]
        require(len(anchors) == int(enabled), 'Missing/duplicate footer link: ' + path)
        for link in links + anchors:
            require(urllib.parse.urljoin(base, link.get('href', '')) == base + path, 'Wrong subscription destination')
    if canonical:
        links = [x for x in page.links if x.get('rel') == 'canonical']
        require(len(links) == 1 and links[0].get('href') == canonical, 'Canonical must match the public permalink')
    return {'rssHead': int(rss), 'sitemapHead': int(sitemap), 'rssFooter': int(rss), 'sitemapFooter': int(sitemap), 'canonical': canonical}


def rss_items(body):
    root = ET.fromstring(body)
    require(root.tag == 'rss' and root.get('version') == '2.0', 'Not RSS 2.0')
    channel = root.find('channel')
    require(channel is not None, 'RSS channel missing')
    items = channel.findall('item')
    links = [x.findtext('link') for x in items]
    require(all(links) and len(links) == len(set(links)), 'Missing/duplicate RSS item link')
    return {x.findtext('link'): {'title': x.findtext('title'), 'description': x.findtext('description') or ''} for x in items}


def sitemap_items(body):
    root = ET.fromstring(body)
    require(root.tag == NS + 'urlset', 'Not sitemap urlset')
    urls = root.findall(NS + 'url')
    links = [x.findtext(NS + 'loc') for x in urls]
    require(all(links) and len(links) == len(set(links)), 'Missing/duplicate sitemap loc')
    return {x.findtext(NS + 'loc'): x.findtext(NS + 'lastmod') for x in urls}


def check_members(items, present, absent):
    require(set(present) <= set(items), 'Public fixture missing: ' + ', '.join(sorted(set(present) - set(items))))
    require(not set(absent).intersection(items), 'Private/draft fixture leaked into XML')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', required=True, type=Path)
    parser.add_argument('--allow-synthetic-writes', choices=['yes'], required=True)
    args = parser.parse_args()
    runtime = args.runtime.resolve()
    require(runtime.is_relative_to(REPO / '.runtime'), 'Only this worktree runtime is allowed')
    marker = json.loads((runtime / 'lab.json').read_text())
    require(marker.get('owner') == 'halo-butterfly-next-comparison' and marker.get('schema') == 1, 'Lab ownership mismatch')
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(marker['ports']['halo']), HEXO_PORT=str(marker['ports']['hexo']))
    spec = importlib.util.spec_from_file_location('feed_sitemap_lab', REPO / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(spec); spec.loader.exec_module(lab)
    require(lab.owned_process('halo') and (runtime / 'seed.json').exists(), 'Owned seeded process required')
    require(lab.digest(runtime / 'halo' / lab.HALO_JAR_NAME) == lab.VERSIONS['halo']['sha256'], 'Halo digest mismatch')
    client = lab.Client()
    base = lab.BASE['halo']
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    report = {'schema': 1, 'owner': OWNER, 'baseUrl': base, 'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip(),
              'package': json.loads((runtime / 'installed-package.json').read_text()), 'plugins': {}, 'stages': [],
              'limitations': ['HTTP/anonymous data and template contract only; no browser visual, reader-client or full 1.0 acceptance.',
                              'Absent-plugin and older-version states are not exercised by disabling installed plugins.',
                              'Sitemap may retain public links for its documented 30-second cache lifetime.']}
    run = secrets.token_hex(5)
    report['runId'] = run
    evidence = runtime / 'feed-sitemap-evidence.json'
    out = runtime / 'feed-sitemap-responses' / run; out.mkdir(parents=True)
    request_counter = 0
    initial_plugins = {}
    for name, (version, sha, slug) in PLUGINS.items():
        plugin = client.api(RESOURCE + '/' + name)
        require(plugin['spec']['version'] == version, 'Plugin version mismatch: ' + name)
        jars = [p for p in (runtime / 'halo/data/plugins').glob('*.jar') if lab.digest(p) == sha]
        require(len(jars) == 1, 'Locked official JAR digest missing/ambiguous: ' + name)
        initial_plugins[name] = bool(plugin['spec'].get('enabled'))
        report['plugins'][name] = {'version': version, 'sha256': sha, 'initialEnabled': initial_plugins[name]}
    original = client.api(CONFIG)
    names = {kind: 'feed-sitemap-' + run + '-' + kind for kind in ['public', 'draft', 'private']}
    snapshot = runtime / ('feed-sitemap-original-' + run + '.private.json')
    lab.write_json(snapshot, {'owner': OWNER, 'config': original, 'plugins': initial_plugins, 'names': names}, private=True)
    made = []

    def save():
        lab.write_json(evidence, report)
        lab.write_json(out / 'evidence.json', report)

    def record(stage, detail):
        report['stages'].append({'stage': stage, 'result': 'passed', **detail}); save()
        print('Feed/Sitemap:', stage, 'passed', flush=True)

    def fetch(path, accept, stage):
        nonlocal request_counter
        request_counter += 1
        req = urllib.request.Request(base + path, headers={'Accept': accept})
        try:
            with opener.open(req, timeout=20) as response:
                status, kind, body = response.status, response.headers.get_content_type(), response.read()
        except urllib.error.HTTPError as error:
            status, kind, body = error.code, error.headers.get_content_type(), error.read()
        filename = str(request_counter).zfill(4) + '-' + stage + '-' + path.strip('/').replace('/', '-')
        if not filename.split('-')[-1]:
            filename += 'index.html'
        (out / filename).write_bytes(body)
        return status, kind, body

    def html(path, stage, rss=True, sitemap=True, canonical=None):
        status, kind, body = fetch(path, 'text/html', stage)
        require(status == 200 and kind == 'text/html', 'HTML endpoint failed: ' + path)
        return check_page(body.decode(), base, rss, sitemap, canonical)

    def xml(path, stage):
        status, kind, body = fetch(path, 'text/xml, application/rss+xml, application/xml', stage)
        require(status == 200 and kind in ['text/xml', 'application/xml', 'application/rss+xml'], 'XML endpoint failed: ' + path)
        return (rss_items(body) if path == '/rss.xml' else sitemap_items(body)), hashlib.sha256(body).hexdigest()

    def set_enabled(name, value):
        client.api(CONSOLE + '/' + name + '/plugin-state', 'PUT', {'enable': value, 'async': False})
        for _ in range(40):
            state = client.api(RESOURCE + '/' + name)
            if bool(state['spec'].get('enabled')) == value and (state.get('status', {}).get('phase') == 'STARTED') == value:
                return
            time.sleep(.25)
        raise RuntimeError('Plugin did not reach requested state: ' + name)

    def config(rss, sitemap):
        current = client.api(CONFIG)
        current['subscription'] = {'rss': rss, 'sitemap': sitemap}
        client.api(CONFIG, 'PUT', current)

    def owned(name):
        post = client.api(POSTS + '/' + name)
        require(post['metadata'].get('labels', {}).get('feed-sitemap-owner') == run, 'Fixture ownership mismatch')
        return post

    def patch(name, values):
        for attempt in range(4):
            post = owned(name); post['spec'].update(values)
            try:
                return client.api(POSTS + '/' + name, 'PUT', post)
            except lab.ApiError as error:
                if error.status != 409 or attempt == 3:
                    raise
                time.sleep(.1 * (2 ** attempt))

    def check_xml(stage, public, excluded, expected_title=None, old_modified=None, expected_body=None):
        proofs = {}
        for path, timeout in [('/rss.xml', 10), ('/sitemap.xml', 35)]:
            start = time.monotonic()
            # Only expected publication/cache propagation is polled; transport/parse failures are fatal.
            while True:
                items, sha = xml(path, stage)
                try:
                    check_members(items, public, excluded)
                    if expected_title:
                        require(items[urls['public']]['title'] == expected_title if path == '/rss.xml' else bool(items[urls['public']]), 'Published update not reflected')
                    if expected_body is not None and path == '/rss.xml':
                        require(expected_body in items[urls['public']]['description'], 'Published body update not reflected in RSS description')
                    if old_modified is not None and path == '/sitemap.xml':
                        require(items[urls['public']] != old_modified, 'Sitemap lastmod did not change')
                    break
                except AssertionError:
                    if time.monotonic() - start >= timeout:
                        raise
                    time.sleep(.5)
            proofs[path] = {'sha256': sha, 'items': len(items), 'propagationSeconds': round(time.monotonic() - start, 3)}
            if path == '/sitemap.xml' and urls['public'] in items:
                proofs['lastmod'] = items[urls['public']]
        return proofs

    try:
        config(True, True)
        for name in PLUGINS:
            set_enabled(name, True)
        for kind, name in names.items():
            title = 'RSS Sitemap ' + kind + ' ' + run
            content = '<p>' + title + ' original published body</p>'
            obj = {'apiVersion': 'content.halo.run/v1alpha1', 'kind': 'Post',
                   'metadata': {'name': name, 'labels': {'feed-sitemap-owner': run}},
                   'spec': {'title': title, 'slug': name, 'allowComment': False, 'deleted': False, 'pinned': False, 'priority': 0,
                            'publish': False, 'visible': 'PRIVATE' if kind == 'private' else 'PUBLIC', 'owner': client.auth['username'],
                            'excerpt': {'autoGenerate': True}, 'cover': '', 'publishTime': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'tags': [], 'categories': []}}
            # Fail if a name exists; never adopt an unrelated object.
            client.api(POST_CONSOLE, 'POST', {'post': obj, 'content': {'content': content, 'raw': content, 'rawType': 'HTML'}})
            made.append(name)
            if kind != 'draft':
                client.api(POST_CONSOLE + '/' + name + '/publish', 'PUT')
        urls = {}
        for kind, name in names.items():
            for _ in range(40):
                permalink = owned(name).get('status', {}).get('permalink')
                if permalink:
                    urls[kind] = urllib.parse.urljoin(base, permalink); break
                time.sleep(.25)
            else:
                raise RuntimeError('Fixture permalink missing: ' + kind)
        report['fixtureUrls'] = urls
        first = check_xml('public-private-draft', [urls['public']], [urls['private'], urls['draft']])
        record('public-private-draft', first)
        post_path = urllib.parse.urlsplit(urls['public']).path
        record('head-footer-canonical', {'home': html('/', 'home'), 'post': html(post_path, 'post', canonical=urls['public'])})
        old_modified = first['lastmod']
        time.sleep(1.1)  # Sitemap lastmod is serialized to seconds.
        title = 'RSS Sitemap updated ' + run
        patch(names['public'], {'title': title})
        updated_body = '<p>RSS Sitemap updated published body ' + run + '</p>'
        client.api(POST_CONSOLE + '/' + names['public'] + '/content', 'PUT', {'raw': updated_body, 'content': updated_body, 'rawType': 'HTML'})
        client.api(POST_CONSOLE + '/' + names['public'] + '/publish', 'PUT')
        record('published-update', check_xml('published-update', [urls['public']], [urls['private'], urls['draft']], title, old_modified, 'RSS Sitemap updated published body ' + run))
        patch(names['public'], {'visible': 'PRIVATE'})
        record('public-to-private', check_xml('public-to-private', [], list(urls.values())))
        for rss, sitemap in [(False, True), (True, False), (False, False)]:
            config(rss, sitemap)
            record('settings-' + str(rss) + '-' + str(sitemap), {'home': html('/', 'settings-' + str(rss) + str(sitemap), rss, sitemap)})
            xml('/rss.xml', 'settings-rss-still-routed'); xml('/sitemap.xml', 'settings-sitemap-still-routed')
        config(True, True)
        for name, (_, _, slug) in PLUGINS.items():
            set_enabled(name, False)
            path = '/rss.xml' if slug == 'feed' else '/sitemap.xml'
            page = html('/', 'disabled-' + slug, slug != 'feed', slug != 'sitemap')
            status, _, _ = fetch(path, 'text/xml, application/rss+xml', 'disabled-' + slug)
            require(status == 404, 'Stopped plugin still serves route or unexpected error: ' + path)
            record('disabled-' + slug, {'home': page, 'routeStatus': status})
            set_enabled(name, True)
            record('restarted-' + slug, {'home': html('/', 'restarted-' + slug), 'xmlSha256': xml(path, 'restarted-' + slug)[1]})
        report['result'] = 'passed'
    except Exception as error:
        report['result'] = 'failed'; report['error'] = str(error)
        raise
    finally:
        errors = []
        for name in reversed(made):
            try:
                owned(name)
                client.api(POSTS + '/' + name, 'DELETE')
                for _ in range(80):
                    try:
                        owned(name)
                    except lab.ApiError as error:
                        if error.status != 404:
                            raise
                        break
                    time.sleep(.25)
                else:
                    raise RuntimeError('Deleted fixture still exists')
            except Exception as error:
                errors.append('fixture ' + name + ': ' + str(error))
        try:
            current = client.api(CONFIG)
            if 'subscription' in original:
                current['subscription'] = copy.deepcopy(original['subscription'])
            else:
                current.pop('subscription', None)
            client.api(CONFIG, 'PUT', current)
            restored = client.api(CONFIG)
            require(restored == original, 'Theme configuration differs after restoration (subscription or unrelated group)')
        except Exception as error:
            errors.append('theme config: ' + str(error))
        for name, value in initial_plugins.items():
            try:
                set_enabled(name, value)
            except Exception as error:
                errors.append('plugin ' + name + ': ' + str(error))
        report['restoration'] = {'result': 'failed' if errors else 'passed', 'errors': errors, 'snapshot': snapshot.name}
        if errors:
            report['result'] = 'failed'
        save()
        if errors:
            raise RuntimeError('Restoration requires attention: ' + '; '.join(errors))
    print('Evidence:', evidence, flush=True)


if __name__ == '__main__':
    main()
