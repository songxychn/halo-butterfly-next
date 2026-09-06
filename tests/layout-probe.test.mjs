import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const loader = `
import importlib.util
from pathlib import Path
import tempfile
import json
from zipfile import ZipFile
spec = importlib.util.spec_from_file_location('layout_probe', Path('scripts/lab/layout-probe.py').resolve())
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)
`;
function python(code) {
  const result = spawnSync('python3', ['-B', '-'], {
    cwd: root, input: loader + code, encoding: 'utf8',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
}

test('插件 JAR 条目顺序、时间戳和权限固定，拒绝越界路径', () => python(`
with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    first, second = root / 'a.jar', root / 'b.jar'
    probe.write_jar(first, {'z.class': b'compiled', 'plugin.yaml': b'manifest'})
    probe.write_jar(second, {'plugin.yaml': b'manifest', 'z.class': b'compiled'})
    assert first.read_bytes() == second.read_bytes()
    with ZipFile(first) as archive:
        assert archive.namelist() == ['plugin.yaml', 'z.class']
        assert all(entry.date_time == (2026, 9, 6, 0, 0, 0) for entry in archive.infolist())
        assert all(entry.external_attr >> 16 == 0o100644 for entry in archive.infolist())
    for name in ['../escape', '/absolute', 'a/../escape', 'a\\\\escape']:
        try: probe.write_jar(root / 'bad.jar', {name: b'bad'})
        except RuntimeError: pass
        else: raise AssertionError(name)
`));

test('官方 Halo 摘要不符时不执行编译器，也不覆盖已有产物', () => python(`
with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    halo, output = root / 'halo.jar', root / 'probe.jar'
    halo.write_bytes(b'not the official distribution')
    output.write_bytes(b'existing verified artifact')
    try: probe.build(halo, output, javac='/compiler-that-must-not-be-executed')
    except RuntimeError as error: assert 'SHA-256 mismatch' in str(error)
    else: raise AssertionError('unverified executable input accepted')
    assert output.read_bytes() == b'existing verified artifact'
`));

test('插件操作拒绝认领非实验目录、错误端口和未完成播种的环境', () => python(`
with tempfile.TemporaryDirectory() as temporary:
    runtime = Path(temporary)
    marker = {'schema': 1, 'ports': {'halo': 18092, 'hexo': 14001}, 'owner': 'halo-butterfly-next-comparison'}
    for content, seeded in [(None, False), ({**marker, 'owner': 'other'}, True), ({**marker, 'ports': {'halo': 18090, 'hexo': 14000}}, True), (marker, False)]:
        if content is not None: (runtime / 'lab.json').write_text(json.dumps(content))
        if seeded: (runtime / 'seed.json').write_text('{}')
        elif (runtime / 'seed.json').exists(): (runtime / 'seed.json').unlink()
        try: probe.ensure_lab_identity(runtime, 18092, 14001)
        except RuntimeError: pass
        else: raise AssertionError('unowned/incomplete lab accepted')
    (runtime / 'lab.json').write_text(json.dumps(marker))
    (runtime / 'seed.json').write_text('{}')
    probe.ensure_lab_identity(runtime, 18092, 14001)
`));

test('HTTP 200 的错误页面、主题自有模板、重复 head 或正文不能冒充夹具通过', () => python(`
head, no_head = probe.FIXTURE['routes']
header = f'plugin:{probe.PLUGIN}:{head["template"]}'
markup = f'<html><head><title>{head["title"]}</title><meta name="layout-probe" content="provided-head"></head><body><section id="{head["marker"]}">fixture</section></body></html>'
assert probe.validate_page(markup, header, head, 'Site')['headMetaCount'] == 1
for changed, source in [('<html>Error</html>', header), (markup, head['template']), (markup.replace('</head>', '<title>Duplicate</title></head>'), header), (markup + f'<section id="{head["marker"]}">duplicate</section>', header), (markup.replace('provided-head', 'wrong'), header)]:
    try: probe.validate_page(changed, source, head, 'Site')
    except RuntimeError: pass
    else: raise AssertionError('invalid rendering accepted')
empty_head_markup = f'<title>Site</title><section id="{no_head["marker"]}">fixture</section>'
assert probe.validate_page(empty_head_markup, f'plugin:{probe.PLUGIN}:{no_head["template"]}', no_head, 'Site')['headMetaCount'] == 0
`));
