#!/usr/bin/env python3
"""Run fixed PERF-03 controls in an owned lab, preserving failures and restoring inputs."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import time
import zipfile

ROOT = Path(__file__).resolve().parents[2]
CONSOLE = '/apis/api.console.halo.run/v1alpha1/'
POSTS = '/apis/content.halo.run/v1alpha1/posts'
PLUGINS = '/apis/plugin.halo.run/v1alpha1/plugins'
CONFIG = CONSOLE + 'themes/halo-butterfly-next/json-config'
CPU_LOCK = Path('/private/tmp/halo-butterfly-next-performance-cpu.lock')


def sha(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def require(value, message):
    if not value:
        raise RuntimeError(message)


def plugin_phases_stable(items):
    return bool(items) and all(p.get('status', {}).get('phase') == ('STARTED' if p['spec'].get('enabled') else 'DISABLED') for p in items)


def wait_for_stable_plugins(inventory, timeout=60):
    deadline = time.monotonic() + timeout
    identity = None
    while True:
        items = inventory()
        names = [p['metadata']['name'] for p in items]
        require(names and len(set(names)) == len(names), 'Empty or duplicate plugin inventory')
        current = sorted((p['metadata']['name'], sha(p['spec'])) for p in items)
        if identity is None:
            identity = current
        require(current == identity, 'Plugin inventory/spec changed during preflight')
        require(time.monotonic() < deadline, 'Initial plugin states did not settle')
        if plugin_phases_stable(items):
            return items
        time.sleep(.25)


def release_run_locks(locks):
    # Validate every owner before releasing any part of the reservation.
    for path, payload in locks:
        require(path.read_text() == payload, 'Run lock ownership changed: ' + str(path))
    cpu_owner = locks[0][0]
    require(set(cpu_owner.parent.iterdir()) == {cpu_owner}, 'Unexpected CPU lock contents')
    for path, _ in reversed(locks):
        path.unlink()
    cpu_owner.parent.rmdir()


def acquire_run_locks(runtime, run, cpu_lock=CPU_LOCK, *, kind='perf03-followup'):
    # These are the same atomic locks used by collect.mjs and combinations/run.py.
    # Taking both prevents either tool from starting after the fault run begins.
    cpu_lock.mkdir()
    locks = []
    try:
        owner = json.dumps({'pid': os.getpid(), 'runtime': str(runtime), 'kind': kind, 'runId': run})
        for path, payload in [(cpu_lock / 'owner.json', owner),
                              (runtime / 'acceptance-combinations.lock', run),
                              (runtime / 'perf03-followup.lock', run)]:
            with path.open('x') as stream:
                stream.write(payload)
            path.chmod(0o600)
            locks.append((path, payload))
        return locks
    except BaseException:
        if locks:
            release_run_locks(locks)
        elif not any(cpu_lock.iterdir()):
            cpu_lock.rmdir()
        raise


def stop_browser_group(child, grace=10):
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        child.wait(timeout=grace)
    except subprocess.TimeoutExpired:
        pass
    finally:
        # The parent may exit on TERM while a browser descendant ignores it.
        # Always finish the original group, even after a normal parent exit.
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    child.wait(timeout=grace)


class BrowserCleanupError(RuntimeError):
    pass


def run_browser(command, log, base, timeout=600, grace=10):
    with log.open('w') as stream:
        child = subprocess.Popen(command, cwd=ROOT, env=dict(os.environ, BASE_URL=base), stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            return child.wait(timeout=timeout)
        except subprocess.TimeoutExpired as error:
            raise RuntimeError('Fault batch exceeded fixed ' + str(timeout) + ' seconds') from error
        finally:
            # Also runs on KeyboardInterrupt; restoration must follow child cleanup.
            try:
                stop_browser_group(child, grace)
            except Exception as error:
                raise BrowserCleanupError('Browser group cleanup failed; retain run locks') from error


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--lab-runtime', type=Path, required=True)
    p.add_argument('--package', type=Path, required=True)
    p.add_argument('--source-sha', required=True)
    p.add_argument('--allow-synthetic-writes', choices=['yes'], required=True)
    args = p.parse_args()
    runtime = args.lab_runtime.resolve(strict=True)
    require(runtime.is_relative_to(ROOT / '.runtime'), 'Runtime outside owned checkout')
    marker = json.loads((runtime / 'lab.json').read_text())
    require(marker['owner'] == 'halo-butterfly-next-comparison' and marker['schema'] == 1, 'Wrong lab owner')
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(marker['ports']['halo']), HEXO_PORT=str(marker['ports']['hexo']))
    spec = importlib.util.spec_from_file_location('fault_lab', ROOT / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lab)
    require(lab.owned_process('halo'), 'Owned live Halo required')
    jar = runtime / 'halo' / lab.HALO_JAR_NAME
    state = json.loads((runtime / 'halo-process.json').read_text())
    require(state['identity'] == str(jar) and lab.digest(jar) == lab.VERSIONS['halo']['sha256'], 'Official Halo identity mismatch')
    installed = json.loads((runtime / 'installed-package.json').read_text())
    require(installed['sourceCommit'] == args.source_sha and installed['sha256'] == lab.digest(args.package), 'Wrong candidate')
    with zipfile.ZipFile(args.package) as package:
        for name in package.namelist():
            if name.endswith('/'):
                continue
            target = (runtime / 'halo/data/themes/halo-butterfly-next' / name).resolve()
            require(target.is_relative_to(runtime / 'halo/data/themes/halo-butterfly-next') and target.read_bytes() == package.read(name), 'Installed bytes differ')
    run = secrets.token_hex(10)
    output = runtime / 'fault-followup' / run
    output.mkdir(parents=True)
    report = {'coordinatorSha256': lab.digest(Path(__file__)), 'runId': run, 'candidate': installed, 'halo': lab.VERSIONS['halo'], 'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'batches': [], 'errors': [], 'restorationVerified': False}
    created = None
    locks = None
    mutations_started = False
    c = None
    def save():
        lab.write_json(output / 'report.json', report)
    def inventory():
        listing = c.api(PLUGINS + '?size=100')
        require(not listing.get('hasNext') and listing.get('total', len(listing['items'])) <= 100, 'Plugin inventory exceeds fixed bound')
        return listing['items']
    def plugin_snapshot():
        result = []
        items = inventory()
        require(plugin_phases_stable(items), 'Cannot snapshot transient plugin phases')
        for x in items:
            name = x['metadata']['name']
            cfg = None
            if x['spec'].get('configMapName'):
                try:
                    cfg = c.api('/api/v1alpha1/configmaps/' + x['spec']['configMapName'])
                except lab.ApiError as e:
                    if e.status != 404:
                        raise
            result.append({'name': name, 'specSha256': sha(x['spec']), 'phase': x.get('status', {}).get('phase'), 'configSha256': sha(cfg.get('data', {}) if cfg else None)})
        return sorted(result, key=lambda x: x['name'])
    def content_snapshot():
        result = {}
        for kind in ['posts', 'singlepages']:
            listing = c.api('/apis/content.halo.run/v1alpha1/' + kind + '?size=200')
            require(not listing.get('hasNext') and listing.get('total', len(listing['items'])) <= 200, 'Content inventory exceeds fixed bound')
            rows = []
            for obj in listing['items']:
                row = {'name': obj['metadata']['name'], 'creationTimestamp': obj['metadata'].get('creationTimestamp'), 'specSha256': sha(obj['spec'])}
                if obj['spec'].get('publish'):
                    row['releaseSha256'] = sha(c.api(CONSOLE + kind + '/' + obj['metadata']['name'] + '/release-content'))
                rows.append(row)
            result[kind] = sorted(rows, key=lambda x: x['name'])
        return result
    def enable(names):
        for x in inventory():
            name = x['metadata']['name']
            if x['spec'].get('enabled') != (name in names):
                c.api(CONSOLE + 'plugins/' + name + '/plugin-state', 'PUT', {'enable': name in names, 'async': False})
        deadline = time.monotonic() + 60
        while True:
            if all(x['spec'].get('enabled') == (x['metadata']['name'] in names) and x.get('status', {}).get('phase') == ('STARTED' if x['metadata']['name'] in names else 'DISABLED') for x in inventory()):
                return
            require(time.monotonic() < deadline, 'Plugin state did not settle')
            time.sleep(.25)
    def browser(command, log):
        try:
            return run_browser(command, log, lab.BASE['halo'])
        except BrowserCleanupError:
            report['browserCleanupFailed'] = True
            raise
    try:
        locks = acquire_run_locks(runtime, run, CPU_LOCK)
        save()
        c = lab.Client()
        before_plugins = wait_for_stable_plugins(inventory)
        original_config = c.api(CONFIG)
        lab.write_json(output / 'restore.private.json', {'config': original_config, 'plugins': before_plugins}, private=True)
        before = plugin_snapshot()
        before_content = content_snapshot()
        before_system = sha(c.api('/api/v1alpha1/configmaps/system').get('data', {}))
        report['before'] = {'plugins': before, 'content': before_content, 'systemSha256': before_system}
        save()
        # Use the same versioned renderer content as functional acceptance.
        rs = importlib.util.spec_from_file_location('fault_renderer', ROOT / 'scripts/body-renderers/lab.py')
        renderer = importlib.util.module_from_spec(rs)
        rs.loader.exec_module(renderer)
        markup, _ = renderer.content()
        name = 'perf03-demand-' + run
        post = {'apiVersion': 'content.halo.run/v1alpha1', 'kind': 'Post', 'metadata': {'name': name, 'labels': {'perf03-owner': run}}, 'spec': {'title': 'PERF03 synthetic ' + run, 'slug': name, 'owner': c.auth['username'], 'publish': False, 'publishTime': '2026-08-01T04:00:00Z', 'visible': 'PUBLIC', 'deleted': False, 'pinned': False, 'allowComment': False, 'priority': 0, 'excerpt': {'autoGenerate': True}, 'cover': '', 'tags': [], 'categories': []}}
        mutations_started = True  # An uncertain POST outcome also needs restoration checks.
        c.api(CONSOLE + 'posts', 'POST', {'post': post, 'content': {'raw': markup, 'content': markup, 'rawType': 'HTML'}})
        initial = c.api(POSTS + '/' + name)
        created = {'name': name, 'creationTimestamp': initial['metadata']['creationTimestamp'], 'specSha256': None}
        report['created'] = created
        save()
        c.api(CONSOLE + 'posts/' + name + '/publish', 'PUT')
        deadline = time.monotonic() + 20
        while True:
            current = c.api(POSTS + '/' + name)
            if current['spec'].get('publish') and current['spec'].get('releaseSnapshot'):
                content = c.api(CONSOLE + 'posts/' + name + '/release-content')
                if content['raw'] == markup and content['content'] == markup:
                    created['specSha256'] = sha(current['spec'])
                    break
            require(time.monotonic() < deadline, 'Positive fixture publication timeout')
            time.sleep(.25)
        for profile in ['official', 'ondemand']:
            enable({'PluginCommentWidget', 'plugin-katex'} if profile == 'official' else set())
            config = json.loads(json.dumps(original_config))
            config['loading'] = {**config.get('loading', {}), 'enable': True, 'mode': 'pace'}
            config['share'] = {'use': 'none'}
            config['busuanzi'] = {'site_pv': False, 'page_pv': False}
            config['mermaid'] = {'enable': profile == 'ondemand', 'code_write': True, 'theme': {'light': 'default', 'dark': 'dark'}}
            config['chartjs'] = {'enable': profile == 'ondemand'}
            # per_page=True enables content detection on all posts; False requires per-post metadata.
            config['abcjs'] = {'enable': profile == 'ondemand', 'per_page': True}
            c.api(CONFIG, 'PUT', config)
            require(c.api(CONFIG) == config, 'Fault configuration did not apply')
            lab.write_json(output / (profile + '-inputs.private.json'), {'config': config, 'plugins': plugin_snapshot()}, private=True)
            command = ['bun', str(ROOT / 'scripts/perf/fault-browser.mjs'), '--lab-runtime', str(runtime), '--package', str(args.package.resolve()), '--source-sha', args.source_sha, '--profile', profile, '--output', str(output / profile)]
            if profile == 'ondemand':
                command += ['--positive-path', '/archives/' + name + '/']
            code = browser(command, output / (profile + '.log'))
            report['batches'].append({'profile': profile, 'exitCode': code, 'configSha256': sha(config), 'report': profile + '/report.json'})
            save()
            print(profile, code, flush=True)
        # Original delayed-bundle check: three engines, unchanged deadlines.
        code = browser(['bun', str(ROOT / 'scripts/perf/core-browser.mjs'), '--base', lab.BASE['halo'], '--output', str(output / 'delayed.json'), '--scenario', 'delayed'], output / 'delayed.log')
        report['batches'].append({'profile': 'delayed', 'exitCode': code, 'report': 'delayed.json'})
    except (Exception, KeyboardInterrupt) as e:
        report['errors'].append(str(e) or type(e).__name__)
    finally:
        try:
            require(not report.get('browserCleanupFailed'), 'Browser group cleanup incomplete; preserve fixture')
            if created:
                current = c.api(POSTS + '/' + created['name'])
                require(current['metadata'].get('labels', {}).get('perf03-owner') == run and current['metadata']['creationTimestamp'] == created['creationTimestamp'] and created['specSha256'] == sha(current['spec']), 'Synthetic fixture identity drift; preserve for inspection')
                c.api(POSTS + '/' + created['name'], 'DELETE')
                deadline = time.monotonic() + 20
                while True:
                    try:
                        c.api(POSTS + '/' + created['name'])
                    except lab.ApiError as e:
                        if e.status == 404:
                            report['fixtureDeleted'] = True
                            break
                        raise
                    require(time.monotonic() < deadline, 'Fixture deletion did not settle')
                    time.sleep(.25)
        except Exception as e:
            report['errors'].append('fixture cleanup: ' + str(e))
        try:
            require(not report.get('browserCleanupFailed'), 'Browser group cleanup incomplete; preserve configuration and locks')
            if mutations_started:
                c.api(CONFIG, 'PUT', original_config)
                enable({x['metadata']['name'] for x in before_plugins if x['spec'].get('enabled')})
                require(c.api(CONFIG) == original_config and plugin_snapshot() == before, 'Restoration differs')
                require(json.loads((runtime / 'installed-package.json').read_text()) == installed, 'Installed candidate changed')
                require(content_snapshot() == before_content, 'Existing content or release changed')
                require(sha(c.api('/api/v1alpha1/configmaps/system').get('data', {})) == before_system, 'System configuration changed')
                require(not created or report.get('fixtureDeleted'), 'Synthetic fixture was not deleted')
                report['restorationVerified'] = True
            else:
                report['preflightOnly'] = True
            if locks:
                release_run_locks(locks)
            report['locksReleased'] = True
        except Exception as e:
            report['errors'].append('restoration: ' + str(e))
        report['passed'] = report['restorationVerified'] and not report['errors'] and len(report['batches']) == 3 and all(x['exitCode'] == 0 for x in report['batches'])
        report['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        save()
    print(output, report['passed'])
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
