#!/usr/bin/env python3
"""Independent navigation fixture; never alters the comparison lab."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re


def resources(fixture):
    menu_name = fixture['menuName']
    if not re.fullmatch(r'navigation-keyboard(?:-empty|-options)?', menu_name):
        raise ValueError('Fixture must use its task-owned menu name')
    items = []
    seen = set()

    def visit(nodes, parent=None):
        for priority, node in enumerate(nodes):
            name = menu_name + '-' + node['id']
            if not re.fullmatch(r'[a-z0-9-]+', name) or name in seen:
                raise ValueError('Invalid or duplicate fixture ID')
            seen.add(name)
            children = node.get('children')
            if children is not None and not children:
                raise ValueError('Fixture groups must have children')
            spec = {'displayName': node['title'], 'href': '#' if children else node['path'],
                    'target': '_self', 'priority': priority, 'menuName': menu_name}
            if parent:
                spec['parent'] = parent
            annotations = {'icon': node['icon']}
            if 'hide' in node:
                annotations['hide'] = str(node['hide']).lower()
            items.append({'apiVersion': 'v1alpha1', 'kind': 'MenuItem',
                          'metadata': {'name': name, 'annotations': annotations}, 'spec': spec})
            if children:
                visit(children, name)

    visit(fixture['items'])
    menu = {'apiVersion': 'v1alpha1', 'kind': 'Menu', 'metadata': {'name': menu_name},
            'spec': {'displayName': '两级导航键盘合成夹具'}}
    return {'menu': menu, 'items': items}


def hexo_menu(fixture):
    resources(fixture)  # Validate depth and identities before mapping.
    def visit(nodes, depth=0):
        result = {}
        for node in nodes:
            if 'children' in node:
                if depth:
                    raise ValueError('Butterfly 5.7.0 supports only two menu levels')
                label = node['title'] + '||' + node['icon'] + ('||hide' if node.get('hide') else '')
                result[label] = visit(node['children'], depth + 1)
            else:
                result[node['title']] = node['path'] + ' || ' + node['icon']
        return result
    return {'menu': visit(fixture['items'])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['halo-json', 'hexo-json', 'apply', 'restore'])
    parser.add_argument('--fixture', type=Path, default=Path('fixtures/navigation/two-level.json'))
    parser.add_argument('--client-module', type=Path)
    parser.add_argument('--backup', type=Path)
    parser.add_argument('--base', choices=['http://127.0.0.1:18090'])
    args = parser.parse_args()
    fixture = json.loads(args.fixture.read_text())
    planned = resources(fixture)
    if args.action in ['halo-json', 'hexo-json']:
        print(json.dumps(planned if args.action == 'halo-json' else hexo_menu(fixture), ensure_ascii=False))
        return
    if not args.client_module or not args.backup or not args.base:
        parser.error('apply/restore require --client-module, --backup and explicit --base for the isolated port 18090')
    module_spec = importlib.util.spec_from_file_location('halo_navigation_client', args.client_module)
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    if module.BASE != args.base:
        raise ValueError('Client target does not match explicitly authorized isolated base')
    client = module.Client()
    system_path = '/api/v1alpha1/configmaps/system'
    system = client.api(system_path)
    if args.action == 'restore':
        backup = json.loads(args.backup.read_text())
        if backup['base'] != args.base:
            raise ValueError('Restore base mismatch')
        if backup['menuGroup'] is None:
            system['data'].pop('menu', None)
        else:
            system['data']['menu'] = backup['menuGroup']
        client.api(system_path, 'PUT', system)
        print('Restored previous primary-menu setting; synthetic resources retained for repeat runs.')
        return
    if args.backup.exists():
        backup = json.loads(args.backup.read_text())
        if backup['base'] != args.base:
            raise ValueError('Backup base mismatch')
    else:
        args.backup.parent.mkdir(parents=True, exist_ok=True)
        with open(args.backup, 'x', opener=lambda path, flags: os.open(path, flags, 0o600)) as file:
            json.dump({'base': args.base, 'menuGroup': system['data'].get('menu')}, file)
    for plural, obj in [('menus', planned['menu'])] + [('menuitems', x) for x in planned['items']]:
        path = '/api/v1alpha1/' + plural
        existing = {x['metadata']['name']: x for x in client.api(path)['items']}
        name = obj['metadata']['name']
        if name in existing:
            actual = existing[name]
            if plural == 'menuitems' and actual['spec'].get('parent') != obj['spec'].get('parent'):
                raise ValueError('Existing synthetic resource differs; preserving it: ' + name)
            if actual['spec'] != obj['spec'] or actual['metadata'].get('annotations', {}) != obj['metadata'].get('annotations', {}):
                # Halo may fill optional defaults. Preserve those; verify our fields.
                if any(actual['spec'].get(k) != v for k, v in obj['spec'].items()) or actual['metadata'].get('annotations', {}) != obj['metadata'].get('annotations', {}):
                    raise ValueError('Existing synthetic resource differs; preserving it: ' + name)
        else:
            client.api(path, 'POST', obj)
    menu_group = json.loads(system['data'].get('menu', '{}'))
    menu_group['primary'] = fixture['menuName']
    system['data']['menu'] = json.dumps(menu_group)
    client.api(system_path, 'PUT', system)
    print('Activated isolated navigation fixture:', fixture['menuName'], len(planned['items']), 'items')


if __name__ == '__main__':
    main()
