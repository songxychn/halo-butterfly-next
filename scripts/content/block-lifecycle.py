#!/usr/bin/env python3
"""Read lifecycle of archived editor HTML in an already-running owned Halo lab.

Recreates two archived editor save outputs through the content API. This is NOT
an editor roundtrip, disabled-plugin editing test, network or performance gate.
No service starts, dependency changes, or production endpoints are supported.
"""
import argparse
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
from html.parser import HTMLParser

REPO = Path(__file__).resolve().parents[2]
PLUGIN = 'hybrid-edit-block'
PLUGIN_SHA = '6706fd5ab80551577522756b81dbbc29427a46b1951bb925a8f1fb8f5900ef1f'
RESOURCE = '/apis/content.halo.run/v1alpha1/posts/'
CONSOLE = '/apis/api.console.halo.run/v1alpha1/'
OWNER = 'block-lifecycle-owner'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


def sha(value):
    return hashlib.sha256(value if isinstance(value, bytes) else value.encode()).hexdigest()


def fingerprint(value):
    return sha(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')))


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


class Semantics(HTMLParser):
    """Only article.render for HTTP documents; a fragment for saved contents."""
    def __init__(self, article=False):
        super().__init__(convert_charrefs=True)
        self.article = article
        self.depth = 0
        self.active = not article
        self.root_depth = None
        self.found = 0
        self.hidden = []
        self.text = []
        self.images = []
        self.sources = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if self.article and tag == 'article' and 'render' in attrs.get('class', '').split():
            self.found += 1
            self.active = True
            self.root_depth = self.depth
        if self.active:
            if tag in ('script', 'style', 'template'):
                self.hidden.append(self.depth)
            if not self.hidden and tag == 'img':
                self.images.append({k: attrs.get(k) for k in ('src', 'alt', 'srcset', 'sizes', 'loading', 'fetchpriority', 'width', 'height')})
            if not self.hidden and tag == 'source':
                self.sources.append({k: attrs.get(k) for k in ('srcset', 'media', 'type', 'sizes')})
        if tag not in VOID:
            self.depth += 1

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        self.depth = max(0, self.depth - 1)
        if self.hidden and self.hidden[-1] == self.depth:
            self.hidden.pop()
        if self.article and self.active and self.depth == self.root_depth:
            self.active = False

    def handle_data(self, data):
        if self.active and not self.hidden:
            self.text.append(data)

    def result(self):
        require(not self.article or self.found == 1, 'Expected exactly one article.render')
        return {'text': ' '.join(' '.join(self.text).split()), 'images': self.images, 'sources': self.sources}


def semantics(html, article=False):
    parser = Semantics(article)
    parser.feed(html)
    parser.close()
    return parser.result()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--html-content', type=Path, required=True)
    parser.add_argument('--markdown-content', type=Path, required=True)
    parser.add_argument('--allow-synthetic-writes', choices=['yes'], required=True)
    args = parser.parse_args()
    runtime = args.runtime.resolve(strict=True)
    require(runtime.is_relative_to(REPO / '.runtime'), 'Runtime must be in this worktree .runtime')
    marker = json.loads((runtime / 'lab.json').read_text())
    require(marker == {'schema': 1, 'ports': marker['ports'], 'owner': 'halo-butterfly-next-comparison'}, 'Unexpected lab ownership marker')
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(marker['ports']['halo']), HEXO_PORT=str(marker['ports']['hexo']))
    module = importlib.util.spec_from_file_location('block_lifecycle_lab', REPO / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(module)
    module.loader.exec_module(lab)
    run_id = secrets.token_hex(12)
    output = runtime / 'block-lifecycle' / run_id
    lock = runtime / 'authored-image-editor.lock'
    with lock.open('x') as stream:
        stream.write(run_id + '\n')
    lock.chmod(0o600)
    output.mkdir(parents=True, exist_ok=False)
    report = {'schema': 1, 'runId': run_id, 'status': 'running', 'sourceSha': args.source_sha,
              'runnerSha256': lab.digest(Path(__file__)), 'phases': [], 'created': [], 'cleanup': [], 'errors': [],
              'scope': 'Anonymous reading of API-recreated archived editor HTML through enabled -> disabled -> reenabled; no editing or resaving while disabled.',
              'limitations': ['HTTP document and release-content semantics only; images are not downloaded and browser scripts are not executed.',
                              'No network reliability, full plugin compatibility, performance, or complete 1.0 claim.',
                              'No measurement retries. Bounded polls observe asynchronous publishing, plugin state and deletion only.'],
              'productionChanges': False, 'temporaryMitigation': False}
    client = None
    before = None
    original_enabled = None
    planned = []

    def save():
        lab.write_json(output / 'report.json', report)

    def archive(name, data):
        path = output / name
        with path.open('xb') as stream:
            stream.write(data.encode() if isinstance(data, str) else data)
        return {'path': name, 'sha256': lab.digest(path), 'bytes': path.stat().st_size}

    def failure(context, error):
        # Client errors carry only method/path/status; never log credentials or headers.
        report['errors'].append({'context': context, 'type': type(error).__name__, 'message': str(error)})
        report['status'] = 'failed'
        save()

    def missing(path):
        try:
            return client.api(path)
        except lab.ApiError as error:
            if error.status == 404:
                return None
            raise

    def inventory(path):
        data = client.api(path + '?size=200')
        require(data.get('total', len(data['items'])) <= 200 and not data.get('hasNext'), 'Inventory exceeds fixed bound: ' + path)
        return data['items']

    def plugin_state(enabled, mutate=True):
        if mutate:
            client.api(CONSOLE + 'plugins/' + PLUGIN + '/plugin-state', 'PUT', {'enable': enabled, 'async': False})
        for _ in range(80):
            current = client.api('/apis/plugin.halo.run/v1alpha1/plugins/' + PLUGIN)
            if current['spec'].get('enabled') == enabled and current.get('status', {}).get('phase') == ('STARTED' if enabled else 'DISABLED'):
                return {'enabled': enabled, 'phase': current['status']['phase']}
            time.sleep(.25)
        raise RuntimeError('Plugin state did not converge')

    def identity():
        require(lab.owned_process('halo'), 'No owned Halo process')
        state = json.loads((runtime / 'halo-process.json').read_text())
        jar = runtime / 'halo/halo-2.26.1.jar'
        require(state['identity'] == str(jar), 'Unexpected process identity')
        command = subprocess.check_output(['ps', '-p', str(state['pid']), '-o', 'command='], text=True)
        require(str(jar) in command and str(runtime / 'halo/data') in command, 'Owned process runtime differs')
        require('max-keep-alive-requests' not in command and 'maxKeepAliveRequests' not in command, 'Temporary connection workaround is forbidden')
        require(lab.digest(jar) == lab.VERSIONS['halo']['sha256'], 'Official Halo JAR mismatch')
        package = args.package.resolve(strict=True)
        require(package.is_relative_to(REPO), 'Package must belong to this worktree')
        installed = json.loads((runtime / 'installed-package.json').read_text())
        require(installed['sourceCommit'] == args.source_sha and installed['sha256'] == lab.digest(package), 'Package/source installation attribution differs')
        require(re.fullmatch(r'[0-9a-f]{40}', args.source_sha), 'Full source SHA required')
        subprocess.run(['git', 'diff', '--exit-code', args.source_sha, '--', 'src', 'i18n', 'settings.yaml', 'theme.yaml', 'scripts/build.mjs', 'package.json', 'bun.lock', 'bunfig.toml'], cwd=REPO, check=True, stdout=subprocess.DEVNULL)
        with zipfile.ZipFile(package) as zipped:
            files = [n for n in zipped.namelist() if not n.endswith('/')]
            require(len(files) == len(set(files)) == 269, 'Expected 269 unique package files')
            root = (runtime / 'halo/data/themes/halo-butterfly-next').resolve()
            for name in files:
                path = (root / name).resolve()
                require(path.is_relative_to(root), 'Unsafe package member')
                require(path.read_bytes() == zipped.read(name), 'Installed package member differs: ' + name)
        jars = {p.name: lab.digest(p) for p in sorted((runtime / 'halo/data/plugins').glob('*.jar'))}
        require(PLUGIN_SHA in jars.values(), 'Pinned hybrid-edit-block 1.7.0 artifact missing')
        return {'pid': state['pid'], 'haloSha256': lab.digest(jar), 'installed': installed, 'packageFiles': len(files), 'pluginJars': jars}

    def station():
        active = client.api(CONSOLE + 'themes/-/activation')
        require(active['metadata']['name'] == lab.THEME, 'Unexpected active theme')
        require(active['spec']['version'] == report['identity']['installed']['version'], 'Active theme version differs')
        plugins = []
        for item in sorted(inventory('/apis/plugin.halo.run/v1alpha1/plugins'), key=lambda p: p['metadata']['name']):
            config = missing('/api/v1alpha1/configmaps/' + urllib.parse.quote(item['spec']['configMapName'], safe='')) if item['spec'].get('configMapName') else None
            plugins.append({'name': item['metadata']['name'], 'uid': item['metadata'].get('uid'), 'specSha256': fingerprint({k: v for k, v in item['spec'].items() if k != 'enabled'}), 'version': item['spec']['version'],
                            'enabled': item['spec'].get('enabled'), 'phase': item.get('status', {}).get('phase'), 'configSha256': fingerprint(config.get('data', {})) if config else None})
        contents = {}
        for plural in ('posts', 'singlepages'):
            rows = []
            for item in inventory('/apis/content.halo.run/v1alpha1/' + plural):
                if plural == 'posts' and any(item['metadata']['name'] == p['name'] and item['metadata'].get('labels', {}).get(OWNER) == run_id for p in planned):
                    continue
                release = client.api(CONSOLE + plural + '/' + item['metadata']['name'] + '/release-content') if item['spec'].get('publish') else None
                rows.append({'name': item['metadata']['name'], 'uid': item['metadata'].get('uid'), 'specSha256': fingerprint(item['spec']), 'releaseSha256': fingerprint(release) if release else None})
            contents[plural] = sorted(rows, key=lambda x: x['name'])
        return {'theme': {'name': active['metadata']['name'], 'uid': active['metadata'].get('uid'), 'version': active['spec']['version']},
                'themeConfigSha256': fingerprint(client.api(CONSOLE + 'themes/' + lab.THEME + '/json-config')),
                'systemConfigSha256': fingerprint(client.api('/api/v1alpha1/configmaps/system').get('data', {})), 'plugins': plugins, 'contents': contents}

    save()
    try:
        report['identity'] = identity()
        inputs = {}
        for mode, argument in [('html', args.html_content), ('markdown', args.markdown_content)]:
            path = argument.resolve(strict=True)
            require(path.is_relative_to(REPO / '.runtime'), 'Archived content must belong to this worktree .runtime')
            archived = json.loads((path.parent / 'report.json').read_text())
            evidence = next(((case, stage) for case in archived['cases'] for stage in ('saved', 'second-saved')
                             if path.name == case['id'] + '-' + stage + '.html'
                             and case.get('mode') == mode + '-block'
                             and case.get('status') in ('preserved', 'observed-differences')
                             and case.get('stages', {}).get(stage, {}).get('sha256') == lab.digest(path)), None)
            require(evidence is not None, 'Input does not match a completed archived editor saved/second-saved stage')
            html = path.read_text()
            signature = semantics(html)
            require(signature['text'] and signature['images'], 'Archived content must have readable text and images')
            inputs[mode] = html
            report.setdefault('inputs', {})[mode] = {'origin': str(path.relative_to(REPO)), 'originReportSha256': lab.digest(path.parent / 'report.json'), 'archive': archive(mode + '-input.html', html), 'semantics': signature}
        client = lab.Client()
        before = station()
        report['before'] = before
        plugin = next(p for p in before['plugins'] if p['name'] == PLUGIN)
        require(plugin['version'] == '1.7.0' and plugin['enabled'] is True and plugin['phase'] == 'STARTED', 'Pinned hybrid plugin must initially be enabled and STARTED')
        original_enabled = plugin['enabled']
        for mode, html in inputs.items():
            item = {'mode': mode, 'name': 'block-lifecycle-' + run_id + '-' + mode, 'title': 'Block lifecycle ' + run_id + ' ' + mode}
            require(missing(RESOURCE + item['name']) is None, 'Random fixture name unexpectedly exists')
            planned.append(item)
            report['created'].append(item)
            save()
            post_spec = {'title': item['title'], 'slug': item['name'], 'allowComment': False, 'deleted': False, 'pinned': False, 'priority': 0, 'publish': False, 'visible': 'PUBLIC',
                         'owner': client.auth['username'], 'excerpt': {'autoGenerate': True}, 'cover': '', 'tags': [], 'categories': []}
            client.api(CONSOLE + 'posts', 'POST', {'post': {'apiVersion': 'content.halo.run/v1alpha1', 'kind': 'Post', 'metadata': {'name': item['name'], 'labels': {OWNER: run_id}}, 'spec': post_spec},
                                               'content': {'content': html, 'raw': html, 'rawType': 'HTML'}})
            current = client.api(RESOURCE + item['name'])
            require(current['metadata'].get('labels', {}).get(OWNER) == run_id and current['spec']['title'] == item['title'], 'Created ownership mismatch')
            require(current['metadata']['name'] == item['name'], 'Created name mismatch')
            require(isinstance(current['metadata'].get('creationTimestamp'), str) and current['metadata']['creationTimestamp'], 'Created timestamp missing')
            item['creationTimestamp'] = current['metadata']['creationTimestamp']
            if current['metadata'].get('uid') is not None:
                item['uid'] = current['metadata']['uid']
            save()
            client.api(CONSOLE + 'posts/' + item['name'] + '/publish', 'PUT')
            for _ in range(80):
                current = client.api(RESOURCE + item['name'])
                if current['spec'].get('publish') and current.get('status', {}).get('permalink'):
                    break
                time.sleep(.25)
            require(current['spec'].get('publish') and current.get('status', {}).get('permalink'), 'Publish did not converge')
            url = urllib.parse.urljoin(lab.BASE['halo'], current['status']['permalink'])
            require(urllib.parse.urlsplit(url).netloc == urllib.parse.urlsplit(lab.BASE['halo']).netloc and urllib.parse.urlsplit(url).scheme == 'http', 'Public permalink is not the owned loopback origin')
            item['url'] = url
        for phase_name, enabled in [('baseline-enabled', True), ('disabled', False), ('reenabled', True)]:
            phase = {'name': phase_name, 'cases': []}
            report['phases'].append(phase)
            save()
            phase['plugin'] = plugin_state(enabled, mutate=phase_name != 'baseline-enabled')
            phase['station'] = station()
            expected_station = json.loads(json.dumps(before))
            expected_plugin = next(p for p in expected_station['plugins'] if p['name'] == PLUGIN)
            expected_plugin.update(enabled=enabled, phase='STARTED' if enabled else 'DISABLED')
            require(phase['station'] == expected_station, 'State drift beyond the intended hybrid plugin switch')
            for item in planned:
                row = {'mode': item['mode']}
                phase['cases'].append(row)
                save()
                released = client.api(CONSOLE + 'posts/' + item['name'] + '/release-content')
                row['release'] = archive(phase_name + '-' + item['mode'] + '-release.json', json.dumps(released, ensure_ascii=False, indent=2) + '\n')
                row['rawMatchesInput'] = released.get('raw') == inputs[item['mode']]
                row['contentMatchesInput'] = released.get('content') == inputs[item['mode']]
                require(row['rawMatchesInput'] and row['contentMatchesInput'], 'Released content differs from archived input')
                # Fresh anonymous request; no cookie opener, no asset requests, no keepalive workaround.
                with lab.LOCAL.open(urllib.request.Request(item['url']), timeout=30) as response:
                    require(response.status == 200 and response.url == item['url'] and 'text/html' in response.headers.get('Content-Type', ''), 'Unexpected anonymous document response')
                    body = response.read()
                    row['httpStatus'] = response.status
                row['document'] = archive(phase_name + '-' + item['mode'] + '-document.html', body)
                row['semantics'] = semantics(body.decode('utf-8'), article=True)
                row['semanticsMatchInput'] = row['semantics'] == report['inputs'][item['mode']]['semantics']
                require(row['semanticsMatchInput'], 'Public article semantics differ from archived input')
                row['status'] = 'passed'
                save()
            phase['status'] = 'passed'
            save()
        report['status'] = 'completed'
    except Exception as error:
        failure('measurement', error)
    finally:
        if client is not None and original_enabled is not None:
            try:
                report['pluginRestored'] = plugin_state(original_enabled)
            except Exception as error:
                failure('plugin restoration', error)
        if client is not None:
            for item in planned:
                cleanup = {'name': item['name']}
                report['cleanup'].append(cleanup)
                try:
                    current = missing(RESOURCE + item['name'])
                    if current is not None:
                        require(current['metadata']['name'] == item['name'] and current['metadata'].get('labels', {}).get(OWNER) == run_id and current['spec']['title'] == item['title'], 'Refusing to delete object without exact run ownership')
                        require(isinstance(current['metadata'].get('creationTimestamp'), str) and current['metadata']['creationTimestamp'], 'Refusing to delete object without creation timestamp')
                        if item.get('creationTimestamp') is not None:
                            require(current['metadata']['creationTimestamp'] == item['creationTimestamp'], 'Refusing to delete changed creation timestamp')
                        else:
                            # Recover an API create that succeeded before its response was registered.
                            # The preflight 404 and unguessable run label/name/title still scope ownership.
                            item['creationTimestamp'] = current['metadata']['creationTimestamp']
                            cleanup['recoveredRegistration'] = True
                        require(current['metadata'].get('uid') == item.get('uid'), 'Refusing to delete changed optional UID')
                        cleanup['creationTimestamp'] = current['metadata']['creationTimestamp']
                        if current['metadata'].get('uid') is not None:
                            cleanup['uid'] = current['metadata']['uid']
                        client.api(RESOURCE + item['name'], 'DELETE')
                    for _ in range(80):
                        if missing(RESOURCE + item['name']) is None:
                            cleanup['apiStatus'] = 404
                            break
                        time.sleep(.25)
                    require(cleanup.get('apiStatus') == 404, 'Fixture deletion did not converge')
                    cleanup['status'] = 'deleted'
                except Exception as error:
                    cleanup['status'] = 'failed'
                    failure('fixture cleanup ' + item['name'], error)
                save()
            if before is not None:
                try:
                    report['after'] = station()
                    require(report['after'] == before, 'Original content, theme configuration, or normalized plugin state differs')
                    report['stationRestored'] = True
                    report['finalIdentity'] = identity()
                    require(report['finalIdentity'] == report['identity'], 'Runtime/package/plugin artifacts changed')
                except Exception as error:
                    failure('final invariants', error)
        safe = all(x.get('status') == 'deleted' for x in report['cleanup']) and len(report['cleanup']) == len(planned)
        safe = safe and (original_enabled is None or bool(report.get('pluginRestored'))) and (before is None or report.get('stationRestored'))
        if safe:
            require(lock.read_text().strip() == run_id, 'Lock ownership changed')
            lock.unlink()
        else:
            report['lockRetained'] = True
        save()
    print(json.dumps({'status': report['status'], 'output': str(output), 'phases': len(report['phases']), 'errors': len(report['errors'])}))
    return 0 if report['status'] == 'completed' else 1


if __name__ == '__main__':
    sys.exit(main())
