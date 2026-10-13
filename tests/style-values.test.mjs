import assert from 'node:assert/strict';
import {test} from 'bun:test';
import {haloSetting} from '../src/js/core/halo-settings.ts';
test('ConfigMap normalization preserves hostile data and cannot pollute prototypes',()=>{
 const payload=JSON.parse('{"realNode":{"__proto__":{"polluted":true},"items":[{"realNode":{"value":"</script>\\u2028\\u2029"}}],"nullable":null}}');
 const result=haloSetting(payload);assert.equal({}.polluted,undefined);assert.equal(Object.getPrototypeOf(result),Object.prototype);assert.equal(Object.hasOwn(result,'__proto__'),true);assert.equal(result.items[0].value,'</script>\u2028\u2029');assert.equal(result.nullable,null);
});
