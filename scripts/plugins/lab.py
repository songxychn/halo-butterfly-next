#!/usr/bin/env python3
"""Owned, synthetic P+ fixture; changes only the explicitly claimed isolated lab."""
import argparse
import copy
import hashlib
import base64
import io
import importlib.util
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
import tarfile
import urllib.error
import urllib.request
from urllib.parse import urlsplit
from zipfile import ZipFile

REPO = Path(__file__).resolve().parents[2]
FIXTURES = REPO / 'fixtures/plugins'
LOCK = json.loads((FIXTURES / 'versions.json').read_text())
CONTENT = json.loads((FIXTURES / 'content.json').read_text())
REFERENCE_ASSET = json.loads((FIXTURES / 'reference-asset.json').read_text())
OWNER = LOCK['owner']
LABEL = 'fixture.butterfly-next.halo.run/owner'
RESOURCE = '/apis/plugin.halo.run/v1alpha1/plugins'
CONSOLE = '/apis/api.console.halo.run/v1alpha1/plugins'
COLLECTIONS = {'linkgroups': ('core.halo.run/v1alpha1', 'LinkGroup'),
               'photogroups': ('core.halo.run/v1alpha1', 'PhotoGroup'),
               'links': ('core.halo.run/v1alpha1', 'Link'),
               'photos': ('core.halo.run/v1alpha1', 'Photo'),
               'moments': ('moment.halo.run/v1alpha1', 'Moment')}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), 'w') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2); stream.write('\n')
    path.chmod(0o600)


def read(path):
    return json.loads(path.read_text())


def provenance():
    def git(*args):
        return subprocess.check_output(['git', '-C', str(REPO), *args], text=True).strip()
    return {'sourceCommit': git('rev-parse', 'HEAD'), 'workingTreeClean': not bool(git('status', '--porcelain')),
            'fixtureSha256': sha(canonical({'lock': LOCK, 'content': CONTENT}))}


def load_lab(runtime, ports):
    expected = {'schema': 1, 'owner': 'halo-butterfly-next-comparison', 'ports': ports}
    if not (runtime / 'lab.json').is_file() or read(runtime / 'lab.json') != expected:
        raise RuntimeError('Matching comparison lab ownership/ports required')
    if not (runtime / 'seed.json').is_file():
        raise RuntimeError('Complete the fresh P bootstrap before claiming optional plugins')
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(ports['halo']), HEXO_PORT=str(ports['hexo']))
    spec = importlib.util.spec_from_file_location('plugin_comparison_lab', REPO / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(spec); spec.loader.exec_module(lab)
    if not lab.owned_process('halo') or not lab.owned_process('hexo'):
        raise RuntimeError('Both matching owned processes must be running')
    return lab


def artifact(path, plugin):
    if sha(path.read_bytes()) != plugin['sha256']:
        raise RuntimeError('Plugin JAR SHA mismatch: ' + plugin['name'])
    with ZipFile(path) as jar:
        manifest = jar.read('plugin.yaml')
    if sha(manifest) != plugin['manifestSha256']:
        raise RuntimeError('Plugin manifest mismatch')
    # The full official manifest bytes are pinned after its name/version/requires were inspected.
    return {'name': plugin['name'], 'version': plugin['version'], 'sha256': plugin['sha256']}


def download(directory):
    directory.mkdir(parents=True, exist_ok=True)
    for plugin in LOCK['plugins']:
        path = directory / plugin['jar']
        if not path.exists():
            temporary = path.with_suffix('.part')
            urllib.request.urlretrieve(plugin['url'], temporary)
            artifact(temporary, plugin); temporary.replace(path)
        artifact(path, plugin)
    asset = directory / 'infinitegrid.min.js'
    if not asset.exists():
        data = urllib.request.urlopen(REFERENCE_ASSET['tarball'], timeout=60).read()
        kind, expected = REFERENCE_ASSET['integrity'].split('-', 1)
        if base64.b64encode(hashlib.new(kind, data).digest()).decode() != expected:
            raise RuntimeError('Reference gallery tarball integrity mismatch')
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
            asset.write_bytes(archive.extractfile(REFERENCE_ASSET['file']).read())
    if sha(asset.read_bytes()) != REFERENCE_ASSET['sha256']:
        raise RuntimeError('Reference gallery script SHA mismatch')
    print('Verified three official plugin artifacts')


def maybe(client, lab, path):
    try:
        return client.api(path)
    except lab.ApiError as error:
        if error.status != 404: raise
        return None


def plugin_states(client, lab):
    result = {}
    for p in LOCK['plugins']:
        current = maybe(client, lab, RESOURCE + '/' + p['name'])
        result[p['name']] = None if current is None else {
            'version': current['spec']['version'], 'enabled': current['spec'].get('enabled'),
            'phase': current.get('status', {}).get('phase')}
    return result


def api(collection):
    return '/apis/' + COLLECTIONS[collection][0] + '/' + collection


def clean(obj):
    spec = copy.deepcopy(obj['spec'])
    if obj['kind'] == 'Moment':
        # MomentReconciler asynchronously supplies this server-owned timestamp.
        # Approval boolean, visibility, release date and content remain strict.
        spec.pop('approvedTime', None)
    result = {'apiVersion': obj['apiVersion'], 'kind': obj['kind'],
            'metadata': {'name': obj['metadata']['name'], 'labels': obj['metadata'].get('labels', {}),
                         'annotations': obj['metadata'].get('annotations', {})},
            'spec': spec}
    if obj['kind'] == 'Photo' and obj.get('exif') is not None:
        result['exif'] = copy.deepcopy(obj['exif'])
    return result


def resources(client):
    return {key: sorted([clean(x) for x in client.api(api(key) + '?page=0&size=0')['items']],
                        key=lambda x: x['metadata']['name']) for key in COLLECTIONS}


def validate_payload(payload):
    if set(payload) != set(COLLECTIONS): raise RuntimeError('Unexpected resource collection')
    for key, objects in payload.items():
        seen = set()
        for obj in objects:
            name = obj['metadata']['name']
            if not name.startswith(CONTENT['prefix']) or '/' in name or name in seen:
                raise RuntimeError('Invalid or duplicate fixture resource name')
            seen.add(name)
            if obj['metadata'].get('labels', {}).get(LABEL) != OWNER:
                raise RuntimeError('Unowned resource payload')
            if (obj['apiVersion'], obj['kind']) != COLLECTIONS[key]:
                raise RuntimeError('Unexpected resource model')


def check_state(client, state):
    current = resources(client)
    validate_payload(current)
    if current != state['resources']:
        raise RuntimeError('P+ resource drift; preserving current content')
    if state.get('referenceAssetSha256'):
        asset = Path(state['runtime']) / 'hexo' / REFERENCE_ASSET['destination']
        if not asset.is_file() or sha(asset.read_bytes()) != state['referenceAssetSha256']:
            raise RuntimeError('Reference gallery asset drift')
    for relative, previous in state.get('hexoFiles', {}).items():
        path = Path(state['runtime']) / 'hexo' / relative
        if not path.is_file() or sha(path.read_bytes()) != previous:
            raise RuntimeError('P+ reference input drift; preserving current files')
    return current


def ensure_owner(lab, client, directory, install=False):
    owner_path = lab.RUNTIME / 'plugins-owner.json'
    identity = {'owner': OWNER, 'runtime': str(lab.RUNTIME), 'ports': lab.PORTS,
                'lockSha256': sha(canonical(LOCK))}
    if owner_path.exists():
        state = read(owner_path)
        if any(state.get(k) != v for k, v in identity.items()):
            raise RuntimeError('Plugin fixture ownership or lock mismatch')
    else:
        if not install: raise RuntimeError('Run install to claim the fresh optional-plugin scope')
        original = plugin_states(client, lab)
        if any(x is not None for x in original.values()):
            raise RuntimeError('Refusing to claim pre-existing optional plugins')
        state = {**identity, 'baselinePlugins': original, 'installed': [], 'resources': None, 'hexoFiles': {}}
        write(owner_path, state)
    for p in LOCK['plugins']:
        local = directory / p['jar']; artifact(local, p)
        current = maybe(client, lab, RESOURCE + '/' + p['name'])
        if current is not None and p['name'] not in state['installed']:
            raise RuntimeError('Plugin appeared outside this fixture installation; preserving it')
        if current is None:
            if not install: raise RuntimeError('Owned plugin disappeared')
            boundary = 'pplus-' + secrets.token_hex(12)
            body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{p["jar"]}"\r\nContent-Type: application/java-archive\r\n\r\n'.encode() + local.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
            current = client.api(CONSOLE + '/install', 'POST', body, 'multipart/form-data; boundary=' + boundary)
            state['installed'].append(p['name']); write(owner_path, state)
        if current['metadata']['name'] != p['name'] or current['spec']['version'] != p['version']:
            raise RuntimeError('Installed plugin identity/version differs')
        installed = lab.RUNTIME / 'halo/data/plugins' / (p['name'] + '-' + p['version'] + '.jar')
        artifact(installed, p)
    if state['resources'] is None:
        set_enabled(client, True)
        current = resources(client)
        if any(current.values()): raise RuntimeError('Fresh optional plugin collections must be empty')
        state['resources'] = current; write(owner_path, state)
    return state


def set_enabled(client, enabled):
    for p in LOCK['plugins']:
        client.api(CONSOLE + '/' + p['name'] + '/plugin-state', 'PUT', {'enable': enabled, 'async': False})


def desired(scenario, base, owner):
    shape = CONTENT['scenarios'][scenario]; result = {k: [] for k in COLLECTIONS}
    def add(key, name, spec):
        result[key].append({'apiVersion': COLLECTIONS[key][0], 'kind': COLLECTIONS[key][1],
            'metadata': {'name': name, 'labels': {LABEL: OWNER}, 'annotations': {}}, 'spec': spec})
    for index, group in enumerate(CONTENT['groups'][:shape['groups']]):
        for key in ['linkgroups', 'photogroups']:
            add(key, group['name'], {'displayName': group['title'], 'priority': index + 1})
    for key in ['links', 'photos', 'moments']:
        for i in range(1, shape[key] + 1):
            title = {'links': '合成友链', 'photos': '合成图片', 'moments': '合成瞬间'}[key] + f' {i:02}'
            image = base + CONTENT['assets'][(i - 1) % 2]
            group = CONTENT['groups'][(i - 1) % max(shape['groups'], 1)]['name']
            if key == 'links':
                spec = {'displayName': title, 'url': base + '/about-preview/#pplus-' + str(i), 'logo': image,
                        'description': title + '：本地可重复内容。', 'priority': i, 'groupName': group}
            elif key == 'photos':
                spec = {'displayName': title, 'url': image, 'cover': image, 'description': title + '说明',
                        'priority': i, 'groupName': group, 'tags': ['山川' if i % 2 else '星空']}
            else:
                text = '<p>' + title + '：本地可重复内容。</p>'
                spec = {'content': {'raw': text, 'html': text, 'medium': [{'type': 'PHOTO', 'url': image, 'originType': 'attachment'}]},
                        'owner': owner, 'releaseTime': f'2026-08-{i:02}T04:00:00Z', 'visible': 'PUBLIC',
                        'tags': ['山川' if i % 2 else '星空'], 'approved': True}
            add(key, f'pplus-{key}-{i:02}', spec)
    validate_payload(result)
    return result


def replace_resources(client, old, target):
    validate_payload(target)
    # Related children first on deletion, groups first on creation. All IDs have been guarded.
    for key in reversed(COLLECTIONS):
        targets = {x['metadata']['name']: x for x in target[key]}
        for obj in old[key]:
            name = obj['metadata']['name']
            if name not in targets:
                client.api(api(key) + '/' + name, 'DELETE')
    for key in COLLECTIONS:
        previous = {x['metadata']['name']: x for x in old[key]}
        for obj in target[key]:
            name = obj['metadata']['name']
            if name not in previous:
                client.api(api(key), 'POST', obj)
            elif obj != previous[name]:
                current = client.api(api(key) + '/' + name)
                current['spec'] = obj['spec']; current['metadata']['labels'] = obj['metadata']['labels']
                current['metadata']['annotations'] = obj['metadata']['annotations']
                if key == 'photos':
                    if 'exif' in obj: current['exif'] = obj['exif']
                    else: current.pop('exif', None)
                client.api(api(key) + '/' + name, 'PUT', current)
    deadline = time.monotonic() + 20
    while True:
        actual = resources(client)
        if all({x['metadata']['name'] for x in actual[k]} == {x['metadata']['name'] for x in target[k]} for k in COLLECTIONS):
            return actual
        if time.monotonic() > deadline: raise RuntimeError('Resource reconciliation timed out')
        time.sleep(.25)


def reference_files(target, base):
    groups = []
    for group in target['linkgroups']:
        groups.append({'class_name': group['spec']['displayName'], 'link_list': [
            {'name': x['spec']['displayName'], 'link': base + '/about-preview/#pplus-' + str(int(x['metadata']['name'].split('-')[-1])),
             'avatar': base + urlsplit(x['spec']['logo']).path, 'descr': x['spec']['description']}
            for x in target['links'] if x['spec']['groupName'] == group['metadata']['name']]})
    front = lambda title, kind=None: '---\n' + json.dumps({'title': title, 'date': CONTENT['date'], 'comments': False, **({'type': kind} if kind else {})}, ensure_ascii=False) + '\n---\n'
    gallery = front('图库') + '{% gallery true,10,10 %}\n' + '\n'.join(
        '![' + x['spec']['displayName'] + '](' + base + urlsplit(x['spec']['url']).path + ')'
        for x in target['photos']) + '\n{% endgallery %}\n'
    moments = [{'author': '合成维护者', 'avatar': base + '/lab/avatar.svg', 'date': x['spec']['releaseTime'],
                'content': x['spec']['content']['html'] + '<img src="' + base + CONTENT['assets'][i % 2] + '" alt="合成瞬间图片">', 'tags': x['spec']['tags']}
               for i, x in enumerate(target['moments'])]
    return {'source/_data/link.yml': json.dumps(groups, ensure_ascii=False),
            'source/_data/shuoshuo.yml': json.dumps(moments, ensure_ascii=False),
            'source/links/index.md': front('友情链接', 'link'),
            'source/photos/index.md': gallery,
            'source/moments/index.md': front('瞬间', 'shuoshuo')}


def apply_reference(lab, state, files):
    for relative in files:
        path = lab.RUNTIME / 'hexo' / relative
        if path.exists() and relative not in state['hexoFiles']:
            raise RuntimeError('Refusing to replace unowned Hexo input: ' + relative)
    for relative, value in files.items():
        path = lab.RUNTIME / 'hexo' / relative; path.parent.mkdir(parents=True, exist_ok=True); path.write_text(value)
    subprocess.run(['pnpm', 'exec', 'hexo', 'generate'], cwd=lab.RUNTIME / 'hexo', check=True, stdout=subprocess.DEVNULL)
    state['hexoFiles'] = {key: sha(value.encode()) for key, value in files.items()}


def seed(lab, client, state, scenario):
    check_state(client, state)
    if state.get('scenario') == scenario:
        print('Scenario already matches; no API or reference writes'); return
    target = desired(scenario, lab.BASE['halo'], client.auth['username'])
    state['resources'] = replace_resources(client, state['resources'], target)
    write(lab.RUNTIME / 'plugins-owner.json', state)
    apply_reference(lab, state, reference_files(target, lab.BASE['hexo']))
    state['scenario'] = scenario; write(lab.RUNTIME / 'plugins-owner.json', state)
    print('P+ scenario:', scenario, {k: len(v) for k, v in state['resources'].items()})


def reference_asset(lab, state, directory):
    source = directory / 'infinitegrid.min.js'
    if sha(source.read_bytes()) != REFERENCE_ASSET['sha256']:
        raise RuntimeError('Download and verify the pinned gallery dependency first')
    path = lab.RUNTIME / 'hexo' / REFERENCE_ASSET['destination']
    if path.exists() and sha(path.read_bytes()) != REFERENCE_ASSET['sha256']:
        raise RuntimeError('Unowned/changed gallery asset exists; preserving it')
    if path.exists(): return
    path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(source.read_bytes())
    state['referenceAssetSha256'] = sha(path.read_bytes()); write(lab.RUNTIME / 'plugins-owner.json', state)
    subprocess.run(['pnpm', 'exec', 'hexo', 'generate'], cwd=lab.RUNTIME / 'hexo', check=True, stdout=subprocess.DEVNULL)


def backup(lab, client, state):
    check_state(client, state)
    payload = {'owner': OWNER, 'runtime': str(lab.RUNTIME), 'ports': lab.PORTS,
               'lockSha256': state['lockSha256'], 'resources': state['resources'], 'scenario': state.get('scenario'),
               'hexo': {k: (lab.RUNTIME / 'hexo' / k).read_text() for k in state['hexoFiles']},
               'plugins': plugin_states(client, lab), 'themePackage': read(lab.RUNTIME / 'installed-package.json')}
    result = {'schema': 1, 'payloadSha256': sha(canonical(payload)), 'payload': payload}
    path = lab.RUNTIME / 'plugin-backups' / (time.strftime('%Y%m%dT%H%M%S') + '-' + secrets.token_hex(4) + '.json')
    write(path, result); print('Logical backup:', path); return path


def restore(lab, client, state, path):
    snapshot = read(path); payload = snapshot['payload']
    if sha(canonical(payload)) != snapshot['payloadSha256']:
        raise RuntimeError('Backup checksum mismatch')
    for key in ['owner', 'runtime', 'ports', 'lockSha256']:
        if payload[key] != state[key]: raise RuntimeError('Backup owner/ports/lock mismatch')
    if payload['themePackage'] != read(lab.RUNTIME / 'installed-package.json'):
        raise RuntimeError('Theme changed since backup')
    if payload['plugins'] != plugin_states(client, lab):
        raise RuntimeError('Plugin state changed since logical backup; restore the same lifecycle stage first')
    check_state(client, state)
    validate_payload(payload['resources'])
    allowed_files = set(reference_files({k: [] for k in COLLECTIONS}, lab.BASE['hexo']))
    if not set(payload['hexo']).issubset(allowed_files): raise RuntimeError('Invalid reference backup paths')
    state['resources'] = replace_resources(client, state['resources'], payload['resources'])
    write(lab.RUNTIME / 'plugins-owner.json', state)
    apply_reference(lab, state, payload['hexo'])
    state['scenario'] = payload['scenario']; write(lab.RUNTIME / 'plugins-owner.json', state)
    print('Restored owned logical content snapshot:', path)


def exercise(lab, client, state, args):
    if not args.browser_runtime or not args.package or not args.source_sha:
        raise RuntimeError('exercise requires --browser-runtime, --package and --source-sha')
    proof = {'schema': 1, **provenance(), 'owner': OWNER, 'runtime': str(lab.RUNTIME),
             'ports': lab.PORTS, 'themePackage': read(lab.RUNTIME / 'installed-package.json'), 'stages': []}
    if proof['themePackage']['sourceCommit'] != args.source_sha or proof['themePackage']['sha256'] != sha(args.package.read_bytes()):
        raise RuntimeError('Exercise package/source differs from installed theme record')
    def diagnose(stage, profile='smoke'):
        command = ['node', str(REPO / 'scripts/plugins/diagnose.mjs'), '--lab-runtime', str(lab.RUNTIME),
                   '--browser-runtime', str(args.browser_runtime.resolve()), '--theme-package', str(args.package.resolve()),
                   '--theme-source-sha', args.source_sha, '--stage', stage, '--profile', profile]
        subprocess.run(command, check=True)
    set_enabled(client, True)
    reference_asset(lab, state, args.artifacts.resolve())
    seed(lab, client, state, 'empty'); diagnose('empty')
    proof['stages'].append({'stage': 'empty-enabled', 'plugins': plugin_states(client, lab)})
    seed(lab, client, state, 'normal'); diagnose('normal')
    snapshot = backup(lab, client, state)
    proof['backup'] = {'file': str(snapshot.relative_to(lab.RUNTIME)), 'sha256': sha(snapshot.read_bytes())}
    seed(lab, client, state, 'populated')
    restore(lab, client, state, snapshot)
    if state['resources'] != read(snapshot)['payload']['resources']:
        raise RuntimeError('Logical restore did not reproduce the backed-up semantic resources')
    proof['stages'].append({'stage': 'normal-restored', 'resourceSha256': sha(canonical(state['resources']))})
    set_enabled(client, False); diagnose('disabled')
    proof['stages'].append({'stage': 'disabled', 'plugins': plugin_states(client, lab)})
    set_enabled(client, True)
    seed(lab, client, state, 'populated')
    first = sha(canonical(state))
    seed(lab, client, state, 'populated')
    if sha(canonical(state)) != first: raise RuntimeError('Repeated scenario changed state')
    proof['stages'].append({'stage': 'reenabled-populated-repeat', 'plugins': plugin_states(client, lab), 'ownerSha256': first})
    diagnose('populated', 'full')
    proof['result'] = 'fixture-lifecycle-passed; page results remain independent'
    proof['contractAcceptance'] = False
    destination = lab.RUNTIME / 'plugin-evidence' / ('lifecycle-' + time.strftime('%Y%m%dT%H%M%S') + '-' + secrets.token_hex(4) + '.json')
    write(destination, proof); print('P+ lifecycle:', destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['download', 'install', 'seed', 'verify', 'backup', 'restore', 'enable', 'disable', 'exercise'])
    parser.add_argument('--runtime', type=Path, default=REPO / '.runtime/plugin-lab')
    parser.add_argument('--artifacts', type=Path, default=REPO / '.runtime/downloads')
    parser.add_argument('--halo-port', type=int, default=18094); parser.add_argument('--hexo-port', type=int, default=14004)
    parser.add_argument('--scenario', choices=list(CONTENT['scenarios']), default='populated')
    parser.add_argument('--backup', type=Path)
    parser.add_argument('--browser-runtime', type=Path); parser.add_argument('--package', type=Path); parser.add_argument('--source-sha')
    args = parser.parse_args()
    if args.command == 'download': return download(args.artifacts.resolve())
    lab = load_lab(args.runtime.resolve(), {'halo': args.halo_port, 'hexo': args.hexo_port})
    client = lab.Client(); state = ensure_owner(lab, client, args.artifacts.resolve(), args.command == 'install')
    if args.command == 'seed':
        reference_asset(lab, state, args.artifacts.resolve())
        seed(lab, client, state, args.scenario)
    elif args.command == 'backup': backup(lab, client, state)
    elif args.command == 'restore':
        if not args.backup: parser.error('--backup required')
        restore(lab, client, state, args.backup)
    elif args.command in ['enable', 'disable']:
        if args.command == 'disable': check_state(client, state)
        set_enabled(client, args.command == 'enable')
    elif args.command == 'verify': check_state(client, state); print('Owned resources and reference inputs unchanged')
    elif args.command == 'install': print('Pinned plugins installed; empty collections owned')
    elif args.command == 'exercise': exercise(lab, client, state, args)


if __name__ == '__main__':
    try: main()
    except (RuntimeError, OSError, ValueError, subprocess.CalledProcessError) as error:
        print('Plugin lab error:', error, file=sys.stderr); sys.exit(1)
