import copy, importlib.util, tempfile, unittest, json, os, io
from types import SimpleNamespace
from unittest.mock import Mock, patch
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
class StationSessionTests(unittest.TestCase):
    def test_same_client_and_locked_arguments_used_for_two_fresh_inspections(self):
        client=SimpleNamespace(count=0);args=SimpleNamespace(route='photos',profile='recommended');out=io.StringIO();seen=[]
        def inspect(lab,actual,parameters):
            self.assertIs(actual,client);self.assertIs(parameters,args);actual.count+=1;seen.append(actual.count);return {'sequence':actual.count,'route':parameters.route}
        with patch.object(module,'inspect',side_effect=inspect):module.paired_inspections(None,client,args,io.StringIO('after\n'),out)
        self.assertEqual(seen,[1,2]);self.assertEqual([json.loads(line)['sequence'] for line in out.getvalue().splitlines()],[1,2])
    def test_eof_or_mutation_commands_do_not_trigger_after_inspection(self):
        for command in ['', 'inspect another-host\n','after extra\n']:
            with patch.object(module,'inspect',return_value={'before':True}) as inspect:
                with self.assertRaisesRegex(ValueError,'after-snapshot'):module.paired_inspections(None,None,None,io.StringIO(command),io.StringIO())
                self.assertEqual(inspect.call_count,1)
    def test_authenticated_identity_checked_independently_of_saved_credentials(self):
        current={'user':{'metadata':{'name':'fixture-maintainer'}}};client=SimpleNamespace(auth={'username':'fixture-maintainer'},api=lambda path:current)
        self.assertEqual(module.authenticated_principal(client),'fixture-maintainer')
        for value in [{},{'user':{'metadata':{'name':'different-user'}}}]:
            current=value
            with self.assertRaisesRegex(ValueError,'principal changed'):module.authenticated_principal(client)

class PluginPhaseTests(unittest.TestCase):
    def test_enabled_plugins_must_be_started_not_only_enabled(self):
        plugin={'metadata':{'name':'PluginCommentWidget'},'spec':{'enabled':True},'status':{'phase':'STARTED'}}
        module.validate_enabled_plugins([plugin],{'PluginCommentWidget'})
        for phase in ['FAILED','STARTING','STOPPED',None]:
            plugin['status']['phase']=phase
            with self.assertRaisesRegex(ValueError,'not STARTED'):module.validate_enabled_plugins([plugin],{'PluginCommentWidget'})
    def test_disabled_or_missing_required_plugin_is_rejected(self):
        plugin={'metadata':{'name':'plugin-katex'},'spec':{'enabled':False},'status':{'phase':'DISABLED'}}
        module.validate_enabled_plugins([plugin],set())
        for phase in ['STARTED','STARTING','STOPPING',None]:
            plugin['status']['phase']=phase
            with self.assertRaisesRegex(ValueError,'not DISABLED'):module.validate_enabled_plugins([plugin],set())
        with self.assertRaisesRegex(ValueError,'fixed profile'):module.validate_enabled_plugins([plugin],{'plugin-katex'})
        with self.assertRaisesRegex(ValueError,'fixed profile'):module.validate_enabled_plugins([],{'plugin-katex'})

class PluginConfigTests(unittest.TestCase):
    def test_enabled_and_disabled_configs_both_affect_snapshot(self):
        plugins=[{'metadata':{'name':name},'spec':{'configMapName':name+'-config','enabled':enabled}} for name,enabled in [('a',True),('b',False)]]
        values={'a-config':{'data':{'mode':'default'}},'b-config':{'data':{'private':'local-only'}}}
        client=SimpleNamespace(api=lambda path:copy.deepcopy(values[path.split('/')[-1]]))
        before=module.plugin_configs(client,plugins,ApiError)
        self.assertEqual(set(before),{'a','b'})
        values['b-config']['data']['private']='changed'
        self.assertNotEqual(module.sha(module.canonical(before)),module.sha(module.canonical(module.plugin_configs(client,plugins,ApiError))))
    def test_missing_config_is_explicit_and_server_errors_are_not_hidden(self):
        plugin={'metadata':{'name':'example'},'spec':{'configMapName':'example-config'}}
        def fail(status):
            def get(_):raise ApiError(status)
            return SimpleNamespace(api=get)
        self.assertEqual(module.plugin_configs(fail(404),[plugin],ApiError)['example'],{'configMapName':'example-config','exists':False})
        with self.assertRaises(ApiError):module.plugin_configs(fail(500),[plugin],ApiError)
        plugin['spec']['configMapName']='../other'
        with self.assertRaises(ValueError):module.plugin_configs(fail(404),[plugin],ApiError)
    def test_plugin_without_settings_never_requests_configmap(self):
        client=SimpleNamespace(api=Mock(side_effect=AssertionError('no request expected')))
        self.assertEqual(module.plugin_configs(client,[{'metadata':{'name':'probe'},'spec':{}}],ApiError),{'probe':{'configMapName':None}})
        client.api.assert_not_called()

class StationOwnershipTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.runtime=Path(self.tmp.name)
        (self.runtime/'lab.json').write_text(json.dumps({'schema':1,'owner':'halo-butterfly-next-comparison','ports':{'halo':18845,'hexo':14845}}))
    def tearDown(self):self.tmp.cleanup()
    def load(self,owned):
        lab=SimpleNamespace(owned_process=Mock(side_effect=lambda name: owned if name=='halo' else False),Client=Mock())
        spec=SimpleNamespace(loader=SimpleNamespace(exec_module=lambda _:None))
        with patch.dict(os.environ),patch.object(module.importlib.util,'spec_from_file_location',return_value=spec),patch.object(module.importlib.util,'module_from_spec',return_value=lab):
            value=module.load_lab(self.runtime)
        return lab,value
    def test_halo_performance_does_not_require_unmeasured_hexo_reference(self):
        lab,value=self.load(True)
        self.assertIs(value[0],lab);lab.owned_process.assert_called_once_with('halo');lab.Client.assert_called_once_with()
    def test_missing_or_foreign_halo_still_rejected(self):
        with self.assertRaisesRegex(ValueError,'Owned Halo process'):self.load(False)
    def test_foreign_lab_marker_rejected_before_import_or_client(self):
        (self.runtime/'lab.json').write_text(json.dumps({'schema':1,'owner':'foreign','ports':{'halo':18845,'hexo':14845}}))
        with patch.object(module.importlib.util,'spec_from_file_location') as load:
            with self.assertRaisesRegex(ValueError,'owned comparison'):module.load_lab(self.runtime)
            load.assert_not_called()

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
