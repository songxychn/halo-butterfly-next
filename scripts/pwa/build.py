"""Build the optional production plugin with verified Halo libraries; no Maven downloads."""
import hashlib
import json
import pathlib
import struct
import subprocess
import sys
import tempfile
import zlib
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'plugins/pwa'
PIN = json.loads((ROOT / 'fixtures/layout-probe/fixture.json').read_text())


def digest(data):
    return hashlib.sha256(data).hexdigest()


def icon(size):
    # Original geometric butterfly icon, generated deterministically without external fonts/art.
    def chunk(name, data):
        return struct.pack('!I', len(data)) + name + data + struct.pack('!I', zlib.crc32(name + data))
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            dx, dy = abs(x / size - .5), y / size - .5
            wing = ((dx - .16) ** 2 / .13 ** 2 + (dy + .10) ** 2 / .20 ** 2 < 1 or
                    (dx - .13) ** 2 / .10 ** 2 + (dy - .16) ** 2 / .13 ** 2 < 1)
            row.extend((255, 255, 255) if wing else (24, 93, 133))
        rows.append(row)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b'')


def build(jar):
    if digest(jar.read_bytes()) != PIN['halo']['sha256']:
        raise RuntimeError('Halo JAR SHA-256 mismatch; refusing compiler execution')
    compiler = subprocess.check_output(['javac', '-version'], text=True).strip()
    libraries = PIN['compileLibraries'] + ['thymeleaf-3.1.3.RELEASE.jar']
    with tempfile.TemporaryDirectory(prefix='butterfly-pwa-') as temporary:
        temp = pathlib.Path(temporary)
        libs, classes = temp / 'libs', temp / 'classes'
        libs.mkdir(); classes.mkdir()
        hashes = {}
        with ZipFile(jar) as archive:
            for name in libraries:
                data = archive.read('BOOT-INF/lib/' + name)
                (libs / name).write_bytes(data)
                hashes[name] = digest(data)
        subprocess.run(['javac', '--release', '21', '-parameters', '-g:none', '-proc:none',
                        '-encoding', 'UTF-8', '-classpath', str(libs / '*'), '-d', str(classes),
                        *map(str, sorted((SOURCE / 'src/main/java').rglob('*.java')))], check=True)
        entries = {p.relative_to(classes).as_posix(): p.read_bytes() for p in classes.rglob('*.class')}
        for p in (SOURCE / 'resources').rglob('*'):
            if not p.is_file(): continue
            name = p.relative_to(SOURCE / 'resources').as_posix()
            name = {'components.idx': 'META-INF/plugin-components.idx', 'MANIFEST.MF': 'META-INF/MANIFEST.MF',
                    'offline.html': 'pwa/offline.html'}.get(name, name)
            entries[name] = p.read_bytes()
        entries['META-INF/MANIFEST.MF'] = entries['META-INF/MANIFEST.MF'].rstrip() + b'\r\n\r\n'
        entries['pwa/sw.js'] = (ROOT / '.runtime/pwa-build/generated/sw.js').read_bytes()
        entries['LICENSE'] = (ROOT / 'LICENSE').read_bytes()
        for size in (192, 512): entries[f'pwa/icon-{size}.png'] = icon(size)
        source_hash = hashlib.sha256()
        for p in sorted(SOURCE.rglob('*')):
            if p.is_file(): source_hash.update(p.relative_to(SOURCE).as_posix().encode() + b'\0' + p.read_bytes())
        identity = {'name': 'butterfly-pwa', 'version': '0.1.0', 'sourceSha256': source_hash.hexdigest()}
        entries['META-INF/butterfly-pwa.json'] = json.dumps(identity, sort_keys=True).encode()
        # Spring's classpath extension discovery needs explicit directory entries in the JAR.
        for name in list(entries):
            for parent in pathlib.PurePosixPath(name).parents:
                if str(parent) != '.': entries.setdefault(parent.as_posix() + '/', b'')
        artifact = ROOT / 'dist/butterfly-pwa-0.1.0.jar'
        artifact.parent.mkdir(exist_ok=True)
        staged = temp / 'plugin.jar'
        with ZipFile(staged, 'w') as archive:
            for name, data in sorted(entries.items()):
                info = ZipInfo(name, (1980, 1, 1, 0, 0, 0)); info.create_system = 3
                info.external_attr = ((0o40755 if name.endswith('/') else 0o100644) << 16)
                archive.writestr(info, data, compress_type=ZIP_DEFLATED, compresslevel=9)
        artifact.write_bytes(staged.read_bytes())
        report = {**identity, 'artifactSha256': digest(artifact.read_bytes()), 'halo': PIN['halo'],
                  'compiler': compiler, 'libraries': hashes,
                  'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                  'workingTreeClean': not bool(subprocess.check_output(['git', 'status', '--porcelain', '--', 'plugins/pwa', 'scripts/pwa', 'package.json', 'bun.lock'], cwd=ROOT)),
                  'entries': sorted(entries)}
        artifact.with_suffix('.build.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps({'artifact': str(artifact), 'sha256': report['artifactSha256']}))


if __name__ == '__main__':
    build(pathlib.Path(sys.argv[1]).resolve())
