import copy, importlib.util, tempfile, unittest
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
if __name__=='__main__':unittest.main()
