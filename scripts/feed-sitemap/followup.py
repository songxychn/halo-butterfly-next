#!/usr/bin/env python3
"""Current-candidate RSS/Sitemap contracts plus a persistent local reader client.

Only an already-running, task-owned Halo 2.26.1 lab and pinned official plugins.
Measurements are not retried. Publication/cache/state convergence polls are
bounded and archived; no transport/keepalive mitigations are configured.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import check

REPO = check.REPO
OWNER = 'halo-butterfly-next-feed-followup'
LABEL = 'feed-followup-owner'
PRODUCT = ['src', 'i18n', 'settings.yaml', 'theme.yaml', 'scripts/build.mjs', 'package.json', 'bun.lock', 'bunfig.toml']


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--reader-python', type=Path, required=True)
    parser.add_argument('--allow-synthetic-writes', choices=['yes'], required=True)
    args = parser.parse_args()
    runtime = args.runtime.resolve(strict=True)
    check.require(runtime.is_relative_to(REPO / '.runtime'), 'Owned runtime required')
    marker = json.loads((runtime / 'lab.json').read_text())
    check.require(marker.get('owner') == 'halo-butterfly-next-comparison' and marker.get('schema') == 1, 'Lab marker mismatch')
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(marker['ports']['halo']), HEXO_PORT=str(marker['ports']['hexo']))
    spec = importlib.util.spec_from_file_location('feed_followup_lab', REPO / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(spec); spec.loader.exec_module(lab)
    reader_python = args.reader_python.absolute()
    check.require(reader_python.is_relative_to(REPO / '.runtime') and reader_python.exists(), 'Task-local reader venv required')
    check.require(subprocess.check_output([str(reader_python), '-c', 'import importlib.metadata; print(importlib.metadata.version("reader"))'], text=True).strip() == '3.26', 'reader 3.26 required')
    run_id = secrets.token_hex(12)
    output = runtime / 'feed-sitemap-followup' / run_id
    lock = runtime / 'authored-image-editor.lock'
    with lock.open('x') as stream:
        stream.write(run_id + '\n')
    lock.chmod(0o600)
    output.mkdir(parents=True, exist_ok=False)
    report = {'schema': 1, 'owner': OWNER, 'runId': run_id, 'status': 'running', 'sourceSha': args.source_sha,
              'runnerHead': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip(),
              'runnerSha256': lab.digest(Path(__file__)), 'checkModuleSha256': lab.digest(Path(check.__file__)),
              'readerRunnerSha256': lab.digest(Path(__file__).with_name('reader-client.py')),
              'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'stages': [], 'reader': [], 'fixtures': [], 'cleanup': [], 'errors': [],
              'limitations': ['Current candidate HTTP/XML and public reader-library integration; no browser visual, GUI-reader, device or performance claim.',
                              'Disabled plugins are not absent plugins; old-version and uninstall/reinstall proofs remain separate.',
                              'Previously downloaded public RSS entries may remain in a subscriber database after the publisher makes the post private.',
                              'Polling is limited to asynchronous publication, documented Sitemap cache expiry, plugin state and deletion; transport/parse failures fail immediately.'],
              'productionChanges': False, 'temporaryMitigation': False}
    client = None
    before = None
    original_config = None
    initial_plugins = {}
    planned = []
    counter = 0
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), check.NoRedirect())

    def save():
        lab.write_json(output / 'report.json', report)

    def archive(name, body):
        target = output / name
        with target.open('xb') as stream:
            stream.write(body.encode() if isinstance(body, str) else body)
        return {'path': name, 'sha256': lab.digest(target), 'bytes': target.stat().st_size}

    def fail(context, error):
        report['status'] = 'failed'
        report['errors'].append({'context': context, 'type': type(error).__name__, 'message': str(error)})
        save()

    def optional(path):
        try:
            return client.api(path)
        except lab.ApiError as error:
            if error.status == 404:
                return None
            raise

    def inventory(path):
        value = client.api(path + '?size=200')
        check.require(value.get('total', len(value['items'])) <= 200 and not value.get('hasNext'), 'Inventory exceeds fixed bound')
        return value['items']

    def identity():
        check.require(lab.owned_process('halo'), 'Owned running Halo required')
        process = json.loads((runtime / 'halo-process.json').read_text())
        jar = runtime / 'halo/halo-2.26.1.jar'
        check.require(process['identity'] == str(jar), 'Process JAR identity mismatch')
        command = subprocess.check_output(['ps', '-p', str(process['pid']), '-o', 'command='], text=True)
        check.require(str(jar) in command and str(runtime / 'halo/data') in command, 'Process runtime mismatch')
        check.require('max-keep-alive-requests' not in command and 'maxKeepAliveRequests' not in command, 'Connection workaround forbidden')
        check.require(lab.digest(jar) == lab.VERSIONS['halo']['sha256'], 'Official Halo JAR mismatch')
        check.require(re.fullmatch('[a-f0-9]{40}', args.source_sha), 'Full source SHA required')
        package = args.package.resolve(strict=True)
        check.require(package.is_relative_to(REPO), 'Package must belong to worktree')
        installed = json.loads((runtime / 'installed-package.json').read_text())
        check.require(installed['sourceCommit'] == args.source_sha and installed['sha256'] == lab.digest(package), 'Installed candidate attribution mismatch')
        subprocess.run(['git', 'diff', '--exit-code', args.source_sha, '--', *PRODUCT], cwd=REPO, check=True, stdout=subprocess.DEVNULL)
        check.require(not subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard', '--', *PRODUCT], cwd=REPO, text=True).strip(), 'Untracked product input')
        root = (runtime / 'halo/data/themes/halo-butterfly-next').resolve()
        with zipfile.ZipFile(package) as zipped:
            files = [name for name in zipped.namelist() if not name.endswith('/')]
            check.require(len(files) == len(set(files)) == 269, 'Expected 269 unique package files')
            for name in files:
                path = (root / name).resolve()
                check.require(path.is_relative_to(root) and path.read_bytes() == zipped.read(name), 'Installed file differs: ' + name)
        jars = {path.name: lab.digest(path) for path in sorted((runtime / 'halo/data/plugins').glob('*.jar'))}
        for name, (_, digest, _) in check.PLUGINS.items():
            check.require(list(jars.values()).count(digest) == 1, 'Pinned official plugin JAR missing/ambiguous: ' + name)
        return {'pid': process['pid'], 'haloSha256': lab.digest(jar), 'installed': installed, 'installedRecordSha256': lab.digest(runtime / 'installed-package.json'), 'packageFiles': len(files), 'pluginJars': jars}

    def station():
        active = client.api('/apis/api.console.halo.run/v1alpha1/themes/-/activation')
        check.require(active['metadata']['name'] == lab.THEME and active['spec']['version'] == report['identity']['installed']['version'], 'Wrong active theme')
        plugins = []
        for item in sorted(inventory(check.RESOURCE), key=lambda p: p['metadata']['name']):
            cfg = optional('/api/v1alpha1/configmaps/' + urllib.parse.quote(item['spec']['configMapName'], safe='')) if item['spec'].get('configMapName') else None
            plugins.append({'name': item['metadata']['name'], 'creationTimestamp': item['metadata'].get('creationTimestamp'),
                            'version': item['spec']['version'], 'enabled': item['spec'].get('enabled'), 'phase': item.get('status', {}).get('phase'),
                            'specSha256': fingerprint({key: value for key, value in item['spec'].items() if key != 'enabled'}), 'configSha256': fingerprint(cfg.get('data', {})) if cfg else None})
        contents = {}
        for kind in ('posts', 'singlepages'):
            rows = []
            for item in inventory('/apis/content.halo.run/v1alpha1/' + kind):
                if kind == 'posts' and any(item['metadata']['name'] == fixture['name'] and item['metadata'].get('labels', {}).get(LABEL) == run_id for fixture in planned):
                    continue
                release = client.api('/apis/api.console.halo.run/v1alpha1/' + kind + '/' + item['metadata']['name'] + '/release-content') if item['spec'].get('publish') else None
                rows.append({'name': item['metadata']['name'], 'creationTimestamp': item['metadata'].get('creationTimestamp'), 'specSha256': fingerprint(item['spec']), 'releaseSha256': fingerprint(release) if release else None})
            contents[kind] = sorted(rows, key=lambda row: row['name'])
        return {'theme': {'name': active['metadata']['name'], 'creationTimestamp': active['metadata'].get('creationTimestamp'), 'version': active['spec']['version']},
                'themeConfigSha256': fingerprint(client.api(check.CONFIG)), 'systemConfigSha256': fingerprint(client.api('/api/v1alpha1/configmaps/system').get('data', {})), 'plugins': plugins, 'contents': contents}

    def owned(item, register=False):
        post = client.api(check.POSTS + '/' + item['name'])
        meta = post['metadata']
        check.require(meta['name'] == item['name'] and meta.get('labels', {}).get(LABEL) == run_id and post['spec']['owner'] == client.auth['username'], 'Fixture ownership mismatch')
        check.require(post['spec']['title'] in item['allowedTitles'], 'Fixture title mismatch')
        check.require(isinstance(meta.get('creationTimestamp'), str) and meta['creationTimestamp'], 'Fixture creation timestamp missing')
        if item.get('creationTimestamp') is None and register:
            item['creationTimestamp'] = meta['creationTimestamp']
            if meta.get('uid') is not None:
                item['uid'] = meta['uid']
            save()
        check.require(meta['creationTimestamp'] == item.get('creationTimestamp'), 'Fixture creation timestamp changed')
        check.require(meta.get('uid') == item.get('uid'), 'Optional fixture UID changed')
        return post

    def set_plugin(name, enabled):
        client.api(check.CONSOLE + '/' + name + '/plugin-state', 'PUT', {'enable': enabled, 'async': False})
        for _ in range(80):
            item = client.api(check.RESOURCE + '/' + name)
            if item['spec'].get('enabled') == enabled and item.get('status', {}).get('phase') == ('STARTED' if enabled else 'DISABLED'):
                return
            time.sleep(.25)
        raise RuntimeError('Plugin state did not converge: ' + name)

    def configure(rss=True, sitemap=True):
        config = copy.deepcopy(original_config)
        config['subscription'] = {'rss': rss, 'sitemap': sitemap}
        client.api(check.CONFIG, 'PUT', config)

    def fetch(path, stage, accept):
        nonlocal counter
        counter += 1
        req = urllib.request.Request(lab.BASE['halo'] + path, headers={'Accept': accept})
        try:
            with opener.open(req, timeout=20) as response:
                status, kind, body = response.status, response.headers.get_content_type(), response.read()
        except urllib.error.HTTPError as error:
            status, kind, body = error.code, error.headers.get_content_type(), error.read()
        reference = archive(f'{counter:04d}-{stage}-response.bin', body)
        row = {'stage': stage, 'path': path, 'status': status, 'contentType': kind, **reference}
        report.setdefault('requests', []).append(row); save()
        return row, body

    def page(path, stage, rss=True, sitemap=True, canonical=None):
        response, body = fetch(path, stage, 'text/html')
        check.require(response['status'] == 200 and response['contentType'] == 'text/html', 'HTML endpoint failed')
        return {'response': response, 'assertions': check.check_page(body.decode(), lab.BASE['halo'], rss, sitemap, canonical)}

    def xml(path, stage):
        response, body = fetch(path, stage, 'application/rss+xml,application/xml,text/xml')
        check.require(response['status'] == 200 and response['contentType'] in ('text/xml', 'application/xml', 'application/rss+xml'), 'XML endpoint failed: ' + path)
        return (check.rss_items(body) if path == '/rss.xml' else check.sitemap_items(body)), response

    def record(stage, **detail):
        report['stages'].append({'stage': stage, 'status': 'passed', **detail}); save()
        print(stage + ': passed', flush=True)

    def propagation(stage, public, excluded, title=None, body=None, old_modified=None):
        proof = {}
        for path, limit in [('/rss.xml', 10), ('/sitemap.xml', 35)]:
            start = time.monotonic()
            polls = 0
            while True:
                polls += 1
                items, response = xml(path, stage)
                try:
                    check.check_members(items, public, excluded)
                    if title and path == '/rss.xml':
                        check.require(items[public[0]]['title'] == title and body in items[public[0]]['description'], 'Published RSS update not reflected')
                    if old_modified and path == '/sitemap.xml':
                        check.require(items[public[0]] != old_modified, 'Sitemap lastmod did not change')
                    break
                except AssertionError:
                    if time.monotonic() - start >= limit:
                        raise
                    time.sleep(.5)
            proof[path] = {'response': response, 'items': len(items), 'polls': polls, 'propagationSeconds': round(time.monotonic() - start, 3)}
            if public and path == '/sitemap.xml':
                proof['lastmod'] = items[public[0]]
                check.require(proof['lastmod'], 'Public Sitemap lastmod missing')
        return proof

    def reader(phase, public=None, excluded=None, title=None, body=None):
        plan = {'owner': OWNER, 'phase': phase, 'runId': run_id, 'feedUrl': lab.BASE['halo'] + '/rss.xml', 'publicUrl': public, 'excluded': excluded or [], 'title': title, 'bodyMarker': body}
        plan_path = output / ('reader-' + phase + '-plan.json')
        lab.write_json(plan_path, plan)
        result_path = output / ('reader-' + phase + '.json')
        process = subprocess.run([str(reader_python), str(Path(__file__).with_name('reader-client.py')), '--plan', str(plan_path)], capture_output=True, text=True, timeout=60)
        archive('reader-' + phase + '-process.log', process.stdout + process.stderr)
        result = json.loads(result_path.read_text()) if result_path.exists() else {'status': 'missing-report'}
        report['reader'].append({'phase': phase, 'exitCode': process.returncode, 'report': result_path.name, 'sha256': lab.digest(result_path) if result_path.exists() else None, 'result': result}); save()
        check.require(process.returncode == 0 and result['status'] == 'passed', 'Reader phase failed: ' + phase)
        return result

    def patch(item, **values):
        # Optimistic conflicts are retained as failures, not silently replayed.
        current = owned(item)
        current['spec'].update(values)
        client.api(check.POSTS + '/' + item['name'], 'PUT', current)

    save()
    try:
        report['identity'] = identity()
        client = lab.Client()
        before = station(); report['before'] = before
        original_config = client.api(check.CONFIG)
        for name, (version, _, _) in check.PLUGINS.items():
            plugin = next(p for p in before['plugins'] if p['name'] == name)
            check.require(plugin['version'] == version and plugin['phase'] == ('STARTED' if plugin['enabled'] else 'DISABLED'), 'Expected settled pinned plugin')
            initial_plugins[name] = plugin['enabled']
        lab.write_json(output / 'original.private.json', {'owner': OWNER, 'config': original_config, 'plugins': initial_plugins}, private=True)
        configure()
        for name in check.PLUGINS:
            set_plugin(name, True)
        for kind in ('public', 'draft', 'private'):
            title = 'RSS Sitemap ' + kind + ' ' + run_id
            item = {'kind': kind, 'name': 'feed-followup-' + run_id + '-' + kind, 'allowedTitles': [title], 'title': title}
            check.require(optional(check.POSTS + '/' + item['name']) is None, 'Fixture name already exists')
            planned.append(item); report['fixtures'].append(item); save()
            content = '<p>RSS original body ' + run_id + ' ' + kind + '</p>'
            post = {'apiVersion': 'content.halo.run/v1alpha1', 'kind': 'Post', 'metadata': {'name': item['name'], 'labels': {LABEL: run_id}},
                    'spec': {'title': title, 'slug': item['name'], 'owner': client.auth['username'], 'allowComment': False, 'deleted': False, 'pinned': False, 'priority': 0, 'publish': False,
                             'visible': 'PRIVATE' if kind == 'private' else 'PUBLIC', 'excerpt': {'autoGenerate': True}, 'cover': '', 'tags': [], 'categories': []}}
            client.api(check.POST_CONSOLE, 'POST', {'post': post, 'content': {'content': content, 'raw': content, 'rawType': 'HTML'}})
            owned(item, register=True)
            if kind != 'draft':
                client.api(check.POST_CONSOLE + '/' + item['name'] + '/publish', 'PUT')
            for _ in range(80):
                current = owned(item)
                if current.get('status', {}).get('permalink') and (kind == 'draft' or current['spec'].get('publish')):
                    break
                time.sleep(.25)
            check.require(current.get('status', {}).get('permalink') and (kind == 'draft' or current['spec'].get('publish')), 'Fixture publish/permalink did not converge')
            item['url'] = urllib.parse.urljoin(lab.BASE['halo'], current['status']['permalink'])
            check.require(urllib.parse.urlsplit(item['url']).netloc == urllib.parse.urlsplit(lab.BASE['halo']).netloc and urllib.parse.urlsplit(item['url']).scheme == 'http', 'Fixture permalink outside owned origin')
            item['initialResource'] = archive(kind + '-initial-resource.json', json.dumps(current, ensure_ascii=False, indent=2) + '\n')
        public, draft, private = planned
        excluded = [draft['url'], private['url']]
        first = propagation('public-private-draft', [public['url']], excluded)
        record('public-private-draft', **first)
        post_path = urllib.parse.urlsplit(public['url']).path
        record('head-footer-canonical', home=page('/', 'home'), post=page(post_path, 'post', canonical=public['url']))
        first_reader = reader('initial', public['url'], excluded, public['title'], 'RSS original body ' + run_id + ' public')
        time.sleep(1.1)  # Official Sitemap serializes lastmod to whole seconds.
        updated_title = 'RSS Sitemap updated ' + run_id
        public['allowedTitles'].append(updated_title); save()
        patch(public, title=updated_title)
        updated_marker = 'RSS updated published body ' + run_id
        updated = '<p>' + updated_marker + '</p>'
        client.api(check.POST_CONSOLE + '/' + public['name'] + '/content', 'PUT', {'raw': updated, 'content': updated, 'rawType': 'HTML'})
        client.api(check.POST_CONSOLE + '/' + public['name'] + '/publish', 'PUT')
        record('published-update', **propagation('published-update', [public['url']], excluded, updated_title, updated_marker, first['lastmod']))
        report['updatedResource'] = archive('public-updated-resource.json', json.dumps(owned(public), ensure_ascii=False, indent=2) + '\n')
        second_reader = reader('updated', public['url'], excluded, updated_title, updated_marker)
        check.require(second_reader['entryId'] == first_reader['entryId'], 'Reader update created a new identity')
        repeat_reader = reader('repeat', public['url'], excluded, updated_title, updated_marker)
        check.require(repeat_reader['entryId'] == first_reader['entryId'] and repeat_reader['totalEntries'] == second_reader['totalEntries'], 'Repeated refresh duplicated entries')
        patch(public, visible='PRIVATE')
        record('public-to-private', **propagation('public-to-private', [], [item['url'] for item in planned]))
        reader('private-fresh', excluded=[item['url'] for item in planned])
        for rss, sitemap in [(False, True), (True, False), (False, False)]:
            configure(rss, sitemap)
            stage = 'settings-' + str(rss) + '-' + str(sitemap)
            proof = page('/', stage, rss, sitemap)
            routes = {path: xml(path, stage)[1] for path in ('/rss.xml', '/sitemap.xml')}
            record(stage, home=proof, pluginRoutesUnaffected=routes)
        configure()
        for name, (_, _, slug) in check.PLUGINS.items():
            set_plugin(name, False)
            path = '/rss.xml' if slug == 'feed' else '/sitemap.xml'
            stage = 'disabled-' + slug
            proof = page('/', stage, slug != 'feed', slug != 'sitemap')
            response, _ = fetch(path, stage, 'application/xml')
            check.require(response['status'] == 404, 'Disabled plugin route must return 404')
            record(stage, home=proof, route=response)
            set_plugin(name, True)
            stage = 'restarted-' + slug
            record(stage, home=page('/', stage), xml=xml(path, stage)[1])
        report['status'] = 'completed'
    except Exception as error:
        fail('measurement', error)
    finally:
        if client is not None:
            for item in reversed(planned):
                cleanup = {'name': item['name']}; report['cleanup'].append(cleanup)
                try:
                    current = optional(check.POSTS + '/' + item['name'])
                    if current is not None:
                        # Registration may have been interrupted after a successful create.
                        owned(item, register=item.get('creationTimestamp') is None)
                        client.api(check.POSTS + '/' + item['name'], 'DELETE')
                    for _ in range(80):
                        if optional(check.POSTS + '/' + item['name']) is None:
                            cleanup['status'] = 'deleted'; cleanup['apiStatus'] = 404; break
                        time.sleep(.25)
                    check.require(cleanup.get('status') == 'deleted', 'Fixture deletion did not converge')
                except Exception as error:
                    cleanup['status'] = 'failed'; fail('fixture cleanup ' + item['name'], error)
                save()
            if original_config is not None:
                try:
                    client.api(check.CONFIG, 'PUT', original_config)
                    check.require(client.api(check.CONFIG) == original_config, 'Theme config restoration differs')
                    report['themeConfigRestored'] = True
                except Exception as error:
                    fail('theme config restoration', error)
            for name, enabled in initial_plugins.items():
                try:
                    set_plugin(name, enabled)
                except Exception as error:
                    fail('plugin restoration ' + name, error)
            if before is not None:
                try:
                    report['after'] = station()
                    check.require(report['after'] == before, 'Original content/config/plugin state differs after restoration')
                    report['stationRestored'] = True
                    report['finalIdentity'] = identity()
                    check.require(report['finalIdentity'] == report['identity'], 'Runtime/package/plugin artifact changed')
                except Exception as error:
                    fail('final invariants', error)
        safe = all(item.get('status') == 'deleted' for item in report['cleanup']) and len(report['cleanup']) == len(planned)
        safe = safe and (before is None or report.get('stationRestored'))
        if safe:
            check.require(lock.read_text().strip() == run_id, 'Lock ownership mismatch')
            lock.unlink()
        else:
            report['lockRetained'] = True
        report['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        save()
    print(json.dumps({'status': report['status'], 'output': str(output), 'stages': len(report['stages']), 'readerPhases': len(report['reader']), 'errors': len(report['errors'])}))
    return 0 if report['status'] == 'completed' else 1


if __name__ == '__main__':
    sys.exit(main())
