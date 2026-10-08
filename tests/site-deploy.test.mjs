import {test} from 'bun:test';
import {execFileSync} from 'node:child_process';

test('initial deployment rejects changed publication ownership and metadata', () => {
  execFileSync('python3', ['-B', '-c', `
import sys, copy
sys.path[:0] = ['site/tools', 'site/deploy']
from initialize import verify_content, OWNER
spec = {'title': 'Source title', 'visible': 'PUBLIC', 'allowComment': False, 'publish': False}
obj = {'metadata': {'version': 5, 'annotations': {OWNER: 'halo-butterfly-next-docs-site'}}, 'spec': dict(spec)}
verify_content(obj, spec)
reconciled = copy.deepcopy(obj)
reconciled['metadata']['version'] = 6
reconciled['spec']['publish'] = True
verify_content(reconciled, spec)
for key, value in [('title', 'Backend edit'), ('visible', 'PRIVATE'), ('allowComment', True)]:
    changed = copy.deepcopy(obj)
    changed['spec'][key] = value
    try:
        verify_content(changed, spec)
    except RuntimeError:
        pass
    else:
        raise AssertionError('Accepted changed ' + key)
changed = copy.deepcopy(obj)
changed['metadata']['annotations'][OWNER] = 'another-owner'
try:
    verify_content(changed, spec)
except RuntimeError:
    pass
else:
    raise AssertionError('Accepted unowned content')
`], {stdio: 'pipe'});
});
