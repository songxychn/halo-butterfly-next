#!/usr/bin/env python3
"""Ephemeral Linux Actions only; export an explicit anonymous artifact allowlist."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import subprocess
import sys
import time
import zipfile

HARNESS = Path(__file__).resolve().parents[3]
ENGINES = ('chromium', 'firefox', 'webkit')
PAGE_FILE = re.compile(r'(chromium|firefox|webkit)-(1440|390)-(light|dark)-[0-9]+(?:-diagnostic)?\.(json|png)')
PROGRESS_FILE = re.compile(r'progress-[0-9]{3}-[0-9a-f-]{36}\.json')
COMMENT_PROFILE = {
    'basic': {'withReplies': False, 'showCommenterDevice': False, 'showPrivateCommentBadge': True,
              'enablePrivateComment': False, 'size': 20, 'replySize': 10, 'withReplySize': 5},
    'avatar': {'enable': False, 'policy': 'anonymousUser', 'provider': 'gravatar'},
    'editor': {'enableEmoji': True, 'enableUpload': False},
    'security': {'captcha': {'enable': False, 'type': 'ALPHANUMERIC', 'audience': 'ANONYMOUS', 'roles': []}},
}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def json_file(path):
    return json.loads(Path(path).read_text())


def write(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()


def temporary_path(value, runner_temp):
    path = Path(value).absolute()
    if path.resolve() != path or not path.is_relative_to(runner_temp) or path == runner_temp:
        raise RuntimeError('CI output/runtime must be non-symlink children of RUNNER_TEMP')
    return path


def collect_browser_reports(browser_root, output):
    """No logs, auth, storage, config, databases, JARs or entire runtime trees."""
    count = 0
    for run in sorted((browser_root / 'runs').glob('*')):
        if run.is_symlink() or not run.is_dir():
            raise RuntimeError('Unexpected browser report directory')
        target = output / 'browser' / run.name
        for file in sorted(run.iterdir()):
            if file.name != 'report.json' and not PAGE_FILE.fullmatch(file.name) and not PROGRESS_FILE.fullmatch(file.name):
                continue
            if file.is_symlink() or not file.is_file() or file.resolve().parent != run.resolve():
                raise RuntimeError('Refusing report symlink or non-file')
            target.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(file, target / file.name)
            count += 1
    return count


def load_lab():
    spec = importlib.util.spec_from_file_location('linux_ci_lab', HARNESS / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lab)
    return lab


def download(lab, item, path):
    subprocess.run(['curl', '--fail', '--location', '--retry', '2', '--proto', '=https', item['url'], '-o', str(path)], check=True)
    if lab.digest(path) != item['sha256']:
        raise RuntimeError('Official JAR SHA-256 mismatch: ' + path.name)


def poll(predicate, message):
    for _ in range(60):
        if predicate():
            return
        time.sleep(1)
    raise RuntimeError(message)


def set_plugin_enabled(lab, client, name, enabled):
    """Retry only optimistic state conflicts in this freshly owned CI lab."""
    endpoint = '/apis/api.console.halo.run/v1alpha1/plugins/' + name + '/plugin-state'
    for attempt in range(4):
        try:
            client.api(endpoint, 'PUT', {'enable': enabled, 'async': False})
            return
        except lab.ApiError as error:
            if error.status != 409 or attempt == 3:
                raise
            print(f'Plugin {name}: state conflict; retry {attempt + 1}/3', flush=True)
            time.sleep(0.1 * 2 ** attempt)


def install_plugins(lab, client, runtime, lock):
    resource = '/apis/plugin.halo.run/v1alpha1/plugins/'
    console = '/apis/api.console.halo.run/v1alpha1/plugins'
    result = []
    for plugin in lock['plugins']:
        jar = runtime / (plugin['name'] + '.jar')
        download(lab, plugin, jar)
        def current():
            try:
                return client.api(resource + plugin['name'])
            except lab.ApiError as error:
                if error.status != 404:
                    raise
                return None
        if current():
            # Fresh lab only. Replace bundled artifacts with the exact official lock.
            set_plugin_enabled(lab, client, plugin['name'], False)
            client.api(resource + plugin['name'], 'DELETE')
            poll(lambda: current() is None, 'Bundled plugin removal did not settle')
        boundary = 'linux-ci-' + secrets.token_hex(12)
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{jar.name}"\r\nContent-Type: application/java-archive\r\n\r\n'.encode() + jar.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
        client.api(console + '/install', 'POST', body, 'multipart/form-data; boundary=' + boundary)
        poll(lambda: current() is not None, 'Pinned plugin installation did not settle')
        set_plugin_enabled(lab, client, plugin['name'], True)
        poll(lambda: current()['spec'].get('enabled') is True and current().get('status', {}).get('phase') == 'STARTED', 'Pinned plugin did not start')
        state = current()
        if state['spec']['version'] != plugin['version']:
            raise RuntimeError('Pinned plugin version differs')
        installed = [p for p in (runtime / 'halo/data/plugins').glob('*.jar') if digest(p) == plugin['sha256']]
        if len(installed) != 1:
            raise RuntimeError('Installed plugin JAR bytes do not match official artifact')
        result.append({'name': plugin['name'], 'version': plugin['version'], 'enabled': True, 'sha256': plugin['sha256']})
    enabled = {p['metadata']['name'] for p in client.api(resource.rstrip('/') + '?size=100')['items'] if p['spec'].get('enabled')}
    if enabled != {p['name'] for p in lock['plugins']}:
        raise RuntimeError('Unexpected enabled plugin outside the fixed profile')
    return result


def stop_owned(runtime):
    if not (runtime / 'linux-ci-owner.json').exists():
        return
    owner = json_file(runtime / 'linux-ci-owner.json')
    if owner != {'runId': os.environ['GITHUB_RUN_ID'], 'repository': os.environ['GITHUB_REPOSITORY']}:
        raise RuntimeError('Runtime belongs to a different CI job')
    subprocess.run([sys.executable, str(HARNESS / 'scripts/lab/lab.py'), 'stop'], check=True)


def configure_comments(client):
    plugin = client.api('/apis/plugin.halo.run/v1alpha1/plugins/PluginCommentWidget')
    endpoint = '/api/v1alpha1/configmaps/' + plugin['spec']['configMapName']
    config = client.api(endpoint)
    for group, patch in COMMENT_PROFILE.items():
        value = json.loads(config.get('data', {}).get(group, '{}'))
        value.update(patch)
        config.setdefault('data', {})[group] = json.dumps(value)
    client.api(endpoint, 'PUT', config)
    actual = client.api(endpoint)
    for group, patch in COMMENT_PROFILE.items():
        value = json.loads(actual['data'][group])
        if any(value.get(key) != expected for key, expected in patch.items()):
            raise RuntimeError('Explicit comment profile did not persist: ' + group)


def matrix_summary(result):
    """Only anonymous core diagnostics; never headers, storage or runtime config."""
    return {'platform': result.get('platform'), 'requestHeaders': 'not collected', 'engines': [
        {'name': engine['name'], 'version': engine.get('version'), 'status': engine['status'],
         'pages': len(engine['pages']), 'passed': sum(page['status'] == 'passed' for page in engine['pages']),
         'launchError': engine.get('error'), 'failures': [
             {'path': page['path'], 'width': page['viewport']['width'], 'mode': page['mode'],
              'assertions': page['failures'], 'pageErrors': [error['message'] for error in page['jsErrors']],
              'readinessFailure': page.get('readinessFailure'),
              'lifecycle': page.get('diagnostics', {}).get('failure', page.get('diagnostics', {}).get('final'))}
             for page in engine['pages'] if page['status'] != 'passed']}
        for engine in result['engines']]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path)
    parser.add_argument('--source-sha')
    parser.add_argument('--cleanup', action='store_true')
    args = parser.parse_args()
    if sys.platform != 'linux' or os.environ.get('GITHUB_ACTIONS') != 'true':
        raise RuntimeError('This entry point runs only on an ephemeral Linux GitHub Actions runner')
    runner_temp = Path(os.environ['RUNNER_TEMP']).resolve()
    runtime = temporary_path(os.environ['LAB_RUNTIME'], runner_temp)
    output = temporary_path(os.environ['EVIDENCE_OUTPUT'], runner_temp)
    if args.cleanup:
        stop_owned(runtime)
        return
    if not re.fullmatch('[0-9a-f]{40}', args.source_sha or '') or not args.source:
        raise RuntimeError('An exact full source SHA and checkout are required')
    source = args.source.resolve()
    actual_sha = git(source, 'rev-parse', 'HEAD')
    if actual_sha != args.source_sha:
        raise RuntimeError(f'Theme checkout SHA differs: expected {args.source_sha}, actual {actual_sha}')
    status = git(source, 'status', '--porcelain', '--untracked-files=all')
    if status:
        raise RuntimeError('Theme checkout must be clean; changed paths: ' + status)
    if runtime.exists() or output.exists():
        raise RuntimeError('A fresh, unclaimed CI runtime and evidence directory are required')
    runtime.mkdir(mode=0o700)
    output.mkdir(mode=0o700)
    write(runtime / 'linux-ci-owner.json', {'runId': os.environ['GITHUB_RUN_ID'], 'repository': os.environ['GITHUB_REPOSITORY']})
    lab = load_lab()
    report = {'status': 'incomplete', 'runnerSha': git(HARNESS, 'rev-parse', 'HEAD'), 'themeSourceSha': args.source_sha, 'profile': 'comparison fixtures; only official SearchWidget 1.7.1 and CommentWidget 3.3.2 enabled; explicit comment overrides listed below', 'commentProfile': COMMENT_PROFILE, 'comparisonDifference': 'Linux explicitly sets system comment.enable=true; macOS comparison had no system comment keys and used Halo defaults. Other plugin settings are not claimed fully identical.', 'hexoReference': 'not started or checked; not a product gate', 'publication': 'anonymous diagnostic CI, not release acceptance', 'limitations': ['120 anonymous core page checks, not search/comment interaction acceptance', 'Linux Playwright engines are not macOS, actual Safari or physical devices']}
    matrix = None
    try:
        for fixture in ('fixtures/comparison', 'fixtures/search-comment', 'fixtures/browser'):
            for file in (HARNESS / fixture).rglob('*'):
                if file.is_file() and file.relative_to(HARNESS).parts[-1] != '.DS_Store':
                    other = source / file.relative_to(HARNESS)
                    if not other.is_file() or digest(other) != digest(file):
                        raise RuntimeError('Theme and harness fixture profiles differ: ' + str(file.relative_to(HARNESS)))
        lock = json_file(HARNESS / 'fixtures/search-comment/versions.json')
        if lab.VERSIONS['halo']['version'] != '2.26.1' or lock['halo'] != '2.26.1' or [(p['name'], p['version']) for p in lock['plugins']] != [('PluginSearchWidget', '1.7.1'), ('PluginCommentWidget', '3.3.2')]:
            raise RuntimeError('Unexpected Halo/plugin lock versions')
        if json_file(HARNESS / 'fixtures/browser/package.json')['dependencies']['playwright'] != '1.63.0':
            raise RuntimeError('Unexpected Playwright fixture version')
        package = source / 'dist' / ('halo-butterfly-next-' + json_file(source / 'package.json')['version'] + '.zip')
        if not re.fullmatch(r'halo-butterfly-next-[0-9A-Za-z.+-]+\.zip', package.name):
            raise RuntimeError('Unexpected theme archive name')
        report['package'] = {'name': package.name, 'sha256': digest(package)}
        shutil.copyfile(package, output / package.name)
        (output / 'package.sha256').write_text(report['package']['sha256'] + '  ' + package.name + '\n')
        (runtime / 'halo').mkdir()
        write(runtime / 'lab.json', {'schema': 1, 'ports': lab.PORTS, 'owner': 'halo-butterfly-next-comparison'})
        download(lab, lab.VERSIONS['halo'], runtime / 'halo/halo-2.26.1.jar')
        report['haloJarSha256'] = lab.VERSIONS['halo']['sha256']
        report['fixtureSha256'] = lab.fixture_hash()
        shutil.copytree(lab.FIXTURES / 'assets', runtime / 'halo/data/attachments/lab')
        # Fail early with useful stderr before starting Halo or spending a full matrix.
        preflight_path = output / 'chromium-preflight.json'
        preflight = subprocess.Popen(['bun', str(HARNESS / 'scripts/ci/linux-halo/preflight.mjs'), str(preflight_path)], start_new_session=True)
        try:
            preflight_status = preflight.wait(timeout=60)
        finally:
            if preflight.poll() is None:
                os.killpg(preflight.pid, signal.SIGTERM)
                try:
                    preflight.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(preflight.pid, signal.SIGKILL)
                    preflight.wait()
        report['chromiumPreflight'] = json_file(preflight_path)
        if preflight_status or report['chromiumPreflight']['status'] != 'passed':
            raise RuntimeError('Chromium launch preflight failed; original bounded stderr retained')
        lab.start(halo_only=True)
        client = lab.Client(initialize=True)
        if not client.initialized_now:
            raise RuntimeError('CI must initialize a new Halo database')
        lab.capture_initial_content(client)
        lab.install(client, package, args.source_sha)
        with zipfile.ZipFile(package) as archive:
            files = [name for name in archive.namelist() if not name.endswith('/')]
            for name in files:
                if (runtime / 'halo/data/themes/halo-butterfly-next' / name).read_bytes() != archive.read(name):
                    raise RuntimeError('Installed theme bytes differ: ' + name)
            report['installedFilesMatch'] = len(files)
        lab.seed(client, reference=False)
        report['plugins'] = install_plugins(lab, client, runtime, lock)
        configure_comments(client)
        system = client.api('/api/v1alpha1/configmaps/system')
        comment = json.loads(system['data'].get('comment', '{}'))
        comment['enable'] = True
        system['data']['comment'] = json.dumps(comment)
        client.api('/api/v1alpha1/configmaps/system', 'PUT', system)
        if not json.loads(client.api('/api/v1alpha1/configmaps/system')['data']['comment'])['enable']:
            raise RuntimeError('Global comment configuration did not persist')
        report['globalCommentEnabled'] = True
        report['installedPackage'] = json_file(runtime / 'installed-package.json')
        matrix = subprocess.Popen(['bun', str(HARNESS / 'scripts/browser/run.mjs'), '--lab-runtime', str(runtime), '--theme-package', str(package), '--theme-source-sha', args.source_sha], env={**os.environ, 'BASE_URL': lab.BASE['halo']}, start_new_session=True)
        status = matrix.wait(timeout=1500)
        report['matrixExitCode'] = status
        reports = list((HARNESS / '.runtime/browser-matrix/runs').glob('*/report.json'))
        if len(reports) != 1:
            raise RuntimeError('Exactly one complete matrix report is required')
        result = json_file(reports[0])
        report['matrixResult'] = result['result']
        report['matrixSummary'] = matrix_summary(result)
        print('Linux anonymous matrix classification ' + json.dumps(report['matrixSummary'], ensure_ascii=False), flush=True)
        counts = {e['name']: len(e['pages']) for e in result['engines']}
        report['pageCounts'] = counts
        if status or result['result'] != 'passed-core-smoke' or counts != {name: 40 for name in ENGINES}:
            raise RuntimeError('Linux core matrix did not pass all 120 pages; original failures preserved')
        report['status'] = 'passed-core-smoke'
    except Exception as error:
        report['status'] = 'failed'
        report['error'] = str(error)
        raise
    finally:
        if matrix and matrix.poll() is None:
            os.killpg(matrix.pid, signal.SIGTERM)
            try:
                matrix.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(matrix.pid, signal.SIGKILL)
                matrix.wait()
        try:
            stop_owned(runtime)
            report['ownedServicesStopped'] = True
        except Exception as error:
            report['status'] = 'failed'
            report['cleanupError'] = str(error)
            raise
        finally:
            report['exportedBrowserFiles'] = collect_browser_reports(HARNESS / '.runtime/browser-matrix', output)
            write(output / 'summary.json', report)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Linux Halo CI failed:', error, file=sys.stderr)
        sys.exit(1)
