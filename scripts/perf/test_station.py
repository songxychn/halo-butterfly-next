import copy, importlib.util, tempfile, unittest, json
from pathlib import Path
spec=importlib.util.spec_from_file_location('perf_station',Path(__file__).with_name('station.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class ApiError(Exception):
    def __init__(self,status):self.status=status
class FakeClient:
    def __init__(self,existing=None,body=None,error=None):self.obj=existing;self.body=body;self.error=error;self.writes=[];self.auth={'username':'fixture-maintainer'}
    def api(self,path,method='GET',body=None):
        if method!='GET':
            self.writes.append((path,method))
            if method=='POST':self.obj=copy.deepcopy(body['post']);self.body=body['content']['raw']
            else:self.obj['spec']['publish']=True
            return self.obj
        if path.endswith('/content') or path.endswith('/release-content'):
            if self.error:raise ApiError(self.error)
            return {'raw':self.body}
        if self.error and self.obj is None:raise ApiError(self.error)
        if self.obj is None:raise ApiError(404)
        return self.obj
class StationTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.lab=type('Lab',(),{'RUNTIME':Path(self.tmp.name),'ApiError':ApiError});self.meta,self.body=module.fixture();self.obj={'spec':{'title':self.meta['title'],'slug':self.meta['name'],'cover':self.meta['cover'],'publishTime':self.meta['date'],'visible':'PUBLIC','publish':True}}
    def tearDown(self):self.tmp.cleanup()
    def test_create_publish_and_repeated_seed_are_idempotent(self):
        c=FakeClient();module.seed(self.lab,c);self.assertEqual([x[1] for x in c.writes],['POST','PUT']);before=list(c.writes);module.seed(self.lab,c);self.assertEqual(c.writes,before)
    def test_conflicting_post_leaves_assets_and_api_untouched(self):
        self.obj['spec']['title']='unrelated';c=FakeClient(self.obj,self.body)
        with self.assertRaises(ValueError):module.seed(self.lab,c)
        self.assertEqual(c.writes,[]);self.assertFalse((self.lab.RUNTIME/'halo').exists())
    def test_conflicting_asset_is_detected_before_any_copy(self):
        dest=self.lab.RUNTIME/'halo/data/attachments/lab';dest.mkdir(parents=True);(dest/'perf-chart-12.svg').write_text('other');c=FakeClient()
        with self.assertRaises(ValueError):module.seed(self.lab,c)
        self.assertEqual(c.writes,[]);self.assertEqual([x.name for x in dest.iterdir()],['perf-chart-12.svg'])
    def test_existing_body_missing_is_not_mistaken_for_missing_post(self):
        c=FakeClient(self.obj,self.body,error=404)
        with self.assertRaises(ApiError):module.seed(self.lab,c)
        self.assertEqual(c.writes,[]);self.assertFalse((self.lab.RUNTIME/'halo').exists())
    def test_server_failure_does_not_create_post(self):
        c=FakeClient(error=500)
        with self.assertRaises(ApiError):module.seed(self.lab,c)
        self.assertEqual(c.writes,[])
    def test_unpublished_matching_fixture_recovers_only_publish(self):
        self.obj['spec']['publish']=False;c=FakeClient(self.obj,self.body);module.seed(self.lab,c);self.assertEqual([x[1] for x in c.writes],['PUT'])
class PluginFixtureTests(unittest.TestCase):
    def setUp(self):
        self.lock=json.loads((module.FIXTURE/'plugin-profile.json').read_text())
        spec=importlib.util.spec_from_file_location('shared_plugin_fixture',module.ROOT/'scripts/plugins/lab.py');self.contract=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.contract)
        self.objects=self.contract.desired('populated','http://127.0.0.1:18900','fixture-owner')
        objects=self.objects
        self.client=type('Client',(),{'api':lambda _,endpoint:{'items':objects[endpoint.split('?')[0].split('/')[-1]]}})()
    def check(self):return module.plugin_collections(self.client,{'PluginPhotos','PluginLinks','PluginMoments'},'http://127.0.0.1:18900','fixture-owner',self.lock)
    def test_shared_populated_contract_matches_every_object(self):
        self.assertEqual({k:len(v) for k,v in self.check().items()},self.lock['counts'])
    def test_same_counts_but_changed_url_group_or_body_do_not_pass(self):
        for kind,field in [('photos','url'),('photos','groupName'),('links','url'),('moments','content')]:
            original=copy.deepcopy(self.objects[kind][0]['spec'][field]);self.objects[kind][0]['spec'][field]='wrong'
            with self.assertRaises(ValueError):self.check()
            self.objects[kind][0]['spec'][field]=original
    def test_wrong_source_lock_or_object_owner_rejected(self):
        self.lock['pluginContentSha256']='0'*64
        with self.assertRaises(ValueError):self.check()
        self.lock=json.loads((module.FIXTURE/'plugin-profile.json').read_text())
        self.objects['moments'][0]['spec']['owner']='someone-else'
        with self.assertRaises(ValueError):self.check()
    def test_default_home_does_not_require_running_optional_plugin_apis(self):
        class NoPlugins:
            def api(self,*args):raise AssertionError('No optional API expected')
        self.assertEqual(module.plugin_collections(NoPlugins(),set(),'http://127.0.0.1:18900','fixture-owner',self.lock),{})
if __name__=='__main__':unittest.main()
