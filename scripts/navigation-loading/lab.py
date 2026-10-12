"""Configure only the task-owned loopback Halo comparison fixture."""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lab'))
import lab


def configure(profile, client=None):
    identity = json.loads((lab.RUNTIME / 'lab.json').read_text())
    if identity != {'schema': 1, 'ports': lab.PORTS, 'owner': 'halo-butterfly-next-comparison'}:
        raise RuntimeError('Lab identity mismatch')
    if not (lab.RUNTIME / 'seed.json').exists():
        raise RuntimeError('Seed the synthetic comparison fixture first')
    client = client or lab.Client()
    route = f'/apis/api.console.halo.run/v1alpha1/themes/{lab.THEME}/json-config'
    config = client.api(route)
    config['pjax'] = {'enable': profile != 'off', 'exclude': '/about-preview/'}
    config['snackbar'] = {'enable': profile != 'off', 'position': 'bottom-right', 'bg_light': '#1f2937', 'bg_dark': '#374151'}
    config.setdefault('loading', {}).update({'enable': profile == 'native', 'instantpage': profile != 'off'})
    config['lazyload'] = {'enable': profile != 'off', 'native': profile == 'native', 'field': 'post' if profile == 'post' else 'site', 'blur': profile != 'off'}
    client.api(route, 'PUT', config)
    print('configured:' + profile, flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('profile', nargs='?', choices=['native', 'deferred', 'post', 'off'])
    parser.add_argument('--stream', action='store_true')
    args = parser.parse_args()
    if args.stream:
        client = lab.Client()
        for line in sys.stdin:
            profile = line.strip()
            if profile not in ['native', 'deferred', 'post', 'off']:
                raise ValueError('Unknown profile')
            configure(profile, client)
    else:
        if not args.profile:
            parser.error('profile is required')
        configure(args.profile)
