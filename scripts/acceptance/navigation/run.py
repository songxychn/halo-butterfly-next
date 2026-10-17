#!/usr/bin/env python3
"""Bounded installed-theme navigation check on an already-running owned Halo.

Creates API fixtures only. Never starts services, changes plugins, retries browser
measurements, or applies a connection workaround. Run after other lab mutations.
"""
import argparse
import hashlib
import importlib.util
import html as html_module
import json
import os
from pathlib import Path
import re
import secrets
import signal
import subprocess
import time
import urllib.parse
import zipfile

REPO = Path(__file__).resolve().parents[3]
CONSOLE = '/apis/api.console.halo.run/v1alpha1/'
CONFIG = CONSOLE + 'themes/halo-butterfly-next/json-config'
SYSTEM = '/api/v1alpha1/configmaps/system'
PLUGINS = '/apis/plugin.halo.run/v1alpha1/plugins'
OWNER = 'navigation-followup-owner'
DEFAULT_PACKAGE_SHA256 = '93b6a78ad1780dc7ae0a3a2d84955a9cdfa4c88f15a6ab9d4708d7c036c1453e'
COLLECTIONS = {
    'post': '/apis/content.halo.run/v1alpha1/posts',
    'page': '/apis/content.halo.run/v1alpha1/singlepages',
}


def digest(value):
    return hashlib.sha256(value if isinstance(value, bytes) else json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def require(value, message):
    if not value:
        raise RuntimeError(message)


def hex_digest(value, length):
    if not re.fullmatch(r'[0-9a-fA-F]{' + str(length) + '}', value):
        raise argparse.ArgumentTypeError(f'Expected exactly {length} hexadecimal characters')
    return value.lower()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--source-sha', type=lambda value: hex_digest(value, 40), required=True)
    parser.add_argument('--package-sha256', type=lambda value: hex_digest(value, 64), default=DEFAULT_PACKAGE_SHA256)
    parser.add_argument('--allow-synthetic-writes', choices=['yes'], required=True)
    parser.add_argument('--profile', choices=['three-engines', 'chromium-diagnostic'], default='three-engines')
    args = parser.parse_args()
    runtime = args.runtime.resolve(strict=True)
    require(runtime.is_relative_to(REPO / '.runtime'), 'Owned runtime outside worktree')
    marker = json.loads((runtime / 'lab.json').read_text())
    require(marker['owner'] == 'halo-butterfly-next-comparison' and marker['schema'] == 1, 'Wrong ownership marker')
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(marker['ports']['halo']), HEXO_PORT=str(marker['ports']['hexo']))
    spec = importlib.util.spec_from_file_location('navigation_lab', REPO / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lab)
    run = secrets.token_hex(10)
    output = runtime / 'navigation-followup' / run
    lock = runtime / 'acceptance-navigations.lock'
    require(not (runtime / 'acceptance-combinations.lock').exists(), 'Combination run is active')
    require(not (runtime / 'authored-image-editor.lock').exists(), 'Editor/lifecycle run is active')
    with lock.open('x') as stream:
        stream.write(run)
    lock.chmod(0o600)
    output.mkdir(parents=True, exist_ok=False)
    report = {'schema': 1, 'runId': run, 'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'status': 'running', 'declaredIdentity': {'sourceCommit': args.source_sha, 'packageSha256': args.package_sha256, 'sourceCommitAttribution': 'caller-supplied declaration; successful preflight separately checks product-source diff and installed package bytes'}, 'created': [], 'cleanup': [], 'errors': [], 'limitations': [
        'Fixed mobile light-mode profile in explicitly plugin-disabled core configuration; not whole-ecosystem PJAX.',
        'Official-plugin native fallback reuses separately attributed combination evidence; no resource deletion or script marking.',
        'No comment draft, submission/reply, physical devices, performance budgets or full 1.0 claim.',
        'Plugin preparation/restoration is owned by the coordinator and is separate from this runner; runtime starts/stops are forbidden.']}
    client = None
    original_config = original_system = before = None
    config_changed = system_changed = False
    restored = False
    def save():
        lab.write_json(output / 'report.json', report)
    def optional(url):
        try:
            return client.api(url)
        except lab.ApiError as error:
            if error.status != 404:
                raise
    def inventory(url):
        data = client.api(url + '?size=200')
        require(data.get('total', len(data['items'])) <= 200 and not data.get('hasNext'), 'Inventory exceeds fixed bound')
        return data['items']
    def identity():
        require(lab.owned_process('halo'), 'No live owned process')
        state = json.loads((runtime / 'halo-process.json').read_text())
        jar = runtime / 'halo/halo-2.26.1.jar'
        command = subprocess.check_output(['ps', '-p', str(state['pid']), '-o', 'command='], text=True)
        require(state['identity'] == str(jar) and str(jar) in command and str(runtime / 'halo/data') in command, 'Process identity mismatch')
        require('max-keep-alive-requests' not in command and 'maxKeepAliveRequests' not in command, 'Connection workaround forbidden')
        require(lab.digest(jar) == lab.VERSIONS['halo']['sha256'], 'Official Halo JAR mismatch')
        package = args.package.resolve(strict=True)
        require(package.is_relative_to(REPO), 'Package outside worktree')
        installed = json.loads((runtime / 'installed-package.json').read_text())
        package_sha256 = lab.digest(package)
        require(package_sha256 == args.package_sha256, 'Declared package SHA-256 mismatch')
        require(installed['sourceCommit'] == args.source_sha and installed['sha256'] == args.package_sha256, 'Installed package attribution mismatch')
        subprocess.run(['git', 'diff', '--exit-code', args.source_sha, '--', 'src', 'i18n', 'settings.yaml', 'theme.yaml', 'scripts/build.mjs', 'package.json', 'bun.lock', 'bunfig.toml'], cwd=REPO, check=True, stdout=subprocess.DEVNULL)
        with zipfile.ZipFile(package) as archive:
            files = [n for n in archive.namelist() if not n.endswith('/')]
            require(len(files) == len(set(files)) == 269, 'Expected 269 unique theme files')
            root = (runtime / 'halo/data/themes/halo-butterfly-next').resolve()
            for name in files:
                target = (root / name).resolve()
                require(target.is_relative_to(root) and target.read_bytes() == archive.read(name), 'Installed theme bytes differ: ' + name)
        jars = {p.name: lab.digest(p) for p in sorted((runtime / 'halo/data/plugins').glob('*.jar'))}
        return {'installed': installed, 'haloSha256': lab.digest(jar), 'packageFiles': len(files), 'pluginJars': jars}
    def station():
        active = client.api(CONSOLE + 'themes/-/activation')
        require(active['metadata']['name'] == 'halo-butterfly-next', 'Unexpected active theme')
        plugins = []
        for obj in sorted(inventory(PLUGINS), key=lambda x: x['metadata']['name']):
            config = optional('/api/v1alpha1/configmaps/' + urllib.parse.quote(obj['spec']['configMapName'], safe='')) if obj['spec'].get('configMapName') else None
            plugins.append({'name': obj['metadata']['name'], 'version': obj['spec']['version'], 'enabled': obj['spec'].get('enabled'), 'phase': obj.get('status', {}).get('phase'), 'specSha256': digest(obj['spec']), 'configSha256': digest(config.get('data', {})) if config else None})
        contents = {}
        for kind, endpoint in COLLECTIONS.items():
            rows = []
            for obj in inventory(endpoint):
                if any(r['kind'] == kind and r['name'] == obj['metadata']['name'] and obj['metadata'].get('labels', {}).get(OWNER) == run for r in report['created']):
                    continue
                row = {'name': obj['metadata']['name'], 'creationTimestamp': obj['metadata'].get('creationTimestamp'), 'specSha256': digest(obj['spec'])}
                if kind in ('post', 'page') and obj['spec'].get('publish'):
                    plural = 'posts' if kind == 'post' else 'singlepages'
                    released = client.api(CONSOLE + plural + '/' + obj['metadata']['name'] + '/release-content')
                    row['releaseSha256'] = digest(released)
                rows.append(row)
            contents[kind] = sorted(rows, key=lambda x: x['name'])
        return {'activeTheme': {'name': active['metadata']['name'], 'version': active['spec']['version']}, 'themeConfigSha256': digest(client.api(CONFIG)), 'systemDataSha256': digest(client.api(SYSTEM).get('data', {})), 'plugins': plugins, 'contents': contents}
    def check_owned(obj, row):
        require(obj['metadata']['name'] == row['name'] and obj['metadata'].get('labels', {}).get(OWNER) == run, 'Ownership mismatch')
        require(obj['metadata'].get('creationTimestamp') == row['creationTimestamp'], 'Creation timestamp changed')
        require(digest(obj['spec']) == row['specSha256'], 'Fixture spec changed unexpectedly')
    def register(kind, body, console_body=None):
        name = body['metadata']['name']
        endpoint = COLLECTIONS[kind]
        require(optional(endpoint + '/' + name) is None, 'Unique fixture name already exists')
        row = {'kind': kind, 'name': name, 'creationTimestamp': None, 'specSha256': None}
        report['created'].append(row)
        save()
        client.api(CONSOLE + 'posts' if console_body else endpoint, 'POST', console_body or body)
        obj = client.api(endpoint + '/' + name)
        require(obj['metadata'].get('labels', {}).get(OWNER) == run, 'Created label mismatch')
        require(bool(obj['metadata'].get('creationTimestamp')), 'Server creationTimestamp missing')
        row.update(creationTimestamp=obj['metadata']['creationTimestamp'], specSha256=digest(obj['spec']))
        save()
        return row
    def object_(kind, api, name, value):
        return {'kind': kind, 'apiVersion': api, 'metadata': {'name': name, 'labels': {OWNER: run}}, 'spec': value}
    save()
    try:
        report['identity'] = identity()
        report['runnerDigests'] = {p.name: lab.digest(p) for p in Path(__file__).parent.iterdir() if p.suffix in ('.py', '.mjs')}
        client = lab.Client()
        before = station()
        report['before'] = before
        require(all(p['enabled'] is False and p['phase'] == 'DISABLED' for p in before['plugins']), 'Core lane requires all installed plugins already DISABLED; coordinator restores original states separately')
        original_config = client.api(CONFIG)
        original_system = client.api(SYSTEM).get('data', {}).get('comment')
        lab.write_json(output / 'restore.private.json', {'themeConfig': original_config, 'systemComment': original_system}, private=True)
        config = json.loads(json.dumps(original_config))
        config.setdefault('pjax', {}).update(enable=True, exclude='')
        config.setdefault('comments', {}).update(lazyload=False)
        config.setdefault('render', {}).update(enable_code=True, enable_code_copy=True)
        config_changed = True
        client.api(CONFIG, 'PUT', config)
        require(client.api(CONFIG) == config, 'Theme config did not apply')
        system = client.api(SYSTEM)
        system['data']['comment'] = json.dumps({**json.loads(original_system or '{}'), 'enable': False})
        system_changed = True
        client.api(SYSTEM, 'PUT', system)
        require(client.api(SYSTEM)['data']['comment'] == system['data']['comment'], 'Comment enable did not apply')
        posts = []
        for label in ('a', 'b', 'excluded'):
            name = 'navigation-' + label + '-' + run
            title = 'Navigation ' + label + ' ' + run
            html = '<p>' + title + '</p>'
            post = object_('Post', 'content.halo.run/v1alpha1', name, {'title': title, 'slug': name, 'allowComment': False, 'deleted': False, 'pinned': False, 'priority': 0, 'publish': False, 'visible': 'PUBLIC', 'owner': client.auth['username'], 'excerpt': {'autoGenerate': True}, 'cover': '', 'tags': [], 'categories': []})
            row = register('post', post, {'post': post, 'content': {'rawType': 'HTML', 'raw': html, 'content': html}})
            def publish():
                client.api(CONSOLE + 'posts/' + name + '/publish', 'PUT')
                for _ in range(80):
                    current = client.api(COLLECTIONS['post'] + '/' + name)
                    if current['spec'].get('publish') and current.get('status', {}).get('permalink'):
                        break
                    time.sleep(.25)
                require(current['spec'].get('publish') and current.get('status', {}).get('permalink'), 'Publish did not converge')
                require(current['metadata'].get('creationTimestamp') == row['creationTimestamp'] and current['spec']['title'] == title and current['metadata'].get('labels', {}).get(OWNER) == run, 'Published identity changed')
                row['specSha256'] = digest(current['spec'])
                save()
                url = urllib.parse.urljoin(lab.BASE['halo'], current['status']['permalink'])
                require(urllib.parse.urlsplit(url).netloc == urllib.parse.urlsplit(lab.BASE['halo']).netloc, 'Post permalink origin mismatch')
                return urllib.parse.urlsplit(url).path
            path = publish()
            posts.append({'name': name, 'label': label, 'title': title, 'path': path})
        # All links come from actual published permalinks and saved API content.
        # No anchor or theme script is injected into the browser under test.
        for item, row in zip(posts, report['created']):
            name, title = item['name'], item['title']
            check_owned(client.api(COLLECTIONS['post'] + '/' + name), row)
            links = ''.join('<a id="navigation-' + other['label'] + '" href="' + html_module.escape(other['path'], quote=True) + '">' + other['label'] + '</a>' for other in posts if other != item)
            html = '<h2>' + title + '</h2>' + links + '<pre><code class="language-javascript">const navigation = 1;</code></pre><img id="navigation-image" src="/lab/avatar.svg" alt="local navigation fixture" loading="eager" width="100" height="100">'
            (output / (item['label'] + '.html')).write_text(html)
            client.api(CONSOLE + 'posts/' + name + '/content', 'PUT', {'rawType': 'HTML', 'raw': html, 'content': html})
            publish()
            for _ in range(80):
                released = client.api(CONSOLE + 'posts/' + name + '/release-content')
                if released.get('content') == html:
                    break
                time.sleep(.25)
            require(released.get('content') == html, 'Published fixture body differs')
            final = client.api(COLLECTIONS['post'] + '/' + name)
            require(final['metadata'].get('creationTimestamp') == row['creationTimestamp'] and final['metadata'].get('labels', {}).get(OWNER) == run and final['spec']['title'] == title, 'Fixture identity changed after release convergence')
            row['specSha256'] = digest(final['spec'])
            save()
            item['releaseSha256'] = digest(released)
        config['pjax']['exclude'] = posts[2]['path']
        client.api(CONFIG, 'PUT', config)
        require(client.api(CONFIG) == config, 'Exclude configuration did not apply')
        fixture = {'owner': OWNER, 'runId': run, 'base': lab.BASE['halo'], 'runtime': str(runtime), 'installed': report['identity']['installed'], 'posts': posts, 'profile': args.profile, 'engines': ['chromium'] if args.profile == 'chromium-diagnostic' else ['chromium', 'firefox', 'webkit'], 'expectedCases': 1 if args.profile == 'chromium-diagnostic' else 3}
        lab.write_json(output / 'fixture.json', fixture)
        report['ready'] = station()
        require(report['ready']['plugins'] == before['plugins'], 'Plugin state/config changed during setup')
        save()
        # This process group belongs only to the browser batch; the Halo JVM was
        # already running and is never part of it. A timeout is a failed batch,
        # not a reason to retry any measurement.
        browser = subprocess.Popen(['bun', str(Path(__file__).with_name('check.mjs')), str(output / 'fixture.json')], cwd=REPO, start_new_session=True)
        report['browserProcessGroup'] = browser.pid
        report['browserTimeoutSeconds'] = 1800
        save()
        try:
            browser.wait(timeout=1800)
        except subprocess.TimeoutExpired:
            report['browserTimedOut'] = True
            try:
                os.killpg(browser.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                browser.wait(timeout=10)
            except subprocess.TimeoutExpired:
                pass
            # Kill any same-group child still alive even if the Bun parent has
            # already exited after TERM. The group was created by this batch.
            try:
                os.killpg(browser.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            browser.wait(timeout=10)
            raise RuntimeError('Browser batch exceeded fixed 1800s limit; process group terminated; no retry')
        report['browserExitCode'] = browser.returncode
        require(browser.returncode == 0, 'Browser batch failed; preserved its report')
        report['status'] = 'passed-tested-scope'
    except Exception as error:
        report['errors'].append({'stage': 'execution', 'type': type(error).__name__, 'message': str(error)})
        report['status'] = 'failed'
    finally:
        if client:
            for row in reversed(report['created']):
                try:
                    endpoint = COLLECTIONS[row['kind']] + '/' + row['name']
                    current = optional(endpoint)
                    if current:
                        require(row['creationTimestamp'] is not None and row['specSha256'] is not None, 'Unregistered creation: manual owned-fixture inspection required')
                        check_owned(current, row)
                        client.api(endpoint, 'DELETE')
                        for _ in range(80):
                            if optional(endpoint) is None:
                                break
                            time.sleep(.25)
                        require(optional(endpoint) is None, 'Owned fixture deletion did not converge')
                    report['cleanup'].append({'kind': row['kind'], 'name': row['name'], 'deleted': True})
                except Exception as error:
                    report['errors'].append({'stage': 'cleanup', 'name': row['name'], 'message': str(error)})
            for name, changed, action in [
                ('theme', config_changed, lambda: client.api(CONFIG, 'PUT', original_config)),
                ('system', system_changed, None),
            ]:
                if changed:
                    try:
                        if name == 'theme':
                            action()
                        else:
                            system = client.api(SYSTEM)
                            if original_system is None:
                                system['data'].pop('comment', None)
                            else:
                                system['data']['comment'] = original_system
                            client.api(SYSTEM, 'PUT', system)
                    except Exception as error:
                        report['errors'].append({'stage': 'restore-' + name, 'message': str(error)})
            if before:
                try:
                    report['after'] = station()
                    report['identityAfter'] = identity()
                    require(report['after'] == before and report['identityAfter'] == report['identity'], 'Station identity did not restore')
                    require(len(report['cleanup']) == len(report['created']) and all(x['deleted'] for x in report['cleanup']), 'Not every created fixture was cleaned')
                    restored = True
                except Exception as error:
                    report['errors'].append({'stage': 'restore-verify', 'message': str(error)})
        if report['errors']:
            report['status'] = 'failed'
        report['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        # A failed preflight without mutations is safe to unlock. Once any
        # mutation is attempted, the lock remains until cleanup and complete
        # station/package verification both succeed, even if browser tests pass.
        no_mutations = not report['created'] and not config_changed and not system_changed
        report['lockReleased'] = restored or no_mutations
        report['restorationVerified'] = restored
        save()
        require(lock.read_text() == run, 'Lock ownership changed')
        if report['lockReleased']:
            lock.unlink()
        else:
            print('Lock retained for explicit restoration inspection:', lock)
    print(report['status'], output / 'report.json')
    return 0 if report['status'] == 'passed-tested-scope' else 1


if __name__ == '__main__':
    raise SystemExit(main())
