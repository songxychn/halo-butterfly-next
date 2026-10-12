import {test} from 'bun:test';
import assert from 'node:assert/strict';
import { navigationURL } from '../src/js/core/navigation-loading.ts';
import { imageLoadingOptions } from '../src/js/core/image-loading.ts';
import { snackbarPosition } from '../src/js/core/_message.ts';
import {beginPage, disposePage, onPageCleanup, pageListen, pageScope} from '../src/js/core/page-lifecycle.ts';

test('navigation retains native anchors, external/download/admin destinations and configured exclusions', () => {
  const base = 'https://example.test/archives/one/';
  for (const target of ['#chapter', base+'#chapter','mailto:a@example.test','https://other.test/','/console','/console/posts','/%61pis/a','/logout','/file.zip','https://a:b@example.test/x','javascript:alert(1)']) assert.equal(navigationURL(target,base),null,target);
  assert.equal(navigationURL('/archives/two/',base).pathname,'/archives/two/');
  assert.equal(navigationURL('/photos?group=a',base).search,'?group=a');
  assert.equal(navigationURL('/private/x',base,'/private/*'),null);
  assert.equal(navigationURL('/about/',base,['/about/']),null);
  assert.equal(navigationURL('/about-more/',base,'/about/').pathname,'/about-more/');
});
test('legacy image configuration stays native/site/unblurred; explicit false and post scope work', () => {
  assert.deepEqual(imageLoadingOptions({}),{enabled:true,native:true,field:'site',blur:false});
  assert.deepEqual(imageLoadingOptions({lazyload_enable:'false',lazyload_native:false,lazyload_field:'post',lazyload_blur:'true'}),{enabled:false,native:false,field:'post',blur:true});
  assert.equal(snackbarPosition('top-right'),'top-right'); assert.equal(snackbarPosition('invalid'),'bottom-left');
});
test('page disposal removes global handlers exactly once across repeated entries and isolates late work', () => {
  const old = globalThis.window; globalThis.window = {};
  try {
    const target = new EventTarget(); let calls=0, cleanups=0;
    for(let i=0;i<6;i++) {
      beginPage(); const scope=pageScope();
      pageListen(target,'click',()=>calls++);
      onPageCleanup(()=>cleanups++);
      target.dispatchEvent(new Event('click')); assert.equal(calls,i+1);
      disposePage(); disposePage();
      target.dispatchEvent(new Event('click')); assert.equal(calls,i+1);
      assert.equal(scope.active,false);
      let late=0; scope.add(()=>late++); assert.equal(late,1);
    }
    assert.equal(cleanups,6);
  } finally {globalThis.window=old;}
});
