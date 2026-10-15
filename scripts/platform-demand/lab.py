#!/usr/bin/env python3
"""Fresh, owned Halo 2.27 lab for patched platform plugins; no production access."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import secrets
import shutil
import signal
import time
import zipfile

ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault('LAB_RUNTIME', str(ROOT / '.runtime/platform-demand/halo-lab'))
os.environ.setdefault('HALO_PORT', '18627')
os.environ.setdefault('HEXO_PORT', '14627')
spec = importlib.util.spec_from_file_location('comparison_lab', ROOT / 'scripts/lab/lab.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
MARKER = {'schema': 1, 'ports': lab.PORTS, 'owner': 'halo-butterfly-next-comparison'}


def owned():
    if json.loads((lab.RUNTIME / 'lab.json').read_text()) != MARKER:
        raise RuntimeError('Lab ownership mismatch')


def install_plugin(client, jar):
    # Identity comes from the artifact, and the installed bytes are recorded below.
    import re
    with zipfile.ZipFile(jar) as archive:
        manifest = archive.read('plugin.yaml').decode()
    name = re.search(r'^  name: *[\"\']?([^\s\"\']+)', manifest, re.M).group(1)
    version = re.search(r'^  version: *[\"\']?([^\s\"\']+)', manifest, re.M).group(1)
    resource = '/apis/plugin.halo.run/v1alpha1/plugins/' + name
    console = '/apis/api.console.halo.run/v1alpha1/plugins'
    try:
        existing = client.api(resource)
    except lab.ApiError as error:
        if error.status != 404:
            raise
        existing = None
    if existing:
        client.api(console + '/' + name + '/plugin-state', 'PUT', {'enable': False, 'async': False})
        client.api(resource, 'DELETE')
        for _ in range(60):
            try:
                client.api(resource)
            except lab.ApiError as error:
                if error.status == 404:
                    break
                raise
            time.sleep(1)
        else:
            raise RuntimeError('Plugin removal timed out')
    boundary = 'platform-demand-' + secrets.token_hex(12)
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="plugin.jar"\r\nContent-Type: application/java-archive\r\n\r\n'.encode() + jar.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
    client.api(console + '/install', 'POST', body, 'multipart/form-data; boundary=' + boundary)
    for _ in range(60):
        try:
            installed = client.api(resource)
            if installed['spec']['version'] == version:
                break
        except lab.ApiError as error:
            if error.status != 404:
                raise
        time.sleep(1)
    else:
        raise RuntimeError('Plugin install timed out')
    client.api(console + '/' + name + '/plugin-state', 'PUT', {'enable': True, 'async': False})
    installed = client.api(resource)
    if installed.get('status', {}).get('phase') != 'STARTED':
        raise RuntimeError('Plugin failed to start')
    lab.write_json(lab.RUNTIME / (name + '-artifact.json'), {'name': name, 'version': version, 'sha256': lab.digest(jar), 'haloVersion': lab.VERSIONS['halo']['version']})
    print('Installed', name, version, lab.digest(jar), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['bootstrap', 'start', 'stop', 'install-theme', 'install-plugin'])
    parser.add_argument('--jar', type=Path)
    parser.add_argument('--package', type=Path)
    parser.add_argument('--source-sha')
    args = parser.parse_args()
    if args.command in ['bootstrap', 'install-theme'] and (not args.package or not args.source_sha):
        parser.error('--package and --source-sha required')
    if args.command in ['bootstrap', 'install-plugin'] and not args.jar:
        parser.error('--jar required')
    if args.command == 'bootstrap':
        if lab.RUNTIME.exists() and any(lab.RUNTIME.iterdir()):
            raise RuntimeError('Fresh runtime required')
        if lab.digest(args.jar) != lab.VERSIONS['halo']['sha256']:
            raise RuntimeError('Halo digest mismatch')
        lab.write_json(lab.RUNTIME / 'lab.json', MARKER)
        (lab.RUNTIME / 'halo').mkdir()
        shutil.copyfile(args.jar, lab.RUNTIME / 'halo' / lab.HALO_JAR_NAME)
        shutil.copytree(lab.FIXTURES / 'assets', lab.RUNTIME / 'halo/data/attachments/lab')
        lab.start(halo_only=True)
        client = lab.Client(initialize=True)
        lab.install(client, args.package, args.source_sha)
        lab.capture_initial_content(client)
        lab.seed(client, reference=False)
        lab.write_json(lab.RUNTIME / 'platform.json', lab.VERSIONS['halo'])
        return
    owned()
    if args.command == 'stop':
        pid = lab.owned_process('halo')
        if pid:
            os.kill(pid, signal.SIGTERM)
            deadline = time.monotonic() + 45
            while time.monotonic() < deadline and (lab.listening(lab.PORTS['halo']) or lab.owned_process('halo')):
                time.sleep(.25)
            if lab.listening(lab.PORTS['halo']) or lab.owned_process('halo'):
                raise RuntimeError('Owned Halo did not stop')
        elif lab.listening(lab.PORTS['halo']):
            raise RuntimeError('Unowned listener; refusing stop')
    elif args.command == 'start':
        lab.start(halo_only=True)
    else:
        if not lab.owned_process('halo'):
            raise RuntimeError('Owned running Halo required')
        client = lab.Client()
        if args.command == 'install-theme':
            lab.install(client, args.package, args.source_sha)
        else:
            install_plugin(client, args.jar)


if __name__ == '__main__':
    main()
