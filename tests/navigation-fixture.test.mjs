import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const run = (...args) => JSON.parse(execFileSync('python3', ['-B', 'scripts/navigation/fixture.py', ...args], {encoding: 'utf8'}));
test('两级导航使用 Halo 2.26 parent/menuName 树，固定叶链接、图标和顺序', () => {
  const {menu, items} = run('halo-json');
  assert.equal(items.length, 5);
  assert.deepEqual(items.filter(item => !item.spec.parent).map(item => item.spec.displayName), ['首页', '内容', '标签']);
  const children = items.filter(item => item.spec.parent);
  assert.deepEqual(children.map(item => [item.spec.displayName, item.spec.href, item.metadata.annotations.icon]), [['归档', '/archives', 'fas fa-archive'], ['关于', '/about-preview', 'fas fa-heart']]);
  assert.ok(children.every(item => item.spec.parent === 'navigation-keyboard-content'));
  assert.ok(items.every(item => item.spec.menuName === menu.metadata.name && !('children' in item.spec)));
});
test('双平台两级夹具语义等价；空菜单保持独立菜单身份', () => {
  assert.deepEqual(run('hexo-json'), {menu: {'首页': '/ || fas fa-home', '内容||fas fa-folder': {'归档': '/archives || fas fa-archive', '关于': '/about-preview || fas fa-heart'}, '标签': '/tags || fas fa-tags'}});
  const empty = run('halo-json', '--fixture', 'fixtures/navigation/empty.json');
  assert.equal(empty.menu.metadata.name, 'navigation-keyboard-empty');
  assert.deepEqual(empty.items, []);
});
test('三层菜单与重复ID不会在fixture转换中被静默截断', () => {
  execFileSync('python3', ['-B', '-c', `import importlib.util
s=importlib.util.spec_from_file_location('fixture','scripts/navigation/fixture.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
a={'id':'a','title':'A','icon':'fas fa-home','path':'/'}
for nodes in [[a,a],[dict(a,children=[dict(a,children=[a])])]]:
 try:m.resources({'menuName':'navigation-keyboard','items':nodes})
 except ValueError:pass
 else:raise AssertionError('invalid fixture accepted')
`]);
});
test('apply拒绝既有顶层菜单的非空parent且不改主菜单，兼容平台null默认值', () => {
  execFileSync('python3', ['-B', '-c', `import importlib.util,json,pathlib,sys,tempfile
s=importlib.util.spec_from_file_location('fixture','scripts/navigation/fixture.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
fixture=json.loads(pathlib.Path('fixtures/navigation/two-level.json').read_text())
for parent in ['unexpected-parent',None]:
 with tempfile.TemporaryDirectory() as directory:
  root=pathlib.Path(directory);planned=m.resources(fixture)
  planned['items'][0]['spec']['parent']=parent
  state={'system':{'data':{'menu':json.dumps({'primary':'original-menu'})}},'menus':{'items':[planned['menu']]},'menuitems':{'items':planned['items']},'writes':[]}
  store=root/'state.json';store.write_text(json.dumps(state))
  client=root/'client.py';client.write_text("import json,pathlib\\nBASE='http://127.0.0.1:18090'\\nSTORE=pathlib.Path("+repr(str(store))+")\\nclass Client:\\n def api(self,path,method='GET',data=None):\\n  state=json.loads(STORE.read_text());key='system' if path.endswith('/system') else path.rsplit('/',1)[-1]\\n  if method!='GET':\\n   state['writes'].append([path,method]);state[key]=data;STORE.write_text(json.dumps(state))\\n  return state[key]\\n")
  sys.argv=['fixture.py','apply','--client-module',str(client),'--backup',str(root/'backup.json'),'--base','http://127.0.0.1:18090']
  if parent is not None:
   try:m.main()
   except ValueError as error:assert 'Existing synthetic resource differs' in str(error)
   else:raise AssertionError('unexpected top-level parent accepted')
   result=json.loads(store.read_text());assert result['writes']==[];assert json.loads(result['system']['data']['menu'])['primary']=='original-menu'
  else:
   m.main();result=json.loads(store.read_text());assert result['writes']==[['/api/v1alpha1/configmaps/system','PUT']];assert json.loads(result['system']['data']['menu'])['primary']==fixture['menuName']
`]);
});
