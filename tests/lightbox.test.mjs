import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('runtime image viewer has an explicit MIT dependency and one implementation', async () => {
  const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.devDependencies.viewerjs, '1.14.0');
  assert.equal(pkg.devDependencies['@fancyapps/ui'], undefined);
  assert.doesNotMatch(await read('pnpm-lock.yaml'), /@fancyapps\/ui/);
  const metadata = JSON.parse(await read('node_modules/viewerjs/package.json'));
  assert.equal(metadata.license, 'MIT');
  assert.match(await read('node_modules/viewerjs/LICENSE'), /Permission is hereby granted/);
  assert.match(await read('src/js/core/_decorator.js'), /export \{default as AmplifyImg\} from '\.\.\/modules\/AmplifyImg'/);
  for (const source of ['src/js/modules/AmplifyImg.js', 'src/js/core/_decorator.js']) {
    assert.doesNotMatch(await read(source), /@fancyapps\/ui|--f-spinner-width/);
  }
});
