import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const source = stripTypeScriptTypes(await readFile(new URL('../src/js/core/App.ts', import.meta.url), 'utf8'))
  .replace(/^import .*;$/gm, '').replace('export default ', '');

test('page initialization retains service, run method, module and cleanup order', () => {
  const calls = [];
  const window = {MainApp: {modules: {}}};
  const service = name => class {constructor() {calls.push(name);}};
  const context = {window, Theme: service('theme'), Common: service('common'), Scroll: service('scroll'), Message: service('message'), useClearPage() {calls.push('cleanup');}};
  vm.runInNewContext(source + '\nglobalThis.initializePage = App;', context);
  class Page {
    constructor() {calls.push('page');}
    run_first() {assert(window.MainApp.useTheme); calls.push('run_first');}
    run_second() {calls.push('run_second');}
    helper() {assert.fail('Non-run methods must not initialize');}
    [Symbol('metadata')]() {assert.fail('Symbol methods must not initialize');}
  }
  class Module {name = 'module'; constructor() {calls.push('module');}}
  const instance = context.initializePage([Module])(Page);
  assert(instance instanceof Page);
  assert(window.MainApp.modules.module instanceof Module);
  assert.deepEqual(calls, ['theme', 'common', 'scroll', 'message', 'page', 'run_first', 'run_second', 'module', 'cleanup']);
});
