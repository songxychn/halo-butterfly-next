"""Offline regressions for lab ownership, fixture fidelity and non-destructive repeats."""
import importlib.util
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch

spec = importlib.util.spec_from_file_location('comparison_lab', Path(__file__).with_name('lab.py'))
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)


class LabTests(unittest.TestCase):
    def test_halo_only_start_does_not_launch_or_probe_hexo(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(lab, 'RUNTIME', Path(directory)), patch.object(lab, 'owned_process', return_value=None), patch.object(lab, 'listening', return_value=False), patch.object(lab.subprocess, 'Popen') as launch, patch.object(lab.LOCAL, 'open') as request:
                launch.return_value.pid = 12345
                lab.start(halo_only=True)
                launch.assert_called_once()
                command = launch.call_args.args[0]
                self.assertEqual(command[0], 'java')
                self.assertIn('--server.address=127.0.0.1', command)
                request.assert_called_once_with(lab.BASE['halo'] + '/actuator/health/readiness', timeout=5)
                self.assertFalse((Path(directory) / 'hexo-process.json').exists())

    def test_no_reference_still_checks_halo_content_without_hexo_database(self):
        class Client:
            drift = False
            def api(self, path):
                for kind in ['categories', 'tags']:
                    if path.endswith('/' + kind + '?size=100'):
                        return {'items': [{'metadata': {'name': x['name']}, 'spec': {'slug': x['name'], 'displayName': x['title']}} for x in lab.CONTENT[kind]]}
                if path.endswith('/posts?size=100'):
                    return {'items': [{'metadata': {'name': x['name']}, 'spec': {**x, 'publish': True, 'publishTime': x['date']}} for x in lab.CONTENT['posts']]}
                if path.endswith('/singlepages?size=100'):
                    return {'items': [{'metadata': {'name': x['name']}, 'spec': {**x, 'publish': True}} for x in lab.CONTENT['pages']]}
                if path.endswith('/release-content'):
                    name = path.split('/')[-2]
                    return {'raw': 'incorrect body' if self.drift else lab.body(next(x for x in lab.CONTENT['posts'] if x['name'] == name))}
                raise AssertionError(path)
        with tempfile.TemporaryDirectory() as directory, patch.object(lab, 'RUNTIME', Path(directory)):
            client = Client()
            self.assertEqual(len(lab.validate_content(client, reference=False)), 12)
            client.drift = True
            with self.assertRaisesRegex(RuntimeError, 'Halo released body differs'):
                lab.validate_content(client, reference=False)

    def test_initial_plugin_conflict_refreshes_latest_resource_and_preserves_other_fields(self):
        path = '/apis/plugin.halo.run/v1alpha1/plugins/ai-foundation'
        first = {'metadata': {'name': 'ai-foundation', 'version': 1}, 'spec': {'enabled': True, 'version': '1'}, 'status': {'phase': 'STARTING'}}
        latest = {'metadata': {'name': 'ai-foundation', 'version': 2, 'annotations': {'new': 'keep'}}, 'spec': {'enabled': True, 'version': '2'}, 'status': {'phase': 'STARTED'}}
        calls = []
        class Client:
            def api(self, url, method='GET', data=None):
                calls.append((url, method, copy.deepcopy(data)))
                if method == 'GET':
                    return copy.deepcopy(first if len(calls) == 1 else latest)
                if len(calls) == 2:
                    raise lab.ApiError(method, url, 409)
        with patch.object(lab.time, 'sleep') as sleep:
            lab.disable_initial_plugin(Client(), 'ai-foundation')
        self.assertEqual([(url, method) for url, method, _ in calls], [(path, 'GET'), (path, 'PUT'), (path, 'GET'), (path, 'PUT')])
        expected = copy.deepcopy(latest); expected['spec']['enabled'] = False
        self.assertEqual(calls[-1][2], expected)
        sleep.assert_called_once_with(0.1)

    def test_initial_plugin_already_disabled_or_disabled_during_conflict_needs_no_more_put(self):
        for conflict in [False, True]:
            with self.subTest(conflict=conflict):
                calls = []
                class Client:
                    def api(self, path, method='GET', data=None):
                        calls.append(method)
                        if method == 'GET':
                            return {'metadata': {'name': 'fixture-plugin'}, 'spec': {'enabled': conflict and len(calls) == 1}}
                        raise lab.ApiError(method, path, 409)
                with patch.object(lab.time, 'sleep'):
                    lab.disable_initial_plugin(Client(), 'fixture-plugin')
                self.assertEqual(calls, ['GET', 'PUT', 'GET'] if conflict else ['GET'])

    def test_initial_plugin_persistent_conflict_is_bounded_and_non409_is_not_retried(self):
        for status in [409, 400, 401, 403, 404, 500]:
            with self.subTest(status=status):
                calls = []
                class Client:
                    def api(self, path, method='GET', data=None):
                        calls.append(method)
                        if method == 'GET':
                            return {'metadata': {'name': 'fixture-plugin', 'version': len(calls)}, 'spec': {'enabled': True}}
                        raise lab.ApiError(method, path, status)
                with patch.object(lab.time, 'sleep') as sleep, self.assertRaises(lab.ApiError) as error:
                    lab.disable_initial_plugin(Client(), 'fixture-plugin')
                self.assertEqual(error.exception.status, status)
                self.assertEqual(calls, ['GET', 'PUT'] * (4 if status == 409 else 1))
                self.assertEqual([call.args[0] for call in sleep.call_args_list], [0.1, 0.2, 0.4] if status == 409 else [])

    def test_initial_plugin_read_error_is_not_retried_or_written(self):
        client = MagicMock()
        client.api.side_effect = lab.ApiError('GET', '/plugin', 404)
        with patch.object(lab.time, 'sleep') as sleep, self.assertRaises(lab.ApiError):
            lab.disable_initial_plugin(client, 'fixture-plugin')
        client.api.assert_called_once_with('/apis/plugin.halo.run/v1alpha1/plugins/fixture-plugin')
        sleep.assert_not_called()

    def test_nonempty_runtime_is_never_claimed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'credentials.json').write_text('preserve me')
            with patch.object(lab, 'RUNTIME', root), self.assertRaisesRegex(RuntimeError, 'Refusing to claim'):
                lab.prepare()
            self.assertEqual((root / 'credentials.json').read_text(), 'preserve me')
            self.assertFalse((root / 'lab.json').exists())

    def test_api_client_requires_owned_process(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(lab, 'RUNTIME', Path(directory)), self.assertRaisesRegex(RuntimeError, 'owned Halo'):
                lab.Client(initialize=True)
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_private_credentials_mode(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'credentials.json'
            lab.write_json(path, {'password': 'synthetic'}, private=True)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_configuration_drift_is_reported_without_write(self):
        class FakeClient:
            def api(self, path):
                if 'plugins?' in path: return {'items': []}
                if 'json-config' in path: return {'style': {'mode': 'dark'}}
                return {'data': {'basic': '{}'}}
        with self.assertRaisesRegex(RuntimeError, 'Configuration drift at style.mode'):
            lab.validate_config(FakeClient(), {'themeConfig': {'style': {'mode': 'user'}}, 'systemConfig': {}})

    def test_repeat_checks_existing_config_and_makes_no_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            saved = {'fixtureSha256': lab.fixture_hash(), 'hexoInputs': {}, 'themeConfig': {}, 'systemConfig': {}}
            lab.write_json(root / 'seed.json', saved)
            with patch.object(lab, 'RUNTIME', root), patch.object(lab, 'validate_content') as content, patch.object(lab, 'validate_config') as config:
                lab.seed(object())
                content.assert_called_once()
                config.assert_called_once()
                self.assertEqual(json.loads((root / 'seed.json').read_text()), saved)

    def test_changed_fixture_refuses_repeat_before_mutation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            lab.write_json(root / 'seed.json', {'fixtureSha256': 'different'})
            with patch.object(lab, 'RUNTIME', root), self.assertRaisesRegex(RuntimeError, 'Fixtures changed'):
                lab.seed(object())

    def test_resource_parser_collects_fetches_but_not_navigation(self):
        parser = lab.Resources()
        parser.feed('<a href="https://example.invalid">link</a><img src="data:x" data-lazy-src="/lab/cover.svg"><script src="/main.js"></script><link rel="stylesheet" href="/main.css">')
        self.assertEqual(parser.urls, {'data:x', '/lab/cover.svg', '/main.js', '/main.css'})

    def test_resource_parser_accepts_multiple_rel_tokens(self):
        parser = lab.Resources()
        parser.feed('<link rel="preload stylesheet" href="/page.css"><link rel="STYLESHEET preload" href="/other.css"><link rel="shortcut\ticon" href="/icon.svg"><link rel="preload" href="/unrelated">')
        self.assertEqual(parser.urls, {'/page.css', '/other.css', '/icon.svg'})

    def test_resource_rejects_successful_html_fallback(self):
        for content_type in ['text/html; charset=UTF-8', 'Text/HTML', 'application/xhtml+xml']:
            with self.subTest(content_type=content_type):
                response = MagicMock(status=200, headers={'Content-Type': content_type})
                response.__enter__.return_value = response
                with patch.object(lab.LOCAL, 'open', return_value=response), self.assertRaisesRegex(RuntimeError, 'did not return asset content'):
                    lab.resource_result('http://127.0.0.1:18091/missing.css')
                response.read.assert_not_called()

    def test_resource_records_real_css_content(self):
        response = MagicMock(status=200, headers={'Content-Type': 'text/css; charset=UTF-8'})
        response.__enter__.return_value = response
        response.read.return_value = b'body { color: black; }'
        with patch.object(lab.LOCAL, 'open', return_value=response):
            result = lab.resource_result('http://127.0.0.1:18091/page.css')
        self.assertEqual(result['status'], 200)
        self.assertEqual(result['contentType'], 'text/css')
        self.assertEqual(result['sha256'], lab.hashlib.sha256(response.read.return_value).hexdigest())

    def test_taxonomy_collection_rejects_unreferenced_default(self):
        class FakeClient:
            def api(self, path):
                return {'items': [{'metadata': {'name': 'development'}, 'spec': {'slug': 'development', 'displayName': '主题开发'}}, {'metadata': {'name': 'initial-default'}, 'spec': {'slug': 'default', 'displayName': '默认分类'}}]}
        with self.assertRaisesRegex(RuntimeError, 'Taxonomy collection differs'):
            lab.validate_taxonomies(FakeClient(), {'Category': [{'name': '主题开发'}], 'Tag': [{'name': 'Butterfly'}]})

    def test_taxonomy_collections_match_both_platforms(self):
        class FakeClient:
            def api(self, path):
                plural = 'categories' if 'categories?' in path else 'tags'
                return {'items': [{'metadata': {'name': item['name']}, 'spec': {'slug': item['name'], 'displayName': item['title']}} for item in lab.CONTENT[plural]]}
        lab.validate_taxonomies(FakeClient(), {'Category': [{'name': '主题开发'}], 'Tag': [{'name': 'Butterfly'}]})

    def test_menu_validation_rejects_missing_icon(self):
        class FakeClient:
            def api(self, path):
                if '/menus/' in path:
                    return {'spec': {'menuItems': ['comparison-menu-' + str(i) for i in range(len(lab.CONTENT['menu']))]}}
                item = lab.CONTENT['menu'][0]
                return {'metadata': {}, 'spec': {'displayName': item['title'], 'href': item['path'], 'target': '_self', 'priority': 0, 'children': [], 'menuName': 'comparison-primary'}}
        with self.assertRaisesRegex(RuntimeError, 'Menu item or icon differs'):
            lab.validate_menu(FakeClient())

    def test_menu_validation_requires_finder_menu_name(self):
        class FakeClient:
            def api(self, path):
                if '/menus/' in path:
                    return {'spec': {'menuItems': ['comparison-menu-' + str(i) for i in range(len(lab.CONTENT['menu']))]}}
                item = lab.CONTENT['menu'][0]
                return {'metadata': {'annotations': {'icon': item['icon']}}, 'spec': {'displayName': item['title'], 'href': item['path'], 'target': '_self', 'priority': 0, 'children': []}}
        with self.assertRaisesRegex(RuntimeError, 'Menu item or icon differs'):
            lab.validate_menu(FakeClient())

    @staticmethod
    def rendered_menu_fixture(platform):
        links = ''.join('<div><a href="' + item['path'] + '"><i class="fa-fw ' + item['icon'] + '"></i><span> ' + item['title'] + '</span></a></div>' for item in lab.CONTENT['menu'])
        if platform == 'halo':
            return '<nav><menu class="menu">' + links + '</menu></nav><div class="side-bar"><img src="/avatar.svg"><menu class="bar">' + links + '</menu></div>'
        return '<div id="sidebar-menus"><img src="/avatar.svg"><div class="menus_items">' + links + '</div></div><nav><div id="menus"><div class="menus_items">' + links + '</div></div></nav>'

    def test_rendered_menu_evidence_checks_both_platforms_and_surfaces(self):
        for platform in ['halo', 'hexo']:
            with self.subTest(platform=platform):
                actual = lab.validate_rendered_menus(self.rendered_menu_fixture(platform), platform)
                self.assertEqual(set(actual), {'desktop', 'mobile'})
                self.assertEqual({key: len(items) for key, items in actual.items()}, {'desktop': 5, 'mobile': 5})

    def test_rendered_menu_evidence_rejects_empty_halo_menus(self):
        with self.assertRaisesRegex(RuntimeError, 'menu count differs.*0'):
            lab.validate_rendered_menus('<nav><menu class="menu"></menu></nav><div class="side-bar"><menu class="bar"></menu></div>', 'halo')

    def test_rendered_menu_evidence_rejects_wrong_text_href_or_icon(self):
        markup = self.rendered_menu_fixture('halo')
        for before, after in [('首页', '其他'), ('href="/"', 'href="/unexpected/"'), ('fas fa-home', 'fas fa-missing')]:
            with self.subTest(before=before), self.assertRaisesRegex(RuntimeError, 'navigation differs'):
                lab.validate_rendered_menus(markup.replace(before, after, 1), 'halo')

    def test_rendered_menu_evidence_requires_mobile_container(self):
        markup = self.rendered_menu_fixture('halo').replace('class="bar"', 'class="other"')
        with self.assertRaisesRegex(RuntimeError, 'containers are missing'):
            lab.validate_rendered_menus(markup, 'halo')

    def test_initial_taxonomy_cleanup_requires_fresh_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            client = MagicMock()
            with patch.object(lab, 'RUNTIME', Path(directory)), self.assertRaisesRegex(RuntimeError, 'Fresh initialization snapshot unavailable'):
                lab.cleanup_initial_taxonomies(client)
            client.api.assert_not_called()

    def test_initial_taxonomy_cleanup_preserves_other_post_references(self):
        welcome = {'metadata': {'name': 'initial-welcome'}, 'spec': {'title': 'Hello Halo', 'slug': 'hello-halo', 'owner': 'fixture', 'publish': False, 'categories': [], 'tags': []}}
        original = {'metadata': welcome['metadata'], 'spec': {**welcome['spec'], 'categories': ['initial-default']}}
        snapshot = {'posts': [original], 'categories': [{'metadata': {'name': 'initial-default'}, 'spec': {'slug': 'default'}}], 'tags': []}
        class FakeClient:
            def __init__(self): self.calls = []
            def api(self, path, method='GET', data=None):
                self.calls.append((path, method))
                if path.endswith('/initial-welcome'): return welcome
                return {'items': [welcome, {'spec': {'categories': ['initial-default']}}]}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            lab.write_json(root / 'initial-content.json', snapshot, private=True)
            client = FakeClient()
            with patch.object(lab, 'RUNTIME', root), self.assertRaisesRegex(RuntimeError, 'referenced by another article'):
                lab.cleanup_initial_taxonomies(client)
            self.assertTrue(all(method == 'GET' for _, method in client.calls))


if __name__ == '__main__':
    unittest.main()
