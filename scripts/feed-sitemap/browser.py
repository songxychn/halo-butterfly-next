#!/usr/bin/env python3
"""Configure, run and restore RSS/Sitemap headless browser acceptance in an owned lab."""
import argparse
import copy
import importlib.util
import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import time
import check


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--allow-synthetic-writes', choices=['yes'], required=True)
    args = parser.parse_args()
    runtime = args.runtime.resolve()
    check.require(runtime.is_relative_to(check.REPO / '.runtime'), 'Task-owned runtime required')
    marker = json.loads((runtime / 'lab.json').read_text())
    check.require(marker.get('owner') == 'halo-butterfly-next-comparison' and marker.get('schema') == 1, 'Lab ownership mismatch')
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(marker['ports']['halo']), HEXO_PORT=str(marker['ports']['hexo']))
    spec = importlib.util.spec_from_file_location('feed_browser_lab', check.REPO / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(spec); spec.loader.exec_module(lab)
    check.require(lab.owned_process('halo') and (runtime / 'seed.json').exists(), 'Owned seeded process required')
    check.require(lab.digest(runtime / 'halo' / lab.HALO_JAR_NAME) == lab.VERSIONS['halo']['sha256'], 'Halo digest mismatch')
    guard_spec = importlib.util.spec_from_file_location('feed_browser_identity', check.REPO / 'scripts/feed-sitemap/uninstalled.py')
    guard = importlib.util.module_from_spec(guard_spec); guard_spec.loader.exec_module(guard)
    source_sha = os.environ.get('THEME_SOURCE_SHA')
    installed, installed_record_sha = guard.candidate_identity(runtime, source_sha, lab)
    client = lab.Client()
    active = guard.active_theme(client, installed, lab)
    original_config = client.api(check.CONFIG)
    initial_plugins = {}
    for name, (version, sha, slug) in check.PLUGINS.items():
        plugin = client.api(check.RESOURCE + '/' + name)
        check.require(plugin['spec']['version'] == version, 'Plugin version mismatch')
        jars = [p for p in (runtime / 'halo/data/plugins').glob('*.jar') if lab.digest(p) == sha]
        check.require(len(jars) == 1, 'Locked official plugin JAR missing/ambiguous')
        initial_plugins[name] = bool(plugin['spec'].get('enabled'))
    run = secrets.token_hex(5)
    output = runtime / 'feed-sitemap-browser' / run
    output.mkdir(parents=True)
    snapshot = output / 'original.private.json'
    lab.write_json(snapshot, {'owner': 'halo-butterfly-next-feed-sitemap-browser', 'config': original_config, 'plugins': initial_plugins}, private=True)
    white_name = 'feed-sitemap-white-' + run + '.svg'
    white = runtime / 'halo/data/attachments/lab' / white_name
    white_content = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path fill="white" d="M0 0h100v100H0z"/></svg>'
    white.parent.mkdir(parents=True, exist_ok=True)
    with white.open('x') as stream:
        stream.write(white_content)
    report = {'schema': 1, 'runId': run, 'owner': 'halo-butterfly-next-feed-sitemap-browser', 'baseUrl': lab.BASE['halo'],
              'package': installed, 'sourceCommit': source_sha, 'activeTheme': active, 'installedRecordSha256': installed_record_sha,
              'runnerHead': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=check.REPO, text=True).strip(),
              'runnerSha256': lab.digest(Path(__file__)), 'identityGuardSha256': lab.digest(Path(guard.__file__)),
              'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'phases': [],
              'limitations': ['Headless Playwright Chromium/Firefox/WebKit; no physical device or Safari-app claim.',
                              'Configuration is applied before each phase; PJAX/back/forward reentry is exercised within each phase.',
                              'Missing-plugin and old-plugin states require separate evidence; disabled is not absent.']}

    def save():
        lab.write_json(output / 'evidence.json', report)
        lab.write_json(runtime / 'feed-sitemap-browser-evidence.json', report)

    def enabled(name, value):
        client.api(check.CONSOLE + '/' + name + '/plugin-state', 'PUT', {'enable': value, 'async': False})
        for _ in range(40):
            plugin = client.api(check.RESOURCE + '/' + name)
            if bool(plugin['spec'].get('enabled')) == value and (plugin.get('status', {}).get('phase') == 'STARTED') == value:
                return
            time.sleep(.25)
        raise RuntimeError('Plugin state did not settle: ' + name)

    def phase(name, rss=True, sitemap=True, feed_started=True, sitemap_started=True, full=False):
        for plugin, enabled_state in [('PluginFeed', feed_started), ('PluginSitemap', sitemap_started)]:
            enabled(plugin, enabled_state)
        config = copy.deepcopy(original_config)
        config['subscription'] = {'rss': rss, 'sitemap': sitemap}
        config.setdefault('footer', {})['footer_img'] = '/lab/' + white_name
        config.setdefault('mask', {})['footer'] = False
        config.setdefault('pjax', {})['enable'] = True
        config.setdefault('loading', {}).update({'enable': False, 'instantpage': True})
        config.setdefault('share', {})['use'] = 'native'
        config.setdefault('style', {})['mode'] = 'system'
        client.api(check.CONFIG, 'PUT', config)
        plan = {'owner': report['owner'], 'phase': name, 'output': str(output / name), 'base': lab.BASE['halo'],
                'expected': {'rss': rss and feed_started, 'sitemap': sitemap and sitemap_started}, 'full': full, 'whitePath': '/lab/' + white_name, 'package': installed, 'activeTheme': active}
        plan_path = output / (name + '.json'); lab.write_json(plan_path, plan)
        env = {**os.environ, 'BASE_URL': lab.BASE['halo'], 'LAB_RUNTIME': str(runtime), 'FEED_BROWSER_PLAN': str(plan_path)}
        # Own a process group so a wedged runner cannot leave its headless engines behind.
        process = subprocess.Popen(['bun', str(check.REPO / 'scripts/feed-sitemap/browser.mjs')], env=env, cwd=check.REPO, start_new_session=True)
        try:
            process.wait(timeout=900)
        finally:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                process.poll()
                try:
                    os.killpg(process.pid, 0)
                except ProcessLookupError:
                    break
                time.sleep(.1)
            else:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            process.wait(timeout=5)
        result = process
        report['phases'].append({'phase': name, 'result': 'passed' if result.returncode == 0 else 'failed', 'report': str((output / name / 'report.json').relative_to(runtime))})
        save()
        check.require(result.returncode == 0, 'Browser phase failed: ' + name)

    try:
        phase('enabled-white-background', full=True)
        phase('rss-setting-off', rss=False)
        phase('sitemap-setting-off', sitemap=False)
        phase('both-settings-off', rss=False, sitemap=False)
        phase('feed-stopped', feed_started=False)
        phase('sitemap-stopped', sitemap_started=False)
        phase('plugins-restarted')
        report['result'] = 'passed'
    except Exception as error:
        report['result'] = 'failed'; report['error'] = str(error)
        raise
    finally:
        errors = []
        try:
            client.api(check.CONFIG, 'PUT', original_config)
            check.require(client.api(check.CONFIG) == original_config, 'Theme config restoration differs')
        except Exception as error:
            errors.append('config: ' + str(error))
        for name, value in initial_plugins.items():
            try:
                enabled(name, value)
            except Exception as error:
                errors.append(name + ': ' + str(error))
        try:
            check.require(white.read_text() == white_content, 'Synthetic white-image file ownership changed')
            white.unlink(); check.require(not white.exists(), 'Synthetic image cleanup failed')
        except Exception as error:
            errors.append('white image: ' + str(error))
        try:
            check.require(guard.active_theme(client, installed, lab) == active, 'Active theme identity changed during browser acceptance')
            check.require(lab.digest(runtime / 'installed-package.json') == installed_record_sha, 'Installed package record changed during browser acceptance')
        except Exception as error:
            errors.append('candidate identity: ' + str(error))
        report['restoration'] = {'result': 'failed' if errors else 'passed', 'errors': errors}
        if errors:
            report['result'] = 'failed'
        save()
        if errors:
            raise RuntimeError('Restoration requires attention: ' + '; '.join(errors))
    print('Browser evidence:', output / 'evidence.json', flush=True)


if __name__ == '__main__':
    main()
