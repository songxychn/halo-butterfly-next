"""Offline artifact/privacy and ownership boundaries for ephemeral CI."""
import importlib.util
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('linux_halo_ci', Path(__file__).with_name('run.py'))
ci = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ci)


class Guards(unittest.TestCase):
    def test_matching_state_waits_for_phase_without_duplicate_put(self):
        for enabled, phases in [(True, ['RESOLVED', 'RESOLVED', 'STARTED']),
                                (False, ['DISABLING', 'DISABLING', 'DISABLED'])]:
            states = iter([{'spec': {'enabled': enabled}, 'status': {'phase': phase}} for phase in phases])
            class Client:
                def api(self, path, method='GET', data=None):
                    if method != 'GET':
                        raise AssertionError('Matching enabled state must not be mutated')
                    return next(states)
            with patch.object(ci.time, 'sleep'):
                ci.set_plugin_enabled(SimpleNamespace(), Client(), 'search', enabled)

    def test_state_conflict_rereads_before_deciding_whether_to_retry(self):
        class ApiError(Exception):
            status = 409
        class Client:
            reads = 0
            writes = 0
            def api(self, path, method='GET', data=None):
                if method == 'PUT':
                    self.writes += 1
                    raise ApiError()
                self.reads += 1
                return {'spec': {'enabled': self.reads > 1}, 'status': {'phase': 'STARTED'}}
        client = Client()
        with patch.object(ci.time, 'sleep'):
            ci.set_plugin_enabled(SimpleNamespace(ApiError=ApiError), client, 'search', True)
        self.assertEqual(client.writes, 1)
        self.assertEqual(client.reads, 3)

    def test_state_conflicts_are_bounded_and_other_errors_are_not_retried(self):
        class ApiError(Exception):
            def __init__(self, status): self.status = status
        for status, expected in [(409, 5), (503, 1)]:
            class Client:
                writes = 0
                def api(self, path, method='GET', data=None):
                    if method == 'PUT':
                        self.writes += 1
                        raise ApiError(status)
                    return {'spec': {'enabled': False}, 'status': {'phase': 'RESOLVED'}}
            client = Client()
            with patch.object(ci.time, 'sleep'), self.assertRaises(ApiError):
                ci.set_plugin_enabled(SimpleNamespace(ApiError=ApiError), client, 'search', True)
            self.assertEqual(client.writes, expected)

    def test_matching_enabled_flag_does_not_hide_startup_timeout(self):
        class Client:
            def api(self, path, method='GET', data=None):
                if method != 'GET': raise AssertionError('Unexpected write')
                return {'spec': {'enabled': True}, 'status': {'phase': 'RESOLVED'}}
        with patch.object(ci.time, 'sleep'), self.assertRaisesRegex(RuntimeError, 'did not settle'):
            ci.set_plugin_enabled(SimpleNamespace(), Client(), 'search', True)

    def test_disable_requires_disabled_phase_not_failure_or_unknown_state(self):
        for phase in ['FAILED', 'UNKNOWN', 'DISABLING', 'STARTING', None]:
            class Client:
                def api(self, path, method='GET', data=None):
                    if method != 'GET': raise AssertionError('Unexpected duplicate disable write')
                    return {'spec': {'enabled': False}, 'status': {'phase': phase}}
            with patch.object(ci.time, 'sleep'), self.assertRaisesRegex(RuntimeError, 'did not settle'):
                ci.set_plugin_enabled(SimpleNamespace(), Client(), 'search', False)

    def test_matrix_summary_does_not_export_storage_headers_or_runtime_config(self):
        result = {'platform': {'type': 'Linux'}, 'headers': {'secret': 'never'}, 'engines': [
            {'name': 'firefox', 'status': 'failed', 'pages': [{'path': '/', 'viewport': {'width': 390}, 'mode': 'dark', 'status': 'failed', 'failures': ['timeout'], 'jsErrors': [], 'storage': {'secret': 'never'}, 'diagnostics': {'failure': {'readyState': 'loading', 'pending': []}}}]}]}
        summary = ci.matrix_summary(result)
        self.assertEqual(summary['engines'][0]['failures'][0]['lifecycle']['readyState'], 'loading')
        self.assertEqual(summary['requestHeaders'], 'not collected')
        self.assertNotIn('never', json.dumps(summary))

    def test_comment_profile_updates_only_selected_fields_and_checks_readback(self):
        config = {'metadata': {'name': 'comments'}, 'data': {'basic': json.dumps({'unrelated': 'preserved'}), 'other': '{}'}}
        class Client:
            def api(self, path, method='GET', data=None):
                if path.endswith('/PluginCommentWidget'):
                    return {'spec': {'configMapName': 'comments'}}
                if method == 'PUT':
                    config.update(copy.deepcopy(data))
                return copy.deepcopy(config)
        ci.configure_comments(Client())
        self.assertEqual(json.loads(config['data']['basic'])['unrelated'], 'preserved')
        self.assertEqual(config['data']['other'], '{}')
        self.assertFalse(json.loads(config['data']['avatar'])['enable'])
        self.assertEqual(json.loads(config['data']['basic'])['size'], 20)

    def test_allowlist_does_not_export_private_runtime_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            run = root / 'runtime/runs/one'
            run.mkdir(parents=True)
            for name in ['report.json', 'chromium-1440-light-0.json', 'firefox-390-dark-9-diagnostic.png', 'credentials.json', 'plugin-auth.private.json', 'storage.json', 'halo.log', 'config.private.json', 'database.db']:
                (run / name).write_text('synthetic')
            (run / 'nested').mkdir()
            (run / 'nested/secret.json').write_text('private')
            count = ci.collect_browser_reports(root / 'runtime', root / 'output')
            self.assertEqual(count, 3)
            self.assertEqual({x.name for x in (root / 'output/browser/one').iterdir()}, {'report.json', 'chromium-1440-light-0.json', 'firefox-390-dark-9-diagnostic.png'})

    def test_even_allowlisted_symlink_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            run = root / 'runtime/runs/one'
            run.mkdir(parents=True)
            private = root / 'credentials.json'
            private.write_text('private')
            (run / 'report.json').symlink_to(private)
            with self.assertRaisesRegex(RuntimeError, 'symlink'):
                ci.collect_browser_reports(root / 'runtime', root / 'output')

    def test_temporary_paths_cannot_escape_or_claim_parent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            self.assertEqual(ci.temporary_path(root / 'owned', root), root / 'owned')
            for value in [root, root.parent / 'outside', root / '../outside']:
                with self.assertRaises(RuntimeError):
                    ci.temporary_path(value, root)
            (root / 'link').symlink_to(root.parent)
            with self.assertRaises(RuntimeError):
                ci.temporary_path(root / 'link/owned', root)

    def test_cleanup_refuses_another_ci_job(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            ci.write(root / 'linux-ci-owner.json', {'runId': 'previous', 'repository': 'owner/repo'})
            with patch.dict(ci.os.environ, {'GITHUB_RUN_ID': 'current', 'GITHUB_REPOSITORY': 'owner/repo'}), patch.object(ci.subprocess, 'run') as run:
                with self.assertRaisesRegex(RuntimeError, 'different CI job'):
                    ci.stop_owned(root)
                run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
