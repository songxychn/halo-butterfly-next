"""Offline artifact/privacy and ownership boundaries for ephemeral CI."""
import importlib.util
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('linux_halo_ci', Path(__file__).with_name('run.py'))
ci = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ci)


class Guards(unittest.TestCase):
    def test_plugin_state_conflicts_retry_without_replaying_a_resource(self):
        lab = ci.load_lab()
        endpoint = '/apis/api.console.halo.run/v1alpha1/plugins/PluginSearchWidget/plugin-state'
        for enabled in (False, True):
            with self.subTest(enabled=enabled), patch.object(ci.time, 'sleep') as sleep:
                client = Mock()
                client.api.side_effect = [lab.ApiError('PUT', endpoint, 409),
                                          lab.ApiError('PUT', endpoint, 409), None]
                ci.set_plugin_enabled(lab, client, 'PluginSearchWidget', enabled)
                self.assertEqual(client.api.call_count, 3)
                for call in client.api.call_args_list:
                    self.assertEqual(call.args, (endpoint, 'PUT', {'enable': enabled, 'async': False}))
                self.assertEqual(sleep.call_count, 2)

    def test_plugin_state_conflicts_exhaust_the_budget_and_still_fail(self):
        lab = ci.load_lab()
        client = Mock()
        client.api.side_effect = lab.ApiError('PUT', '/plugin-state', 409)
        with patch.object(ci.time, 'sleep') as sleep, self.assertRaises(lab.ApiError):
            ci.set_plugin_enabled(lab, client, 'PluginSearchWidget', True)
        self.assertEqual(client.api.call_count, 4)
        self.assertEqual(sleep.call_count, 3)

    def test_plugin_state_other_errors_are_never_retried(self):
        lab = ci.load_lab()
        for error in (lab.ApiError('PUT', '/plugin-state', 401),
                      lab.ApiError('PUT', '/plugin-state', 404),
                      lab.ApiError('PUT', '/plugin-state', 500), RuntimeError('transport')):
            with self.subTest(error=str(error)), patch.object(ci.time, 'sleep') as sleep:
                client = Mock()
                client.api.side_effect = error
                with self.assertRaises(type(error)):
                    ci.set_plugin_enabled(lab, client, 'PluginSearchWidget', False)
                self.assertEqual(client.api.call_count, 1)
                sleep.assert_not_called()

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
