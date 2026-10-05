import copy
import unittest
import tempfile
from pathlib import Path
from search import verify_artifact, NAME
from runtime import ApiError, sha
from publish import Publisher, classify, deep_merge, digest, matches, post_snapshot


class ConflictTests(unittest.TestCase):
    def test_new_resources_are_not_adopted_from_name_or_annotation(self):
        value = {'spec': {'title': 'existing'}}
        with self.assertRaisesRegex(RuntimeError, 'another owner'):
            classify(None, value, False)
        with self.assertRaisesRegex(RuntimeError, 'no local ledger'):
            classify(None, value, True)
        self.assertEqual(classify(None, None, False), 'create')

    def test_manual_metadata_and_body_edits_stop_sync(self):
        before = {'spec': {'title': 'original'}, 'content': {'raw': 'original'}}
        saved = {'fingerprint': digest(before)}
        for changed in [deep_merge(before, {'spec': {'title': 'edited'}}), deep_merge(before, {'content': {'raw': 'edited'}})]:
            with self.assertRaisesRegex(RuntimeError, 'Remote edit conflict'):
                classify(saved, changed, True)
        self.assertEqual(classify(saved, before, True, before), 'unchanged')

    def test_interrupted_write_recovers_only_its_exact_intent(self):
        before = {'spec': {'title': 'before'}, 'content': {'raw': 'before'}}
        after = {'spec': {'title': 'after'}, 'content': {'raw': 'after'}}
        saved = {'fingerprint': digest(before), 'pending': after}
        self.assertEqual(classify(saved, before, True), 'retry')
        self.assertEqual(classify(saved, after, True), 'recover')
        with self.assertRaisesRegex(RuntimeError, 'Interrupted write differs'):
            classify(saved, deep_merge(after, {'content': {'raw': 'manual edit'}}), True)
        with self.assertRaisesRegex(RuntimeError, 'missing'):
            classify(saved, None, False)

    def test_pending_does_not_adopt_fields_outside_write_intent(self):
        before = {'spec': {'title': 'before', 'publish': False, 'template': 'page'}, 'content': {'raw': 'before'}}
        intended = deep_merge(before, {'spec': {'title': 'after'}, 'content': {'raw': 'after'}})
        saved = {'fingerprint': digest(before), 'pending': intended}
        for changed in [deep_merge(intended, {'spec': {'publish': True}}),
                        deep_merge(intended, {'spec': {'template': 'backend-edit'}}),
                        deep_merge(intended, {'spec': {'newBackendField': 'manual'}})]:
            with self.assertRaisesRegex(RuntimeError, 'Interrupted write differs'):
                classify(saved, changed, True)
        self.assertEqual(classify(saved, intended, True), 'recover')

    def test_full_semantics_detect_unrelated_spec_edits(self):
        item = {'spec': {'title': 'demo', 'owner': 'maintainer', 'headSnapshot': 'one', 'publish': False}}
        content = {'raw': 'hello', 'content': '<p>hello</p>', 'rawType': 'HTML', 'snapshotName': 'one'}
        original = post_snapshot(item, content)
        updated = copy.deepcopy(item)
        updated['spec']['headSnapshot'] = 'two'
        self.assertEqual(original, post_snapshot(updated, content))
        updated['spec']['owner'] = 'other'
        self.assertNotEqual(digest(original), digest(post_snapshot(updated, content)))

    def test_partial_theme_merge_preserves_other_settings(self):
        original = {'aside': {'notice': 'old', 'position': 'aside-left'}, 'custom': {'keep': True}}
        result = deep_merge(original, {'aside': {'notice': 'new'}})
        self.assertEqual(result, {'aside': {'notice': 'new', 'position': 'aside-left'}, 'custom': {'keep': True}})
        self.assertEqual(original['aside']['notice'], 'old')
        self.assertTrue(matches(result, {'aside': {'notice': 'new'}}))
        self.assertFalse(matches(result, {'aside': {'unknown': False}}))


class SyncConcurrencyTests(unittest.TestCase):
    def test_read_rejects_snapshot_changed_while_body_is_read(self):
        for kind, plural in [('Post', 'posts'), ('SinglePage', 'singlepages')]:
            obj = {'metadata': {'name': 'owned', 'version': 4},
                   'spec': {'headSnapshot': 'draft', 'baseSnapshot': 'base'}}
            class RacingClient:
                reads = 0
                def maybe(self, path): return obj
                def api(self, path):
                    if '/snapshots/' in path:
                        self.reads += 1
                        return {'metadata': {'version': self.reads}}
                    if path.endswith('/head-content'):
                        return {'snapshotName': 'draft', 'raw': 'backend', 'content': 'backend', 'rawType': 'HTML'}
                    return obj
            publisher = Publisher.__new__(Publisher)
            publisher.client = RacingClient()
            with self.assertRaisesRegex(RuntimeError, 'Content changed while reading'):
                publisher.read_content({'kind': kind, 'id': 'owned'}, with_version=True)

    def test_update_never_refreshes_snapshot_version_after_guard(self):
        for kind in ['Post', 'SinglePage']:
            obj = {'metadata': {'name': 'owned', 'version': 4},
                   'spec': {'headSnapshot': 'draft', 'releaseSnapshot': 'old', 'baseSnapshot': 'base', 'title': 'old'}}
            snapshot = post_snapshot(obj, {'raw': 'old', 'content': 'old', 'rawType': 'HTML'})
            calls = []
            class RacingClient:
                def api(self, path, method=None, data=None):
                    calls.append((path, method, data))
                    if method is None:
                        raise AssertionError('Refreshed snapshot version after validation')
                    # Actual snapshot has advanced to version 8; the checked 7
                    # must remain attached to the request; simulate a 409 response.
                    if data['content']['version'] != 7:
                        raise AssertionError('Did not preserve checked version')
                    raise ApiError(method, path, 409)
            publisher = Publisher.__new__(Publisher)
            publisher.client = RacingClient()
            publisher.state = {'objects': {}}
            publisher.read_content = lambda item, with_version=False: (obj, snapshot, 7)
            publisher.guard = lambda *args, **kwargs: 'update'
            publisher.spec = lambda item: {'title': 'new'}
            publisher.save = lambda: None
            with self.assertRaises(ApiError):
                publisher.upsert_content({'id': 'owned', 'kind': kind}, 'new')
            self.assertEqual(len(calls), 1)
            self.assertEqual(calls[0][1], 'PUT')


class PublicationTests(unittest.TestCase):
    def test_publish_binds_version_and_snapshot_without_retrying_newer_head(self):
        for kind in ['Post', 'SinglePage']:
            calls = []
            class ConcurrentClient:
                def api(self, path, method, value):
                    calls.append((path, method, value))
                    # A backend edit advanced the resource after the caller read it.
                    raise ApiError(method, path, 409)
            publisher = Publisher.__new__(Publisher)
            publisher.client = ConcurrentClient()
            item = {'kind': kind, 'id': 'owned'}
            checked = {'metadata': {'name': 'owned', 'version': 3},
                       'spec': {'headSnapshot': 'checked-head', 'baseSnapshot': 'base', 'publish': False}}
            with self.assertRaisesRegex(RuntimeError, 'refusing to publish a newer snapshot'):
                publisher.release_content(item, checked)
            self.assertEqual(len(calls), 1)
            self.assertEqual(calls[0][2]['metadata']['version'], 3)
            self.assertEqual(calls[0][2]['spec']['releaseSnapshot'], 'checked-head')
            self.assertFalse(checked['spec']['publish'])


class SearchArtifactTests(unittest.TestCase):
    def test_search_uses_exact_owned_jar_not_version_label(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            jar = root / 'halo/data/plugins/search.jar'
            jar.parent.mkdir(parents=True)
            jar.write_bytes(b'fixed artifact')
            lock = {'version': '1.7.1', 'sha256': sha(jar.read_bytes())}
            plugin = {'metadata': {'name': NAME}, 'spec': {'version': '1.7.1'},
                      'status': {'loadLocation': jar.as_uri()}}
            self.assertEqual(verify_artifact(plugin, root, lock)['sha256'], lock['sha256'])
            jar.write_bytes(b'another artifact')
            with self.assertRaisesRegex(RuntimeError, 'SHA-256'):
                verify_artifact(plugin, root, lock)
            plugin['status']['loadLocation'] = (root / 'outside.jar').as_uri()
            with self.assertRaisesRegex(RuntimeError, 'outside'):
                verify_artifact(plugin, root, lock)
            plugin['status']['loadLocation'] = 'https://example.test/search.jar'
            with self.assertRaisesRegex(RuntimeError, 'local JAR'):
                verify_artifact(plugin, root, lock)


if __name__ == '__main__':
    unittest.main()
