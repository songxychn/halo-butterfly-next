#!/usr/bin/env python3
"""Manage the owned, loopback-only docs site; never operates on a remote Halo."""
import argparse
import fcntl
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent / 'tools'))
from runtime import REPO, Runtime, Client, read_json, write_json
from publish import Publisher, RESOURCE, CONSOLE
from search import set_search


def initialize(client, package):
    root = client.runtime.root
    initial = root / 'initial-content.json'
    if client.initialized_now:
        write_json(initial, {kind: client.api(RESOURCE + kind + '?size=100')['items'] for kind in ['posts', 'categories', 'tags']})
    if not initial.exists():
        raise RuntimeError('Fresh initialization snapshot missing; refusing to adopt an existing site')
    stamp = root / 'initial-prepared.json'
    if not stamp.exists():
        saved = read_json(initial)
        if len(saved['posts']) > 1:
            raise RuntimeError('Unexpected initial content; preserving it')
        for original in saved['posts']:
            name = original['metadata']['name']
            current = client.api(RESOURCE + 'posts/' + name)
            before = {k: v for k, v in original['spec'].items() if k != 'publish'}
            after = {k: v for k, v in current['spec'].items() if k != 'publish'}
            if before != after:
                raise RuntimeError('Initial welcome article was edited; preserving it')
            if current['spec'].get('publish'):
                client.api(CONSOLE + 'posts/' + name + '/unpublish', 'PUT')
        # Isolate the core theme. The original states are retained for inspection.
        plugins = client.api('/apis/plugin.halo.run/v1alpha1/plugins?size=100')['items']
        write_json(root / 'initial-plugins.json', plugins)
        for plugin in plugins:
            if plugin['spec'].get('enabled'):
                plugin['spec']['enabled'] = False
                client.api('/apis/plugin.halo.run/v1alpha1/plugins/' + plugin['metadata']['name'], 'PUT', plugin)
        write_json(stamp, {'welcomeRetained': True, 'optionalPluginsDisabled': True})
    client.install(package)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['init', 'start', 'stop', 'status', 'plan', 'sync', 'publish', 'configure', 'search-enable', 'search-disable'])
    parser.add_argument('--runtime', default=str(REPO / '.runtime/docs-site'))
    parser.add_argument('--port', type=int, default=18141)
    parser.add_argument('--jar-source')
    parser.add_argument('--package')
    args = parser.parse_args()
    runtime = Runtime(args.runtime, args.port)
    if args.command == 'init':
        if not args.jar_source or not args.package:
            parser.error('init requires --jar-source and --package')
        runtime.prepare(args.jar_source)
    runtime.check()
    with (runtime.root / 'operation.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Another site operation is running') from None
        if args.command in ['init', 'start']:
            runtime.start()
        if args.command == 'init':
            initialize(Client(runtime, initialize=True), args.package)
            result = {'command': 'init', 'base': runtime.base, 'theme': read_json(runtime.root / 'installed-theme.json')}
        elif args.command == 'start':
            result = {'command': 'start', 'base': runtime.base}
        elif args.command == 'stop':
            runtime.stop()
            result = {'command': 'stop', 'terminationRequested': True}
        elif args.command == 'status':
            result = {'command': 'status', 'base': runtime.base, 'ownedPid': runtime.owned_pid(), 'listening': runtime.listening()}
        elif args.command in ['search-enable', 'search-disable']:
            result = set_search(Client(runtime), args.command == 'search-enable')
        else:
            publisher = Publisher(Client(runtime))
            result = getattr(publisher, args.command)()
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Site operation failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
