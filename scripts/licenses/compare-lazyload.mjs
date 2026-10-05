/** Compare the pinned upstream factory without changing the vendored runtime. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseSync, traverse, transformFromAstSync } from '@babel/core';

const root = new URL('../../', import.meta.url);
const source = JSON.parse(await readFile(new URL('third-party-licenses/vanilla-lazyload-source.json', root), 'utf8'));
assert.equal(process.argv.length, 3, 'Pass the downloaded official dist/lazyload.min.js path');
const local = await readFile(new URL(source.local.path, root));
const reference = await readFile(process.argv[2]);
const sha256 = value => createHash('sha256').update(value).digest('hex');
assert.equal(sha256(local), source.local.sha256, 'Inherited implementation changed: recheck provenance');
assert.equal(sha256(reference), source.reference.distributionSha256, 'Reference bytes differ from the pinned official package');
const options = { babelrc: false, configFile: false, sourceType: 'unambiguous' };
const generate = ast => transformFromAstSync(ast, undefined, { ...options, comments: false, compact: true }).code;
function normalize(bytes) {
  const functions = [];
  traverse(parseSync(bytes.toString('utf8'), options), { FunctionExpression(path) { functions.push(path.node); } });
  const factory = functions.sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
  assert(factory, 'Expected a factory expression');
  // Isolate the factory from its different module wrapper before normalizing.
  const factoryTree = { type: 'File', program: { type: 'Program', sourceType: 'script', body: [{ type: 'ExpressionStatement', expression: factory }], directives: [] } };
  const tree = parseSync(generate(factoryTree), options);
  const scopes = new Set();
  let bindingCount = 0;
  traverse(tree, { Scopable(path) {
    if (scopes.has(path.scope)) return;
    scopes.add(path.scope);
    for (const binding of Object.values(path.scope.bindings).sort((a, b) => a.identifier.start - b.identifier.start)) {
      path.scope.rename(binding.identifier.name, '__binding_' + bindingCount++);
    }
  } });
  return { code: generate(tree), bindingCount };
}
const actual = normalize(local), expected = normalize(reference);
assert.equal(actual.bindingCount, 277);
assert.equal(expected.bindingCount, 277);
assert.equal(actual.code, expected.code, 'Factory structures differ after local binding normalization');
console.log(JSON.stringify({ referenceVersion: source.reference.version, equal: true, bindingCount: actual.bindingCount, normalizedSha256: sha256(actual.code), scope: 'Factory only; module wrapper differs; exact inherited release is not uniquely identified' }, null, 2));
