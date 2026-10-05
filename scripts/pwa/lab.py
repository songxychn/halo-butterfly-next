"""Isolated local Halo lab for PWA. Never operates on an existing external server."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import secrets
import shutil
import sys
import time
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.runtime/pwa-lab'
os.environ.update(LAB_RUNTIME=str(RUNTIME), HALO_PORT='18097', HEXO_PORT='14007')
spec = importlib.util.spec_from_file_location('pwa_halo_lab', ROOT / 'scripts/lab/lab.py')
lab = importlib.util.module_from_spec(spec); spec.loader.exec_module(lab)
PLUGIN = 'butterfly-pwa'
API = '/apis/api.console.halo.run/v1alpha1/plugins'
IDENTITY = {'owner': 'halo-butterfly-next-pwa', 'halo': 18097, 'schema': 1}


def identity(create=False):
    marker = RUNTIME / 'pwa-owner.json'
    if not marker.exists():
        if not create or (RUNTIME.exists() and any(RUNTIME.iterdir())):
            raise RuntimeError('Refusing unowned PWA lab')
        RUNTIME.mkdir(parents=True, exist_ok=True)
        lab.write_json(marker, IDENTITY)
    if json.loads(marker.read_text()) != IDENTITY: raise RuntimeError('Lab owner mismatch')
    # The shared authenticated client also requires a lab marker; retain our distinct owner.
    shared = RUNTIME / 'lab.json'
    if shared.exists() and json.loads(shared.read_text()) != IDENTITY:
        raise RuntimeError('Foreign shared lab marker')
    if not shared.exists(): lab.write_json(shared, IDENTITY)


def client():
    identity()
    if not lab.owned_process('halo'): raise RuntimeError('Expected an owned Halo process')
    return lab.Client()


def configure(c, enabled):
    path = '/api/v1alpha1/configmaps/butterfly-pwa-config'
    data = {'basic': json.dumps({'enabled': enabled, 'name': 'Butterfly 测试博客', 'shortName': '测试博客'})}
    try:
        existing = c.api(path); existing['data'] = data
        c.api(path, 'PUT', existing)
    except lab.ApiError as error:
        if error.status != 404: raise
        c.api('/api/v1alpha1/configmaps', 'POST', {'apiVersion': 'v1alpha1', 'kind': 'ConfigMap', 'metadata': {'name': 'butterfly-pwa-config'}, 'data': data})


def install(c):
    artifact = ROOT / 'dist/butterfly-pwa-0.1.0.jar'
    with ZipFile(artifact) as z:
        if json.loads(z.read('META-INF/butterfly-pwa.json'))['name'] != PLUGIN: raise RuntimeError('Artifact identity mismatch')
    installed = c.api('/apis/plugin.halo.run/v1alpha1/plugins')['items']
    previous = next((p for p in installed if p['metadata']['name'] == PLUGIN), None)
    marker = RUNTIME / 'plugin-owner.json'
    if previous and not marker.exists(): raise RuntimeError('Existing plugin is not owned by this lab')
    boundary = 'pwa-' + secrets.token_hex(10)
    data = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="plugin.jar"\r\nContent-Type: application/java-archive\r\n\r\n'.encode() + artifact.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
    endpoint = API + '/' + PLUGIN + '/upgrade' if previous else API + '/install'
    c.api(endpoint, 'POST', data, 'multipart/form-data; boundary=' + boundary)
    lab.write_json(marker, {'name': PLUGIN, 'sha256': lab.digest(artifact)})
    c.api(API + '/' + PLUGIN + '/plugin-state', 'PUT', {'enable': True, 'async': False})
    configure(c, True)


def operate(c, command):
    if command == 'probe':
        probe_spec = importlib.util.spec_from_file_location('pwa_layout_probe', ROOT / 'scripts/lab/layout-probe.py')
        probe = importlib.util.module_from_spec(probe_spec); probe_spec.loader.exec_module(probe)
        artifact = RUNTIME / 'layout-probe.jar'
        probe.build(RUNTIME / 'halo/halo-2.26.1.jar', artifact)
        owner = RUNTIME / 'probe-owner.json'
        if not probe.plugin_state(lab, c): probe.install_probe(lab, c, artifact, owner)
        elif not owner.exists(): raise RuntimeError('Foreign layout probe')
        probe.owned_artifact(lab, artifact)
        probe.set_enabled(c, True)
    elif command == 'install': install(c)
    elif command in ['config-on', 'config-off']: configure(c, command == 'config-on')
    else:
        if command not in ['enable', 'disable', 'uninstall']: raise RuntimeError('Invalid control command')
        if not (RUNTIME / 'plugin-owner.json').exists(): raise RuntimeError('No plugin ownership record')
        if command == 'uninstall':
            resource = '/apis/plugin.halo.run/v1alpha1/plugins/' + PLUGIN
            c.api(resource, 'DELETE')
            for attempt in range(90):
                try: c.api(resource)
                except lab.ApiError as error:
                    if error.status == 404: break
                    raise
                time.sleep(.3)
            else: raise RuntimeError('Plugin finalizers did not finish; refusing immediate reinstall')
        else: c.api(API + '/' + PLUGIN + '/plugin-state', 'PUT', {'enable': command == 'enable', 'async': False})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['start', 'install', 'enable', 'disable', 'config-on', 'config-off', 'uninstall', 'stop', 'control'])
    parser.add_argument('--halo-jar')
    args = parser.parse_args()
    if args.command == 'start':
        identity(create=True)
        source = Path(args.halo_jar).resolve()
        if lab.digest(source) != lab.VERSIONS['halo']['sha256']: raise RuntimeError('Wrong Halo artifact')
        (RUNTIME / 'halo').mkdir(exist_ok=True)
        target = RUNTIME / 'halo/halo-2.26.1.jar'
        if not target.exists(): shutil.copyfile(source, target)
        if lab.digest(target) != lab.VERSIONS['halo']['sha256']: raise RuntimeError('Wrong local Halo artifact')
        lab.start(halo_only=True)
        c = lab.Client(initialize=True)
        package = ROOT / 'dist/halo-butterfly-next-0.1.0-alpha.3.zip'
        sha = lab.run(['git', 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
        lab.install(c, package, sha)
        install(c)
    elif args.command == 'stop':
        identity()
        pid = lab.owned_process('halo')
        if pid: os.kill(pid, 15)
    elif args.command == 'control':
        # One authenticated session for a browser lifecycle run avoids repeated login rate limits.
        c = client()
        for line in sys.stdin:
            request = json.loads(line)
            result = {'id': request['id']}
            try:
                operate(c, request['command']); result['ok'] = True
            except Exception as error:
                result.update(ok=False, error=str(error))
            print('PWA-CONTROL:' + json.dumps(result), flush=True)
    else:
        c = client()
        operate(c, args.command)
    print('PWA lab:', args.command)


if __name__ == '__main__': main()
