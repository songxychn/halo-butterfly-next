"""Enable the exact bundled official search plugin in the owned local site."""
import time
from urllib.parse import unquote, urlparse
from pathlib import Path
from runtime import REPO, read_json, sha, write_json

NAME = 'PluginSearchWidget'
RESOURCE = '/apis/plugin.halo.run/v1alpha1/plugins/' + NAME
CONSOLE = '/apis/api.console.halo.run/v1alpha1/plugins/' + NAME + '/plugin-state'


def verify_artifact(plugin, root, lock):
    if plugin['metadata']['name'] != NAME or plugin['spec']['version'] != lock['version']:
        raise RuntimeError('Search plugin identity/version differs from the fixed baseline')
    location = urlparse(plugin.get('status', {}).get('loadLocation', ''))
    if location.scheme != 'file' or location.netloc or location.query or location.fragment:
        raise RuntimeError('Search plugin must load from an owned local JAR')
    jar = Path(unquote(location.path))
    directory = root / 'halo/data/plugins'
    if jar.resolve() != jar or not jar.is_relative_to(directory) or jar.suffix != '.jar':
        raise RuntimeError('Search plugin JAR is outside the owned plugin directory')
    if sha(jar.read_bytes()) != lock['sha256']:
        raise RuntimeError('Search plugin JAR differs from the official SHA-256')
    return {'name': NAME, 'version': lock['version'], 'sha256': lock['sha256']}


def set_search(client, enabled):
    root = client.runtime.root
    if not (root / 'initial-prepared.json').exists():
        raise RuntimeError('Run fresh local init before search configuration')
    lock = next(x for x in read_json(REPO / 'fixtures/search-comment/versions.json')['plugins'] if x['name'] == NAME)
    plugin = client.maybe(RESOURCE)
    if not plugin:
        raise RuntimeError('Pinned SearchWidget is missing; install the official locked JAR in this local Halo console first')
    identity = verify_artifact(plugin, root, lock)
    record = root / 'search-plugin.json'
    current = {'uid': plugin['metadata'].get('uid'), 'spec': plugin['spec']}
    before = read_json(record) if record.exists() else None
    if before and current != before['state']:
        # Recover only our previous enable/disable request; preserve other edits.
        intended = {'uid': before['state']['uid'], 'spec': {**before['state']['spec'], 'enabled': before.get('pending')}}
        if 'pending' not in before or current != intended:
            raise RuntimeError('Search plugin changed outside this tool; preserving backend edits')
    changed = plugin['spec'].get('enabled') != enabled
    if changed:
        write_json(root / ('before-search-' + str(time.time_ns()) + '.json'), plugin)
        write_json(record, {'identity': identity, 'state': current, 'pending': enabled})
        client.api(CONSOLE, 'PUT', {'enable': enabled, 'async': False})
    target_phase = 'STARTED' if enabled else 'DISABLED'
    for _ in range(60):
        actual = client.api(RESOURCE)
        if actual['spec'].get('enabled') == enabled and actual.get('status', {}).get('phase') == target_phase:
            break
        time.sleep(.5)
    else:
        raise RuntimeError('Search plugin did not reach ' + target_phase)
    verify_artifact(actual, root, lock)
    expected_spec = {**current['spec'], 'enabled': enabled}
    if actual['spec'] != expected_spec or actual['metadata'].get('uid') != current['uid']:
        raise RuntimeError('Search plugin readback differs from intended state')
    write_json(record, {'identity': identity, 'state': {'uid': actual['metadata'].get('uid'), 'spec': actual['spec']}})
    return {'command': 'search-enable' if enabled else 'search-disable', 'base': client.runtime.base,
            'plugin': identity, 'enabled': enabled, 'phase': target_phase, 'changed': changed,
            'knownLimit': 'Legacy SearchWidget 1.7.1 does not restore trigger focus; fixed in the pinned 1.8.0 baseline'}
