import copy
import importlib.util
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
spec = importlib.util.spec_from_file_location('plugin_lab', Path(__file__).with_name('lab.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

class Guards(unittest.TestCase):
    def test_plugin_states_read_without_mutation_owner(self):
        class Client:
            def api(self, path): return {'spec': {'version': '1.0.0', 'enabled': False}, 'status': {'phase': 'STOPPED'}}
        states = m.plugin_states(Client(), None)
        self.assertEqual(len(states), 3)
        self.assertTrue(all(x['enabled'] is False for x in states.values()))

    def test_unowned_runtime(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); (root / 'credentials.json').write_text('personal')
            with self.assertRaises(RuntimeError): m.load_lab(root, {'halo': 18094, 'hexo': 14004})
            self.assertEqual((root / 'credentials.json').read_text(), 'personal')

    def test_fixture_matrix_and_model(self):
        data = m.desired('populated', 'http://127.0.0.1:18094', 'fixture-maintainer')
        self.assertEqual({k: len(v) for k, v in data.items()}, {'linkgroups': 2, 'photogroups': 2, 'links': 4, 'photos': 24, 'moments': 12})
        self.assertEqual(data['moments'][0]['apiVersion'], 'moment.halo.run/v1alpha1')
        self.assertEqual(data['photos'][0]['apiVersion'], 'core.halo.run/v1alpha1')
        self.assertEqual(data['links'][0]['spec']['groupName'], 'pplus-group-a')

    def test_resource_boundary(self):
        source = m.desired('normal', 'http://127.0.0.1:18094', 'fixture-maintainer')
        for mutate in [lambda x: x['metadata'].update(name='personal'), lambda x: x['metadata'].update(name='pplus-../x'), lambda x: x['metadata'].update(labels={}), lambda x: x.update(kind='User')]:
            data = copy.deepcopy(source); mutate(data['links'][0])
            with self.assertRaises(RuntimeError): m.validate_payload(data)
        data = copy.deepcopy(source); data['links'].append(data['links'][0])
        with self.assertRaises(RuntimeError): m.validate_payload(data)

    def test_only_derived_approval_timestamp_is_normalized(self):
        original = m.desired('normal', 'http://127.0.0.1:18094', 'fixture-maintainer')['moments'][0]
        observed = copy.deepcopy(original); observed['spec']['approvedTime'] = '2026-09-06T00:00:00Z'
        self.assertEqual(m.clean(observed), m.clean(original))
        observed['spec']['approved'] = False
        self.assertNotEqual(m.clean(observed), m.clean(original))

    def test_changed_and_unowned_collections_fail_before_mutation(self):
        data = m.desired('normal', 'http://127.0.0.1:18094', 'fixture-maintainer')
        class Client:
            def api(self, url):
                key = url.split('?')[0].split('/')[-1]
                return {'items': data[key]}
        state = {'resources': copy.deepcopy(data), 'hexoFiles': {}}
        m.check_state(Client(), state)
        data['photos'][0]['spec']['displayName'] = 'changed'
        with self.assertRaises(RuntimeError): m.check_state(Client(), state)
        data['photos'][0]['metadata']['labels'] = {}
        with self.assertRaises(RuntimeError): m.check_state(Client(), state)

    def test_unowned_reference_file_not_replaced(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); file = root / 'hexo/source/links/index.md'; file.parent.mkdir(parents=True); file.write_text('personal')
            with self.assertRaises(RuntimeError): m.apply_reference(SimpleNamespace(RUNTIME=root), {'hexoFiles': {}}, {'source/links/index.md': 'new'})
            self.assertEqual(file.read_text(), 'personal')

    def test_corrupt_backup_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            file = Path(d) / 'backup.json'; m.write(file, {'payloadSha256': 'bad', 'payload': {}})
            with self.assertRaisesRegex(RuntimeError, 'checksum'): m.restore(None, None, {}, file)
            self.assertEqual(file.stat().st_mode & 0o077, 0)

    def test_reference_maps_same_names_media_and_dates_without_external_origin(self):
        data = m.desired('normal', 'http://127.0.0.1:18888', 'fixture-maintainer')
        files = m.reference_files(data, 'http://127.0.0.1:14444')
        text = ''.join(files.values())
        self.assertNotIn(':18888', text); self.assertNotIn(':18094', text)
        self.assertIn('合成友链 01', text); self.assertIn('合成图片 01', text); self.assertIn('2026-08-01T04:00:00Z', text)
        self.assertIn('gallery true,10,10', text); self.assertIn('shuoshuo', text)

if __name__ == '__main__': unittest.main()
