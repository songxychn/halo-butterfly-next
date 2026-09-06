"""Offline regressions for lab ownership, fixture fidelity and non-destructive repeats."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch

spec = importlib.util.spec_from_file_location('comparison_lab', Path(__file__).with_name('lab.py'))
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)


class LabTests(unittest.TestCase):
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


if __name__ == '__main__':
    unittest.main()
