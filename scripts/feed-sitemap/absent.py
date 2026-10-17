#!/usr/bin/env python3
"""Exercise actual absent-plugin fallback, reinstalling pinned JARs and restoring local lab state."""
import argparse
import copy
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import time
import urllib.error
import urllib.request
import check
import hashlib
import zipfile


PRODUCT_PATHS = ['src', 'i18n', 'settings.yaml', 'theme.yaml', 'scripts/build.mjs',
                 'package.json', 'bun.lock', 'bunfig.toml']


def candidate_identity(runtime, source_sha, lab, package):
    """Validate official process, source and each installed byte before writes."""
    check.require(re.fullmatch('[a-f0-9]{40}', source_sha or ''), 'Full source SHA required')
    record = runtime / 'installed-package.json'
    installed = json.loads(record.read_text())
    package = package.resolve(strict=True)
    check.require(package.is_relative_to(check.REPO), 'Package outside worktree')
    check.require(installed.get('sourceCommit') == source_sha and lab.digest(package) == installed.get('sha256'), 'Installed candidate differs')
    check.require(not subprocess.check_output(['git', 'diff', '--name-only', source_sha, '--', *PRODUCT_PATHS], cwd=check.REPO, text=True).strip(), 'Product changed from candidate')
    check.require(not subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard', '--', *PRODUCT_PATHS], cwd=check.REPO, text=True).strip(), 'Untracked product input')
    process = json.loads((runtime / 'halo-process.json').read_text())
    jar = runtime / 'halo/halo-2.26.1.jar'
    check.require(lab.owned_process('halo') and lab.digest(jar) == lab.VERSIONS['halo']['sha256'], 'Official running Halo changed')
    command = subprocess.check_output(['ps', '-p', str(process['pid']), '-o', 'command='], text=True)
    check.require(process['identity'] == str(jar) and str(jar) in command and str(runtime / 'halo/data') in command, 'Process identity differs')
    check.require('max-keep-alive-requests' not in command and 'maxKeepAliveRequests' not in command, 'Connection workaround forbidden')
    root = (runtime / 'halo/data/themes/halo-butterfly-next').resolve()
    with zipfile.ZipFile(package) as archive:
        files = [name for name in archive.namelist() if not name.endswith('/')]
        check.require(len(files) == len(set(files)) == 269, 'Expected 269 unique package files')
        for name in files:
            path = (root / name).resolve()
            check.require(path.is_relative_to(root) and path.read_bytes() == archive.read(name), 'Installed file differs: ' + name)
    return installed, lab.digest(record)


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def active_theme(client, installed, lab):
    # Halo 2.26.1 ThemeEndpoint.fetchActivatedTheme, not a guessed spec.enabled flag.
    active = client.api('/apis/api.console.halo.run/v1alpha1/themes/-/activation')
    check.require(active.get('metadata', {}).get('name') == lab.THEME, 'Candidate theme is not active')
    check.require(active.get('spec', {}).get('version') == installed.get('version'), 'Active theme version differs from candidate')
    check.require(not active.get('metadata', {}).get('deletionTimestamp'), 'Active theme is being deleted')
    return {'name': active['metadata']['name'], 'version': active['spec']['version'],
            'creationTimestamp': active['metadata'].get('creationTimestamp')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--source-sha', required=True)
    parser.add_argument('--allow-synthetic-writes', choices=['yes'], required=True)
    args = parser.parse_args()
    runtime = args.runtime.resolve()
    check.require(runtime.is_relative_to(check.REPO / '.runtime'), 'Task-owned runtime required')
    marker = json.loads((runtime / 'lab.json').read_text())
    check.require(marker.get('owner') == 'halo-butterfly-next-comparison' and marker.get('schema') == 1, 'Lab identity mismatch')
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(marker['ports']['halo']), HEXO_PORT=str(marker['ports']['hexo']))
    spec = importlib.util.spec_from_file_location('feed_absent_lab', check.REPO / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(spec); spec.loader.exec_module(lab)
    check.require(lab.owned_process('halo') and (runtime / 'seed.json').exists(), 'Owned seeded process required')
    check.require(lab.digest(runtime / 'halo/halo-2.26.1.jar') == lab.VERSIONS['halo']['sha256'], 'Halo digest mismatch')
    source_sha = args.source_sha
    installed, installed_record_sha = candidate_identity(runtime, source_sha, lab, args.package)
    client = lab.Client()
    active = active_theme(client, installed, lab)
    base = lab.BASE['halo']
    run_id = secrets.token_hex(12)
    output = runtime / 'feed-sitemap-absent-followup' / run_id
    lock = runtime / 'authored-image-editor.lock'
    with lock.open('x') as stream:
        stream.write(run_id + '\n')
    lock.chmod(0o600)
    output.mkdir(parents=True, exist_ok=False)
    original_config = client.api(check.CONFIG)
    originals = {}
    attempted = []
    instances = {}
    report = {'schema': 2, 'runId': run_id, 'owner': 'halo-butterfly-next-feed-sitemap-absent-followup', 'baseUrl': base,
              'sourceCommit': source_sha, 'package': installed, 'activeTheme': active,
              'installedRecordSha256': installed_record_sha,
              'runnerHead': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=check.REPO, text=True).strip(),
              'runnerSha256': lab.digest(Path(__file__)), 'checkModuleSha256': lab.digest(Path(check.__file__)),
              'productSourcePaths': PRODUCT_PATHS, 'stages': [], 'requests': [],
              'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'productionChanges': False, 'temporaryMitigation': False,
              'limitations': ['Actual absence and exact pinned JAR reinstall on isolated loopback Halo only; not a production migration.',
                              'Plugin creationTimestamp/resourceVersion can change across reinstall; configuration data and enabled states are restored.',
                              'Older plugin versions are not installed or claimed tested.',
                              'No browser, performance, network reliability or production deployment claim; no temporary mitigation.']}
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), check.NoRedirect())

    def optional(path):
        try:
            return client.api(path)
        except lab.ApiError as error:
            if error.status != 404:
                raise

    def save():
        lab.write_json(output / 'evidence.json', report)
        # Never overwrite a prior run or its summary.


    def station():
        plugins = []
        for item in inventory(check.RESOURCE):
            name = item['metadata']['name']
            config_name = item['spec'].get('configMapName')
            config = optional('/api/v1alpha1/configmaps/' + config_name) if config_name else None
            # Reinstall legitimately regenerates metadata for the two target plugins.
            # All other plugin metadata identities remain part of the invariant.
            row = {'name': name, 'specSha256': fingerprint(item['spec']), 'phase': item.get('status', {}).get('phase'), 'configSha256': fingerprint(config.get('data', {})) if config else None}
            if name not in check.PLUGINS:
                row['creationTimestamp'] = item['metadata'].get('creationTimestamp')
            plugins.append(row)
        contents = {}
        for kind in ('posts', 'singlepages'):
            rows = []
            for item in inventory('/apis/content.halo.run/v1alpha1/' + kind):
                released = client.api('/apis/api.console.halo.run/v1alpha1/' + kind + '/' + item['metadata']['name'] + '/release-content') if item['spec'].get('publish') else None
                rows.append({'name': item['metadata']['name'], 'creationTimestamp': item['metadata'].get('creationTimestamp'), 'specSha256': fingerprint(item['spec']), 'releaseSha256': fingerprint(released) if released else None})
            contents[kind] = sorted(rows, key=lambda row: row['name'])
        jars = []
        targets = {value[1]: name for name, value in check.PLUGINS.items()}
        for path in sorted((runtime / 'halo/data/plugins').glob('*.jar')):
            digest = lab.digest(path)
            row = {'sha256': digest}
            if digest in targets:
                row['targetPlugin'] = targets[digest]
            else:
                row['filename'] = path.name
            jars.append(row)
        return {'plugins': sorted(plugins, key=lambda row: row['name']), 'contents': contents,
                'pluginJars': sorted(jars, key=lambda row: (row['sha256'], row.get('filename', ''))),
                'haloSha256': lab.digest(runtime / 'halo/halo-2.26.1.jar'),
                'themeConfigSha256': fingerprint(client.api(check.CONFIG)),
                'systemConfigSha256': fingerprint(client.api('/api/v1alpha1/configmaps/system').get('data', {}))}

    def inventory(path):
        data = client.api(path + '?size=200')
        check.require(data.get('total', len(data['items'])) <= 200 and not data.get('hasNext'), 'Inventory exceeds fixed limit')
        return data['items']


    def settled(name, enabled):
        client.api(check.CONSOLE + '/' + name + '/plugin-state', 'PUT', {'enable': enabled, 'async': False})
        for _ in range(80):
            plugin = client.api(check.RESOURCE + '/' + name)
            if bool(plugin['spec'].get('enabled')) == enabled and plugin.get('status', {}).get('phase') == ('STARTED' if enabled else 'DISABLED'):
                return
            time.sleep(.25)
        raise RuntimeError('Plugin lifecycle state did not settle: ' + name)

    def gone(name):
        for _ in range(120):
            if optional(check.RESOURCE + '/' + name) is None:
                return
            time.sleep(.25)
        raise RuntimeError('Plugin deletion did not finish: ' + name)

    def restore_plugin(name, active):
        original = originals[name]
        check.require(lab.digest(Path(original['jar'])) == original['sha256'], 'Recovery JAR changed')
        plugin = optional(check.RESOURCE + '/' + name)
        if plugin is not None:
            check.require(plugin['metadata']['name'] == name and plugin['metadata'].get('creationTimestamp') == instances[name], 'Refusing to restore replaced plugin instance')
        if plugin and plugin['metadata'].get('deletionTimestamp'):
            gone(name); plugin = None
        if plugin is None:
            boundary = 'feed-reinstall-' + secrets.token_hex(10)
            jar = Path(original['jar'])
            body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{jar.name}"\r\nContent-Type: application/java-archive\r\n\r\n'.encode()
                    + jar.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
            installed = client.api(check.CONSOLE + '/install', 'POST', body, 'multipart/form-data; boundary=' + boundary)
            check.require(installed['metadata']['name'] == name and isinstance(installed['metadata'].get('creationTimestamp'), str), 'Reinstalled unexpected plugin identity')
            instances[name] = installed['metadata']['creationTimestamp']
            report.setdefault('reinstalledInstances', {})[name] = instances[name]
            save()
        plugin = client.api(check.RESOURCE + '/' + name)
        check.require(plugin['metadata']['name'] == name and plugin['metadata'].get('creationTimestamp') == instances[name], 'Restored plugin identity changed')
        check.require(plugin['spec']['version'] == check.PLUGINS[name][0], 'Restored plugin version mismatch')
        matches = [p for p in (runtime / 'halo/data/plugins').glob('*.jar') if lab.digest(p) == original['sha256']]
        check.require(len(matches) == 1, 'Restored JAR digest missing/ambiguous')
        wanted = original['config']
        current = optional(original['configPath'])
        if wanted is not None:
            if current is None:
                value = {key: copy.deepcopy(wanted[key]) for key in ['apiVersion', 'kind', 'data'] if key in wanted}
                value['metadata'] = {'name': wanted['metadata']['name']}
                client.api('/api/v1alpha1/configmaps', 'POST', value)
            else:
                current['data'] = copy.deepcopy(wanted.get('data', {}))
                client.api(original['configPath'], 'PUT', current)
        elif current is not None:
            client.api(original['configPath'], 'DELETE')
        settled(name, active)
        restored = optional(original['configPath'])
        check.require((restored is None) == (wanted is None), 'Restored plugin config presence differs')
        if wanted is not None:
            check.require(restored.get('data') == wanted.get('data'), 'Restored plugin config data differs')

    def request(path, stage):
        req = urllib.request.Request(base + path, headers={'Accept': 'text/html' if path == '/' else 'text/xml, application/rss+xml'})
        try:
            with opener.open(req, timeout=20) as response:
                status, kind, body = response.status, response.headers.get_content_type(), response.read()
        except urllib.error.HTTPError as error:
            status, kind, body = error.code, error.headers.get_content_type(), error.read()
        target = output / (stage + '-' + ('index.html' if path == '/' else path[1:]))
        with target.open('xb') as stream:
            stream.write(body)
        report['requests'].append({'stage': stage, 'path': path, 'status': status, 'contentType': kind, 'response': target.name, 'sha256': lab.digest(target), 'bytes': len(body)})
        save()
        if status == 200:
            check.require(kind == 'text/html' if path == '/' else kind in ('application/xml', 'text/xml', 'application/rss+xml'), 'Unexpected response content type')
        return status, body

    try:
        # Back up every required input before the first mutation.
        for name, (version, sha, slug) in check.PLUGINS.items():
            plugin = client.api(check.RESOURCE + '/' + name)
            check.require(plugin['metadata']['name'] == name and isinstance(plugin['metadata'].get('creationTimestamp'), str) and plugin['metadata']['creationTimestamp'], 'Plugin identity missing')
            check.require(plugin['spec']['version'] == version and not plugin['metadata'].get('deletionTimestamp'), 'Pinned live plugin required')
            check.require(plugin.get('status', {}).get('phase') == ('STARTED' if plugin['spec'].get('enabled') else 'DISABLED'), 'Plugin must initially be settled')
            instances[name] = plugin['metadata']['creationTimestamp']
            matches = [p for p in (runtime / 'halo/data/plugins').glob('*.jar') if lab.digest(p) == sha]
            check.require(len(matches) == 1, 'Official JAR digest missing/ambiguous')
            backup = output / (name + '-' + version + '.jar')
            shutil.copyfile(matches[0], backup)
            check.require(lab.digest(backup) == sha, 'JAR backup digest mismatch')
            config_name = plugin['spec'].get('configMapName')
            check.require(config_name, 'Expected plugin config map name')
            config_path = '/api/v1alpha1/configmaps/' + config_name
            originals[name] = {'plugin': plugin, 'jar': str(backup), 'sha256': sha, 'configPath': config_path, 'config': optional(config_path)}
        lab.write_json(output / 'original.private.json', {'owner': report['owner'], 'plugins': originals, 'themeConfig': original_config}, private=True)
        before = station()
        report['before'] = before
    except Exception as error:
        report['result'] = 'failed'
        report['error'] = str(error)
        report['preflightFailedBeforeMutation'] = True
        check.require(lock.read_text().strip() == run_id, 'Lock ownership mismatch')
        lock.unlink()
        save()
        raise

    try:
        check.require(active_theme(client, installed, lab) == active, 'Active theme changed before first mutation')
        config = copy.deepcopy(original_config); config['subscription'] = {'rss': True, 'sitemap': True}
        client.api(check.CONFIG, 'PUT', config)
        for name in originals:
            settled(name, True)
        for name, (_, _, slug) in check.PLUGINS.items():
            plugin = client.api(check.RESOURCE + '/' + name)
            check.require(plugin['spec'] == {**originals[name]['plugin']['spec'], 'enabled': True}, 'Plugin changed before uninstall')
            check.require(plugin['metadata']['name'] == name and plugin['metadata'].get('creationTimestamp') == originals[name]['plugin']['metadata'].get('creationTimestamp') and isinstance(plugin['metadata'].get('creationTimestamp'), str), 'Plugin creation identity changed')
            attempted.append(name); report['attemptedUninstall'] = list(attempted); save()
            client.api(check.RESOURCE + '/' + name, 'DELETE')
            gone(name)
            status, body = request('/', 'absent-' + slug)
            check.require(status == 200, 'Theme failed with missing plugin')
            head = check.check_page(body.decode(), base, slug != 'feed', slug != 'sitemap')
            path = '/rss.xml' if slug == 'feed' else '/sitemap.xml'
            status, _ = request(path, 'absent-' + slug)
            check.require(status == 404, 'Absent plugin XML route must be 404')
            report['stages'].append({'stage': 'absent-' + slug, 'resourceStatus': 404, 'routeStatus': status, 'originalCreationTimestamp': originals[name]['plugin']['metadata']['creationTimestamp'], 'headFooter': head, 'result': 'passed'}); save()
            restore_plugin(name, True)
            restored_metadata = client.api(check.RESOURCE + '/' + name)['metadata']
            check.require(restored_metadata['name'] == name and isinstance(restored_metadata.get('creationTimestamp'), str), 'Reinstalled metadata missing identity')
            status, body = request('/', 'reinstalled-' + slug)
            check.require(status == 200, 'Theme failed after reinstall')
            check.check_page(body.decode(), base, True, True)
            status, body = request(path, 'reinstalled-' + slug)
            check.require(status == 200, 'Restored plugin XML route failed')
            (check.rss_items if slug == 'feed' else check.sitemap_items)(body)
            report['stages'].append({'stage': 'reinstalled-' + slug, 'version': check.PLUGINS[name][0], 'sha256': originals[name]['sha256'], 'creationTimestamp': restored_metadata['creationTimestamp'], 'result': 'passed'}); save()
        report['result'] = 'passed'
    except Exception as error:
        report['result'] = 'failed'; report['error'] = str(error)
        raise
    finally:
        errors = []
        for name, original in originals.items():
            try:
                restore_plugin(name, bool(original['plugin']['spec'].get('enabled')))
            except Exception as error:
                errors.append(name + ': ' + str(error))
        try:
            client.api(check.CONFIG, 'PUT', original_config)
            check.require(client.api(check.CONFIG) == original_config, 'Theme restoration differs')
            check.require(active_theme(client, installed, lab) == active, 'Active theme changed during acceptance')
            check.require(lab.digest(runtime / 'installed-package.json') == installed_record_sha, 'Installed package record changed during acceptance')
            report['after'] = station()
            check.require(report['after'] == before, 'Content, system/theme configuration or normalized plugin state differs')
            candidate_identity(runtime, source_sha, lab, args.package)
            report['stationRestored'] = True
        except Exception as error:
            errors.append('theme: ' + str(error))
        report['restoration'] = {'result': 'failed' if errors else 'passed', 'errors': errors}
        if errors:
            report['result'] = 'failed'
        if errors:
            report['lockRetained'] = True
        else:
            check.require(lock.read_text().strip() == run_id, 'Lock ownership mismatch')
            lock.unlink()
        report['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        save()
        if errors:
            raise RuntimeError('Restoration requires attention: ' + '; '.join(errors))
    print('Absent-plugin evidence:', output / 'evidence.json', flush=True)


if __name__ == '__main__':
    main()
