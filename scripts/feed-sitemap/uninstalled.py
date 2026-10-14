#!/usr/bin/env python3
"""Exercise actual absent-plugin fallback, reinstalling pinned JARs and restoring local lab state."""
import argparse
import copy
import importlib.util
import json
import os
from pathlib import Path
import secrets
import shutil
import time
import urllib.error
import urllib.request
import check


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
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
    client = lab.Client()
    base = lab.BASE['halo']
    output = runtime / 'feed-sitemap-uninstalled' / secrets.token_hex(5)
    output.mkdir(parents=True)
    original_config = client.api(check.CONFIG)
    originals = {}
    report = {'schema': 1, 'owner': 'halo-butterfly-next-feed-sitemap-uninstalled', 'baseUrl': base,
              'package': json.loads((runtime / 'installed-package.json').read_text()), 'stages': [],
              'limitations': ['Actual absence and exact pinned JAR reinstall on isolated loopback Halo only; not a production migration.',
                              'Plugin generated metadata versions/UIDs can change across reinstall; configuration data and enabled states are restored.',
                              'Older plugin versions are not installed or claimed tested.']}
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), check.NoRedirect())

    def optional(path):
        try:
            return client.api(path)
        except lab.ApiError as error:
            if error.status != 404:
                raise

    def save():
        lab.write_json(output / 'evidence.json', report)
        lab.write_json(runtime / 'feed-sitemap-uninstalled-evidence.json', report)

    # Back up every required input before the first mutation.
    for name, (version, sha, slug) in check.PLUGINS.items():
        plugin = client.api(check.RESOURCE + '/' + name)
        check.require(plugin['spec']['version'] == version and not plugin['metadata'].get('deletionTimestamp'), 'Pinned live plugin required')
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

    def settled(name, enabled):
        client.api(check.CONSOLE + '/' + name + '/plugin-state', 'PUT', {'enable': enabled, 'async': False})
        for _ in range(80):
            plugin = client.api(check.RESOURCE + '/' + name)
            if bool(plugin['spec'].get('enabled')) == enabled and (plugin.get('status', {}).get('phase') == 'STARTED') == enabled:
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
        if plugin and plugin['metadata'].get('deletionTimestamp'):
            gone(name); plugin = None
        if plugin is None:
            boundary = 'feed-reinstall-' + secrets.token_hex(10)
            jar = Path(original['jar'])
            body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{jar.name}"\r\nContent-Type: application/java-archive\r\n\r\n'.encode()
                    + jar.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
            installed = client.api(check.CONSOLE + '/install', 'POST', body, 'multipart/form-data; boundary=' + boundary)
            check.require(installed['metadata']['name'] == name, 'Reinstalled unexpected plugin')
        plugin = client.api(check.RESOURCE + '/' + name)
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
                status, body = response.status, response.read()
        except urllib.error.HTTPError as error:
            status, body = error.code, error.read()
        (output / (stage + '-' + ('index.html' if path == '/' else path[1:]))).write_bytes(body)
        return status, body

    try:
        config = copy.deepcopy(original_config); config['subscription'] = {'rss': True, 'sitemap': True}
        client.api(check.CONFIG, 'PUT', config)
        for name in originals:
            settled(name, True)
        for name, (_, _, slug) in check.PLUGINS.items():
            plugin = client.api(check.RESOURCE + '/' + name)
            check.require(plugin['spec']['version'] == check.PLUGINS[name][0], 'Plugin changed before uninstall')
            client.api(check.RESOURCE + '/' + name, 'DELETE')
            gone(name)
            status, body = request('/', 'absent-' + slug)
            check.require(status == 200, 'Theme failed with missing plugin')
            head = check.check_page(body.decode(), base, slug != 'feed', slug != 'sitemap')
            path = '/rss.xml' if slug == 'feed' else '/sitemap.xml'
            status, _ = request(path, 'absent-' + slug)
            check.require(status == 404, 'Absent plugin XML route must be 404')
            report['stages'].append({'stage': 'absent-' + slug, 'resourceStatus': 404, 'routeStatus': status, 'headFooter': head, 'result': 'passed'}); save()
            restore_plugin(name, True)
            status, body = request('/', 'reinstalled-' + slug)
            check.require(status == 200, 'Theme failed after reinstall')
            check.check_page(body.decode(), base, True, True)
            status, body = request(path, 'reinstalled-' + slug)
            check.require(status == 200, 'Restored plugin XML route failed')
            (check.rss_items if slug == 'feed' else check.sitemap_items)(body)
            report['stages'].append({'stage': 'reinstalled-' + slug, 'version': check.PLUGINS[name][0], 'sha256': originals[name]['sha256'], 'result': 'passed'}); save()
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
        except Exception as error:
            errors.append('theme: ' + str(error))
        report['restoration'] = {'result': 'failed' if errors else 'passed', 'errors': errors}
        if errors:
            report['result'] = 'failed'
        save()
        if errors:
            raise RuntimeError('Restoration requires attention: ' + '; '.join(errors))
    print('Absent-plugin evidence:', output / 'evidence.json', flush=True)


if __name__ == '__main__':
    main()
