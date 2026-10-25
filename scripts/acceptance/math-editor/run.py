#!/usr/bin/env python3
"""Owned, bounded default-editor KaTeX acceptance; never starts a service."""
import argparse
import base64
import copy
import hashlib
import http.cookiejar
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import signal
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

REPO = Path(__file__).resolve().parents[3]
CONSOLE = '/apis/api.console.halo.run/v1alpha1/'
POSTS = '/apis/content.halo.run/v1alpha1/posts'
PLUGINS = '/apis/plugin.halo.run/v1alpha1/plugins'
CONFIG = CONSOLE + 'themes/halo-butterfly-next/json-config'
KATEX = 'plugin-katex'
KATEX_SHA = 'e444781b99c23b020fcc379f6859ce67dc7669536c880004f7bf7cce0ed2df96'
AUX = ['/api/v1alpha1/configmaps/plugin-katex-configMap', '/api/v1alpha1/settings/plugin-katex-settings']


def require(value, message):
    if not value:
        raise RuntimeError(message)


def digest(value):
    if isinstance(value, Path):
        value = value.read_bytes()
    if not isinstance(value, bytes):
        value = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()
    return hashlib.sha256(value).hexdigest()


def write(path, data, private=False):
    text = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    if private:
        with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), 'w') as stream:
            stream.write(text)
    else:
        path.write_text(text)


class Client:
    """Normal Halo login and official API, 20s requests, no retry/transport tuning."""
    def __init__(self, runtime, base, lab):
        self.base = base
        auth_path = runtime / 'halo/credentials.json'
        require(auth_path.stat().st_mode & 0o077 == 0, 'Credentials not private')
        auth = json.loads(auth_path.read_text())
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        text = self.opener.open(base + '/login', timeout=20).read().decode()
        parser = lab.Inputs(); parser.feed(text)
        self.csrf = parser.csrf
        match = re.search(r'const publicKey = (".*?");', text)
        require(match and self.csrf, 'Expected official Halo login')
        with tempfile.NamedTemporaryFile(mode='w', dir=runtime / 'halo', suffix='.pem') as key:
            key.write('-----BEGIN PUBLIC KEY-----\n' + json.loads(match.group(1)) + '\n-----END PUBLIC KEY-----\n'); key.flush()
            encrypted = subprocess.check_output(['openssl', 'pkeyutl', '-encrypt', '-pubin', '-inkey', key.name, '-pkeyopt', 'rsa_padding_mode:pkcs1'], input=auth['password'].encode())
        data = urllib.parse.urlencode({'username': auth['username'], 'password': base64.b64encode(encrypted).decode(), '_csrf': self.csrf}).encode()
        response = self.opener.open(urllib.request.Request(base + '/login', data=data), timeout=20)
        require('/login' not in response.url, 'Authentication failed')

    def api(self, path, method='GET', data=None, content_type='application/json', missing=False):
        require(path.startswith(('/apis/', '/api/v1alpha1/')) and '://' not in path, 'API path outside owned site')
        headers = {'Accept': 'application/json', 'X-CSRF-TOKEN': self.csrf}
        if data is not None:
            data = data if isinstance(data, bytes) else json.dumps(data).encode()
            headers['Content-Type'] = content_type
        try:
            with self.opener.open(urllib.request.Request(self.base + path, method=method, headers=headers, data=data), timeout=20) as response:
                require('text/html' not in response.headers.get('Content-Type', ''), 'Unexpected API HTML')
                body = response.read()
                return json.loads(body) if body else None
        except urllib.error.HTTPError as error:
            if missing and error.code == 404:
                return None
            raise RuntimeError(f'{method} {path}: HTTP {error.code}') from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', required=True, type=Path)
    parser.add_argument('--package', required=True, type=Path)
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--plugin', required=True, type=Path)
    parser.add_argument('--engines', choices=['chromium,firefox','webkit','chromium,firefox,webkit'], default='chromium,firefox')
    parser.add_argument('--allow-synthetic-writes', required=True, choices=['yes'])
    args = parser.parse_args()
    engines = args.engines.split(','); expected_cases = len(engines) * 2
    runtime = args.runtime.resolve(strict=True)
    require(runtime.is_relative_to(REPO / '.runtime'), 'Runtime outside owned workspace')
    marker = json.loads((runtime / 'lab.json').read_text())
    require(marker['owner'] == 'halo-butterfly-next-comparison' and marker['schema'] == 1, 'Ownership marker mismatch')
    base = 'http://127.0.0.1:' + str(marker['ports']['halo'])
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(marker['ports']['halo']), HEXO_PORT=str(marker['ports']['hexo']))
    spec = importlib.util.spec_from_file_location('math_editor_lab', REPO / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(spec); spec.loader.exec_module(lab)
    guard_spec = importlib.util.spec_from_file_location('fault_guard', REPO / 'scripts/perf/fault-followup.py')
    guard = importlib.util.module_from_spec(guard_spec); guard_spec.loader.exec_module(guard)
    require(not list(runtime.glob('*.lock')), 'Another acceptance writer lock exists')
    run = secrets.token_hex(10)
    output = runtime / 'math-editor-followup' / run
    output.mkdir(parents=True, exist_ok=False)
    lock = runtime / 'math-editor.lock'
    with lock.open('x') as stream:
        stream.write(run)
    lock.chmod(0o600)
    report = {'schema': 1, 'runId': run, 'base': base, 'status': 'running', 'stages': [], 'cleanup': [], 'errors': [], 'runnerDigests': {p.name: digest(p) for p in Path(__file__).parent.iterdir() if p.suffix in ('.py', '.mjs')}, 'limits': {'readinessSeconds': 20, 'browserBatchSeconds': 1800, 'authorCases': expected_cases, 'readerStates': 4}, 'limitations': ['Default editor real UI formula input and two UI saves; publishing uses the official API.', 'Declared headless engine authors and four reader states only; no other editor, physical Safari, screen reader, performance or full contract claim.', 'Clipboard handler output is instrumented, not the operating-system clipboard.', 'No content pre-rendering, editor transactions, connection workaround or browser measurement retry.']}
    client = before = original = plugin_instance = None
    changed = False
    existing_plugin = None
    aux_owned = {}
    browser_deadline = None
    def save():
        write(output / 'report.json', report)
    def inventory(endpoint):
        value = client.api(endpoint + '?size=200')
        require(value.get('total', len(value['items'])) <= 200 and not value.get('hasNext'), 'Inventory exceeds fixed bound')
        return value['items']
    def identity():
        require(lab.owned_process('halo'), 'Owned Halo is not running')
        state = json.loads((runtime / 'halo-process.json').read_text())
        jar = runtime / 'halo' / lab.HALO_JAR_NAME
        command = subprocess.check_output(['ps', '-p', str(state['pid']), '-o', 'command='], text=True)
        require(state['identity'] == str(jar) and str(jar) in command and str(runtime / 'halo/data') in command, 'Process identity mismatch')
        require('max-keep-alive-requests' not in command and 'maxKeepAliveRequests' not in command, 'Connection workaround forbidden')
        require(digest(jar) == lab.VERSIONS['halo']['sha256'], 'Official Halo digest differs')
        package = args.package.resolve(strict=True)
        require(package.is_relative_to(REPO), 'Package outside worktree')
        installed = json.loads((runtime / 'installed-package.json').read_text())
        require(installed['sourceCommit'] == args.source_sha and installed['sha256'] == digest(package), 'Product attribution mismatch')
        subprocess.run(['git', 'diff', '--exit-code', args.source_sha, '--', 'src', 'i18n', 'settings.yaml', 'theme.yaml', 'scripts/build.mjs', 'package.json', 'bun.lock', 'bunfig.toml'], cwd=REPO, check=True, stdout=subprocess.DEVNULL)
        with zipfile.ZipFile(package) as archive:
            names = [n for n in archive.namelist() if not n.endswith('/')]
            require(len(names) == len(set(names)) == 269, 'Expected 269 unique package files')
            root = (runtime / 'halo/data/themes/halo-butterfly-next').resolve()
            for name in names:
                target = (root / name).resolve()
                require(target.is_relative_to(root) and target.read_bytes() == archive.read(name), 'Installed package bytes differ')
        jars = {p.name: digest(p) for p in sorted((runtime / 'halo/data/plugins').glob('*.jar'))}
        if lab.HALO_VERSION != '2.27.1':
            require('6706fd5ab80551577522756b81dbbc29427a46b1951bb925a8f1fb8f5900ef1f' in jars.values(), 'Official hybrid editor missing')
        if report.get('identity'):
            original_jars = report['identity']['pluginJars']
            require(all(jars.get(name) == sha for name, sha in original_jars.items()), 'Original plugin JAR changed')
            extra = {name: sha for name, sha in jars.items() if name not in original_jars}
            require(len(extra) <= 1 and all(sha == KATEX_SHA for sha in extra.values()), 'Unexpected extra plugin JAR')
        return {'installed': installed, 'haloSha256': digest(jar), 'packageFiles': len(names), 'pluginJars': jars}
    def station():
        active = client.api(CONSOLE + 'themes/-/activation')
        require(active['metadata']['name'] == 'halo-butterfly-next', 'Active theme changed')
        plugins = []
        for p in sorted(inventory(PLUGINS), key=lambda x: x['metadata']['name']):
            config = client.api('/api/v1alpha1/configmaps/' + p['spec']['configMapName'], missing=True) if p['spec'].get('configMapName') else None
            plugins.append({'name': p['metadata']['name'], 'creationTimestamp': p['metadata'].get('creationTimestamp'), 'specSha256': digest(p['spec']), 'phase': p.get('status', {}).get('phase'), 'configSha256': digest(config.get('data', {})) if config else None})
        contents = {}
        for plural in ('posts', 'singlepages'):
            rows = []
            for obj in inventory('/apis/content.halo.run/v1alpha1/' + plural):
                row = {'name': obj['metadata']['name'], 'creationTimestamp': obj['metadata'].get('creationTimestamp'), 'specSha256': digest(obj['spec'])}
                if obj['spec'].get('publish'):
                    row['releaseSha256'] = digest(client.api(CONSOLE + plural + '/' + obj['metadata']['name'] + '/release-content'))
                rows.append(row)
            contents[plural] = sorted(rows, key=lambda x: x['name'])
        return {'theme': {'name': active['metadata']['name'], 'version': active['spec']['version']}, 'themeConfigSha256': digest(client.api(CONFIG)), 'systemSha256': digest(client.api('/api/v1alpha1/configmaps/system').get('data', {})), 'plugins': plugins, 'contents': contents, 'aux': {p: digest(client.api(p, missing=True)) for p in AUX}}
    def poll(call, predicate, message):
        deadline = time.monotonic() + 20
        while True:
            value = call()
            require(time.monotonic() < deadline, message + ': deadline exceeded')
            if predicate(value):
                return value
            time.sleep(min(.25, max(0, deadline - time.monotonic())))
    def owned_plugin():
        obj = client.api(PLUGINS + '/' + KATEX)
        require(plugin_instance and obj['metadata']['creationTimestamp'] == plugin_instance and obj['spec']['version'] == '3.0.0', 'Plugin instance replaced')
        return obj
    def lifecycle(enabled):
        identity(); owned_plugin()
        client.api(CONSOLE + 'plugins/' + KATEX + '/plugin-state', 'PUT', {'enable': enabled, 'async': False})
        value = poll(owned_plugin, lambda p: p['spec'].get('enabled') is enabled and p.get('status', {}).get('phase') == ('STARTED' if enabled else 'DISABLED'), 'Plugin state did not settle')
        report.setdefault('pluginLifecycle', []).append({'enabled': enabled, 'phase': value['status']['phase'], 'creationTimestamp': plugin_instance, 'specSha256': digest(value['spec'])})
        save()
        return value
    def browser(phase):
        nonlocal browser_deadline
        identity()
        if browser_deadline is None:
            browser_deadline = time.monotonic() + 1800
        remaining = browser_deadline - time.monotonic()
        require(remaining > 0, 'Fixed complete browser matrix deadline exceeded')
        file = output / 'plan.json'
        write(file, {'runId': run, 'runtime': str(runtime), 'base': base, 'output': str(output), 'phase': phase, 'installed': report['identity']['installed'], 'engines': engines, 'haloVersion': lab.HALO_VERSION})
        log = output / (phase + '.log')
        result = guard.run_browser(['bun', str(Path(__file__).with_name('check.mjs')), '--plan', str(file)], log, base, timeout=remaining)
        require(result == 0, phase + ' browser failed; original evidence retained')
        data = json.loads((output / (phase + '.json')).read_text())
        require(data['status'] == 'passed' and len(data['cases']) == expected_cases, 'Incomplete browser matrix')
        report['stages'].append({'phase': phase, 'path': str((output / (phase + '.json')).relative_to(REPO)), 'sha256': digest(output / (phase + '.json')), 'cases': expected_cases, 'status': 'passed'})
        save()
    def cleanup():
        path = output / 'author.json'
        if not path.exists():
            return
        data = json.loads(path.read_text())
        failures = []
        for row in data.get('created', []):
            try:
                obj = client.api(POSTS + '/' + row['name'], missing=True)
                if obj is not None:
                    require(obj['metadata']['name'] == row['name'] and obj['spec']['title'] == row['title'] and obj['metadata'].get('creationTimestamp') == row['creationTimestamp'], 'Fixture identity differs at cleanup')
                    require(obj['metadata'].get('uid') == row.get('uid'), 'Optional UID changed')
                    require(obj['spec'].get('owner') == row['owner'] and digest(obj['spec']) == row['specSha256'], 'Fixture owner or last confirmed spec changed')
                    client.api(POSTS + '/' + row['name'], 'DELETE')
                    poll(lambda: client.api(POSTS + '/' + row['name'], missing=True), lambda value: value is None, 'Fixture deletion incomplete')
                report['cleanup'].append({'name': row['name'], 'creationTimestamp': row['creationTimestamp'], 'status': 'deleted'})
            except Exception as error:
                failures.append(str(error))
                report['cleanup'].append({'name': row['name'], 'status': 'failed', 'error': str(error)})
            save()
        for pending in data.get('pending', []):
            if not any(row['name'] == pending['name'] for row in data.get('created', [])):
                try:
                    require(client.api(POSTS + '/' + pending['name'], missing=True) is None, 'Unregistered successful create remains; inspect pending identity')
                except Exception as error:
                    failures.append(str(error))
        require(not failures, 'Fixture cleanup: ' + '; '.join(failures))
    save()
    try:
        report['identity'] = identity()
        for tool in Path(__file__).parent.iterdir():
            if tool.suffix in ['.py','.mjs']:(output / ('runner-' + tool.name)).write_bytes(tool.read_bytes())
        require(digest(args.plugin) == KATEX_SHA, 'Expected pinned official KaTeX JAR')
        client = Client(runtime, base, lab)
        existing_plugin = client.api(PLUGINS + '/' + KATEX, missing=True)
        if existing_plugin:
            require(existing_plugin['spec']['version'] == '3.0.0' and KATEX_SHA in report['identity']['pluginJars'].values(), 'Existing KaTeX identity differs')
            require(existing_plugin.get('status', {}).get('phase') == ('STARTED' if existing_plugin['spec'].get('enabled') else 'DISABLED'), 'Existing KaTeX unstable')
        else:
            for endpoint in AUX:
                require(client.api(endpoint, missing=True) is None, 'KaTeX auxiliary resource already exists')
        if lab.HALO_VERSION != '2.27.1':
            hybrid = client.api(PLUGINS + '/hybrid-edit-block')
            require(hybrid['spec']['version'] == '1.7.0' and hybrid['spec'].get('enabled') is True and hybrid.get('status', {}).get('phase') == 'STARTED', 'Official hybrid editor must remain enabled')
        report['editorProvider'] = 'Halo 2.27.1 bundled default editor' if lab.HALO_VERSION == '2.27.1' else 'hybrid-edit-block 1.7.0'
        original = client.api(CONFIG)
        before = station(); report['before'] = before
        write(output / 'restore.private.json', {'themeConfig': original}, private=True)
        changed = True
        if existing_plugin:
            plugin_instance = existing_plugin['metadata'].get('creationTimestamp')
            require(plugin_instance, 'Plugin creation timestamp missing')
            report['reusedExistingPlugin'] = True
            lifecycle(True)
        else:
            boundary = 'math-editor-' + run
            body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="plugin-katex-3.0.0.jar"\r\nContent-Type: application/java-archive\r\n\r\n'.encode() + args.plugin.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
            result = client.api(CONSOLE + 'plugins/install', 'POST', body, 'multipart/form-data; boundary=' + boundary)
            require(result['metadata']['name'] == KATEX and result['spec']['version'] == '3.0.0', 'Installed plugin mismatch')
            plugin_instance = result['metadata'].get('creationTimestamp'); require(plugin_instance, 'Plugin creation timestamp missing')
            report['pluginInstance'] = plugin_instance; save()
            lifecycle(True)
            for endpoint in AUX:
                value = client.api(endpoint, missing=True)
                if value:
                    require(value['metadata'].get('creationTimestamp'), 'Auxiliary creation timestamp missing')
                    aux_owned[endpoint] = {'creationTimestamp': value['metadata'].get('creationTimestamp'), 'contentSha256': digest({k: v for k, v in value.items() if k != 'metadata'})}
            report['auxCreated'] = aux_owned; save()
        configmap = client.api(AUX[0], missing=True)
        basic = json.loads((configmap or {}).get('data', {}).get('basic', '{}'))
        require(basic.get('enable_frontend_katex') not in (True, 'true'), 'Frontend renderer must remain off')
        cfg = copy.deepcopy(original); cfg.setdefault('math', {}).update(enable=True, copy_tex=True)
        client.api(CONFIG, 'PUT', cfg); require(client.api(CONFIG) == cfg, 'Math config differs')
        browser('author')
        for phase in ('enabled', 'theme-off', 'plugin-off', 'restored'):
            cfg['math']['enable'] = phase != 'theme-off'
            client.api(CONFIG, 'PUT', cfg); require(client.api(CONFIG) == cfg, 'Math config differs')
            if phase == 'plugin-off': lifecycle(False)
            if phase == 'restored': lifecycle(True)
            browser(phase)
        report['status'] = 'passed'
    except guard.BrowserCleanupError as error:
        report['browserCleanupFailed'] = True
        report['status'] = 'failed'; report['errors'].append(str(error))
    except Exception as error:
        report['status'] = 'failed'; report['errors'].append(str(error))
    finally:
        if changed and not report.get('browserCleanupFailed'):
            for action in ('fixtures', 'plugin', 'theme', 'verify'):
                try:
                    identity()
                    if action == 'fixtures': cleanup()
                    elif action == 'plugin':
                        if existing_plugin:
                            lifecycle(existing_plugin['spec'].get('enabled') is True)
                            require(owned_plugin()['spec'] == existing_plugin['spec'], 'Existing KaTeX spec changed')
                        else:
                            present = client.api(PLUGINS + '/' + KATEX, missing=True)
                            if present:
                                owned_plugin(); client.api(PLUGINS + '/' + KATEX, 'DELETE')
                                poll(lambda: client.api(PLUGINS + '/' + KATEX, missing=True), lambda p: p is None, 'Plugin uninstall incomplete')
                            for endpoint in AUX:
                                value = client.api(endpoint, missing=True)
                                if value:
                                    owned = aux_owned.get(endpoint)
                                    require(owned and value['metadata'].get('creationTimestamp') == owned['creationTimestamp'] and digest({k: v for k, v in value.items() if k != 'metadata'}) == owned['contentSha256'], 'Auxiliary resource identity differs')
                                    client.api(endpoint, 'DELETE')
                                    poll(lambda: client.api(endpoint, missing=True), lambda p: p is None, 'Auxiliary cleanup incomplete')
                    elif action == 'theme':
                        client.api(CONFIG, 'PUT', original); require(client.api(CONFIG) == original, 'Theme configuration restoration differs')
                    else:
                        report['after'] = station(); report['finalIdentity'] = identity()
                        require(report['after'] == before, 'Station not restored')
                        require(report['finalIdentity'] == report['identity'], 'JAR/package identity not restored')
                        report['stationRestored'] = True
                except Exception as error:
                    report['status'] = 'failed'; report['errors'].append(action + ': ' + str(error))
                save()
        if not changed or report.get('stationRestored'):
            require(lock.read_text() == run, 'Ownership lock changed'); lock.unlink()
        else:
            report['lockRetained'] = True
        save()
    print(json.dumps({'status': report['status'], 'output': str(output), 'stages': len(report['stages']), 'cleanup': len(report['cleanup']), 'stationRestored': report.get('stationRestored', False)}))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
