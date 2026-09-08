#!/usr/bin/env python3
"""Change only error404 settings on an explicitly assigned synthetic Halo lab."""
import argparse
import importlib.util
import json
import os
from pathlib import Path


def main(argv=None, client=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['apply', 'restore'])
    parser.add_argument('--profile', default='default')
    parser.add_argument('--base', required=True, choices=['http://127.0.0.1:18095', 'http://127.0.0.1:18096'])
    parser.add_argument('--lab-runtime', type=Path, required=True)
    parser.add_argument('--backup', type=Path, required=True)
    args = parser.parse_args(argv)
    repo = Path(__file__).resolve().parents[2]
    runtime = args.lab_runtime.resolve()
    marker = json.loads((runtime / 'lab.json').read_text())
    if marker.get('owner') != 'halo-butterfly-next-comparison' or args.base != f"http://127.0.0.1:{marker['ports']['halo']}":
        raise ValueError('Explicit base does not match the owned lab marker')
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(marker['ports']['halo']), HEXO_PORT=str(marker['ports']['hexo']))
    spec = importlib.util.spec_from_file_location('error_page_lab', repo / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lab)
    if lab.BASE['halo'] != args.base or not lab.owned_process('halo'):
        raise ValueError('Expected the explicitly assigned lab process')
    profiles = json.loads((repo / 'fixtures/error-page/profiles.json').read_text())
    if args.action == 'apply' and args.profile not in profiles:
        raise ValueError('Unknown profile')
    # A batch runner can reuse one in-memory lab session instead of logging in
    # once per profile. The same ownership/base checks still run for each call.
    client = client or lab.Client()
    path = '/apis/api.console.halo.run/v1alpha1/themes/halo-butterfly-next/json-config'
    config = client.api(path)
    if args.backup.exists():
        backup = json.loads(args.backup.read_text())
        if backup['base'] != args.base or backup['runtime'] != str(runtime):
            raise ValueError('Backup belongs to another lab')
    elif args.action == 'restore':
        raise ValueError('Restore requires the original backup')
    else:
        backup = {'base': args.base, 'runtime': str(runtime), 'present': 'error404' in config, 'error404': config.get('error404')}
        args.backup.parent.mkdir(parents=True, exist_ok=True)
        with open(args.backup, 'x', opener=lambda name, flags: os.open(name, flags, 0o600)) as stream:
            json.dump(backup, stream)
    if args.action == 'restore':
        if backup['present']:
            config['error404'] = backup['error404']
        else:
            config.pop('error404', None)
    else:
        config['error404'] = profiles[args.profile]['settings']
    client.api(path, 'PUT', config)
    expected = config.get('error404')
    actual = client.api(path)
    if actual.get('error404') != expected:
        raise ValueError('Error-page settings did not match the requested profile')
    if {k: v for k, v in actual.items() if k != 'error404'} != {k: v for k, v in config.items() if k != 'error404'}:
        raise ValueError('Unrelated settings changed during profile update')
    print('Error-page profile:', args.profile if args.action == 'apply' else 'restored')


if __name__ == '__main__':
    main()
