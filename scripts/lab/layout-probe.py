#!/usr/bin/env python3
"""Build and exercise a deterministic, local-only Halo 2.26.1 page-layout test plugin."""
import argparse
import hashlib
from html.parser import HTMLParser
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

REPO = Path(__file__).resolve().parents[2]
FIXTURES = REPO / 'fixtures/layout-probe'
FIXTURE = json.loads((FIXTURES / 'fixture.json').read_text())
PLUGIN = FIXTURE['name']
RESOURCE_API = '/apis/plugin.halo.run/v1alpha1/plugins'
CONSOLE_API = '/apis/api.console.halo.run/v1alpha1/plugins'
OWNER = 'halo-butterfly-next-layout-probe'


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def provenance():
    def git(*args):
        return subprocess.run(['git', '-C', str(REPO), *args], check=True,
                              capture_output=True, text=True).stdout.strip()
    return {'sourceCommit': git('rev-parse', 'HEAD'),
            'workingTreeClean': not bool(git('status', '--porcelain'))}


def fixture_digest():
    h = hashlib.sha256()
    for path in sorted(FIXTURES.rglob('*')):
        if path.is_file():
            h.update(str(path.relative_to(FIXTURES)).encode())
            h.update(path.read_bytes())
    return h.hexdigest()


def write_jar(destination, entries):
    """Stable entry order, timestamps, compression and permissions; no compiler dependencies."""
    for name in entries:
        if name.startswith('/') or '..' in name.split('/') or '\\' in name:
            raise RuntimeError('Unsafe JAR entry path')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for name in sorted(entries):
            info = ZipInfo(name, date_time=(2026, 9, 6, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = ZIP_DEFLATED
            archive.writestr(info, entries[name], compress_type=ZIP_DEFLATED, compresslevel=9)


def build(halo_jar, output, javac='javac'):
    halo_jar, output = Path(halo_jar).resolve(), Path(output).resolve()
    if digest(halo_jar) != FIXTURE['halo']['sha256']:
        raise RuntimeError('Halo JAR SHA-256 mismatch; refusing extraction and compiler execution')
    if output == halo_jar or output.is_relative_to(FIXTURES):
        raise RuntimeError('Build output must not overwrite source inputs')
    compiler = subprocess.run([javac, '-version'], check=True, capture_output=True, text=True)
    compiler_version = (compiler.stdout + compiler.stderr).strip()
    with tempfile.TemporaryDirectory(prefix='layout-probe-build-') as temporary:
        temp = Path(temporary)
        libraries, classes = temp / 'libraries', temp / 'classes'
        libraries.mkdir(); classes.mkdir()
        library_hashes = {}
        with ZipFile(halo_jar) as archive:
            for name in FIXTURE['compileLibraries']:
                data = archive.read('BOOT-INF/lib/' + name)
                (libraries / name).write_bytes(data)
                library_hashes[name] = hashlib.sha256(data).hexdigest()
        java_files = sorted((FIXTURES / 'src').rglob('*.java'))
        if not java_files:
            raise RuntimeError('Missing Java fixture sources')
        command = [javac, '--release', '21', '-parameters', '-g:none', '-proc:none',
                   '-encoding', 'UTF-8', '-classpath', str(libraries / '*'),
                   '-d', str(classes), *map(str, java_files)]
        subprocess.run(command, check=True)
        entries = {str(path.relative_to(classes)).replace(os.sep, '/'): path.read_bytes()
                   for path in classes.rglob('*.class')}
        for source, target in FIXTURE['resources'].items():
            data = (FIXTURES / 'resources' / source).read_bytes()
            # JAR manifest sections end with a blank line, generated rather than source whitespace.
            entries[target] = data.rstrip(b'\r\n') + b'\r\n\r\n' if target == 'META-INF/MANIFEST.MF' else data
        entries['META-INF/layout-probe.json'] = json.dumps(
            {'owner': OWNER, 'plugin': PLUGIN, 'version': FIXTURE['version'],
             'haloSha256': FIXTURE['halo']['sha256'], 'fixtureSha256': fixture_digest()},
            sort_keys=True, separators=(',', ':')).encode()
        # Publish only after compilation succeeds; preserve an existing artifact on failure.
        staged = temp / 'probe.jar'
        write_jar(staged, entries)
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=output.parent, prefix='.probe-', delete=False) as target:
            target.write(staged.read_bytes())
            target_path = Path(target.name)
        target_path.replace(output)
    report = {'schema': 1, **provenance(), 'plugin': PLUGIN, 'version': FIXTURE['version'],
              'artifact': output.name, 'artifactSha256': digest(output), 'bytes': output.stat().st_size,
              'fixtureSha256': fixture_digest(), 'halo': FIXTURE['halo'],
              'compiler': compiler_version, 'release': 21, 'compileLibraries': library_hashes,
              'entries': sorted(entries), 'limitations': ['Reproducible with the same compiler and fixture inputs; no runtime validation implied.']}
    write_json(output.with_suffix('.build.json'), report)
    print(json.dumps({'artifact': str(output), 'sha256': report['artifactSha256'],
                      'compiler': compiler_version, 'entries': len(entries)}))
    return report


def ensure_lab_identity(runtime, halo_port, hexo_port):
    marker = runtime / 'lab.json'
    expected = {'schema': 1, 'ports': {'halo': halo_port, 'hexo': hexo_port},
                'owner': 'halo-butterfly-next-comparison'}
    if not marker.is_file() or json.loads(marker.read_text()) != expected:
        raise RuntimeError('Expected an existing comparison lab with matching runtime/ports; run lab.py bootstrap first')
    if not (runtime / 'seed.json').is_file():
        raise RuntimeError('Comparison lab bootstrap is incomplete')


def load_lab(runtime, halo_port, hexo_port):
    ensure_lab_identity(runtime, halo_port, hexo_port)
    source = REPO / 'scripts/lab/lab.py'
    if not source.is_file():
        raise RuntimeError('Comparison lab support is not integrated yet; merge its reviewed commit first')
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(halo_port), HEXO_PORT=str(hexo_port))
    spec = importlib.util.spec_from_file_location('layout_probe_comparison_lab', source)
    lab = importlib.util.module_from_spec(spec); spec.loader.exec_module(lab)
    if not lab.owned_process('halo'):
        raise RuntimeError('Refusing plugin mutations without this lab-owned Halo process')
    return lab


class ProbePage(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids = []; self.titles = []; self.in_title = False; self.metas = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'): self.ids.append(attrs['id'])
        if tag == 'title': self.in_title = True; self.titles.append('')
        if tag == 'meta' and attrs.get('name') == 'layout-probe': self.metas.append(attrs.get('content'))
    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False
    def handle_data(self, data):
        if self.in_title: self.titles[-1] += data


def validate_page(markup, template_header, route, site_title):
    page = ProbePage(); page.feed(markup)
    if template_header != f'plugin:{PLUGIN}:{route["template"]}':
        raise RuntimeError('Response did not identify the expected plugin-owned template')
    if page.ids.count(route['marker']) != 1:
        raise RuntimeError('Probe content must occur exactly once')
    expected_title = route.get('title', site_title)
    if page.titles != [expected_title]:
        raise RuntimeError(f'Expected one title: {expected_title}')
    if page.metas != (['provided-head'] if route['hasHead'] else []):
        raise RuntimeError('Head fragment missing or duplicated')
    return {'title': page.titles[0], 'marker': route['marker'], 'headMetaCount': len(page.metas)}


def routes(lab, active):
    results = []
    for route in FIXTURE['routes']:
        url = lab.BASE['halo'] + route['path']
        try:
            with lab.LOCAL.open(url, timeout=30) as response:
                content_type = response.headers.get('Content-Type', '').split(';', 1)[0]
                if not active or response.status != 200 or response.url != url or content_type != 'text/html':
                    raise RuntimeError('Unexpected probe route status, redirect or content type')
                markup = response.read().decode()
                checks = validate_page(markup, response.headers.get('X-Layout-Probe-Template'),
                                       route, lab.CONTENT['site']['title'])
                results.append({'path': route['path'], 'status': 200, **checks,
                                'htmlSha256': hashlib.sha256(markup.encode()).hexdigest()})
        except urllib.error.HTTPError as error:
            if active or error.code != 404:
                raise RuntimeError(f'Probe route {route["path"]}: HTTP {error.code}') from None
            results.append({'path': route['path'], 'status': 404})
    return results


def plugin_state(lab, client):
    try:
        return client.api(RESOURCE_API + '/' + PLUGIN)
    except lab.ApiError as error:
        if error.status != 404: raise
        return None


def owned_artifact(lab, artifact):
    found = []
    for path in (lab.RUNTIME / 'halo/data/plugins').glob('*.jar'):
        with ZipFile(path) as archive:
            if 'META-INF/layout-probe.json' not in archive.namelist(): continue
            identity = json.loads(archive.read('META-INF/layout-probe.json'))
            if identity.get('owner') == OWNER and identity.get('plugin') == PLUGIN:
                found.append(path)
    if len(found) != 1 or digest(found[0]) != digest(artifact):
        raise RuntimeError('Installed probe JAR does not match the owned artifact')
    return {'file': found[0].name, 'sha256': digest(found[0])}


def install_probe(lab, client, artifact, owner_path):
    if plugin_state(lab, client):
        raise RuntimeError('Probe already exists; refusing to replace an existing plugin')
    with ZipFile(artifact) as archive:
        identity = json.loads(archive.read('META-INF/layout-probe.json'))
    if identity.get('owner') != OWNER or identity.get('plugin') != PLUGIN or identity.get('fixtureSha256') != fixture_digest():
        raise RuntimeError('Artifact is not built from the current probe fixture')
    boundary = 'probe-' + secrets.token_hex(12)
    data = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{PLUGIN}-{FIXTURE["version"]}.jar"\r\nContent-Type: application/java-archive\r\n\r\n'.encode()
            + artifact.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
    result = client.api(CONSOLE_API + '/install', 'POST', data, 'multipart/form-data; boundary=' + boundary)
    if result['metadata']['name'] != PLUGIN: raise RuntimeError('Unexpected installed plugin identity')
    write_json(owner_path, {'owner': OWNER, 'plugin': PLUGIN, 'artifactSha256': digest(artifact)})
    return owned_artifact(lab, artifact)


def set_enabled(client, enabled):
    return client.api(CONSOLE_API + '/' + PLUGIN + '/plugin-state', 'PUT', {'enable': enabled, 'async': False})


def exercise(lab, artifact, expected_layout):
    artifact = Path(artifact).resolve()
    build_report_path = artifact.with_suffix('.build.json')
    build_report = json.loads(build_report_path.read_text())
    if build_report['artifactSha256'] != digest(artifact) or build_report['fixtureSha256'] != fixture_digest():
        raise RuntimeError('Artifact build report mismatch; rebuild before runtime validation')
    client = lab.Client()
    theme = client.api('/apis/theme.halo.run/v1alpha1/themes/' + lab.THEME)
    layout = theme.get('status', {}).get('pageLayout', {})
    actual_state = layout.get('state')
    if (expected_layout == 'supported' and actual_state != 'SUPPORTED') or (expected_layout == 'fallback' and actual_state not in ['MISSING', 'INVALID']):
        raise RuntimeError(f'Unexpected theme layout state: {actual_state}')
    owner_path = lab.RUNTIME / 'layout-probe-owner.json'
    report = {'schema': 1, 'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              **provenance(), 'artifactBuild': build_report, 'themePackage': json.loads((lab.RUNTIME / 'installed-package.json').read_text()),
              'layoutExpectation': expected_layout, 'themePageLayout': layout,
              'baseUrl': lab.BASE['halo'], 'stages': [],
              'limitations': ['Lifecycle and template-slot checks only; no browser, visual, accessibility or full PLG-05 approval.']}
    def record(stage, checks):
        report['stages'].append({'stage': stage, 'routes': checks})
        write_json(lab.RUNTIME / 'layout-probe-evidence.json', report)
        print('Probe stage:', stage, flush=True)
    existing = plugin_state(lab, client)
    if existing:
        if not owner_path.is_file() or json.loads(owner_path.read_text()) != {'owner': OWNER, 'plugin': PLUGIN, 'artifactSha256': digest(artifact)}:
            raise RuntimeError('Existing probe is not owned by this fixture run')
        owned_artifact(lab, artifact)
        set_enabled(client, False)
        record('existing-disabled', routes(lab, False))
    else:
        record('missing', routes(lab, False))
        report['installedArtifact'] = install_probe(lab, client, artifact, owner_path)
    set_enabled(client, True)
    record('enabled', routes(lab, True))
    set_enabled(client, False)
    record('disabled', routes(lab, False))
    set_enabled(client, True)
    record('reenabled', routes(lab, True))
    owned_artifact(lab, artifact)
    client.api(RESOURCE_API + '/' + PLUGIN, 'DELETE')
    deadline = time.monotonic() + 45
    while plugin_state(lab, client) is not None:
        if time.monotonic() >= deadline: raise RuntimeError('Timed out waiting for probe uninstall')
        time.sleep(1)
    record('uninstalled', routes(lab, False))
    report['installedArtifact'] = install_probe(lab, client, artifact, owner_path)
    set_enabled(client, True)
    record('reinstalled-enabled', routes(lab, True))
    report['result'] = 'passed'
    report['retained'] = 'Owned lab and enabled probe retained for subsequent theme acceptance'
    write_json(lab.RUNTIME / 'layout-probe-evidence.json', report)
    print('Probe evidence:', lab.RUNTIME / 'layout-probe-evidence.json')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['build', 'exercise'])
    parser.add_argument('--halo-jar', type=Path)
    parser.add_argument('--artifact', type=Path, default=REPO / '.runtime/layout-probe-build' / f'{PLUGIN}-{FIXTURE["version"]}.jar')
    parser.add_argument('--javac', default='javac')
    parser.add_argument('--runtime', type=Path, default=REPO / '.runtime/probe-lab')
    parser.add_argument('--halo-port', type=int, default=18092)
    parser.add_argument('--hexo-port', type=int, default=14001)
    parser.add_argument('--expect-layout', choices=['fallback', 'supported'], default='fallback')
    args = parser.parse_args()
    if args.command == 'build':
        if not args.halo_jar: parser.error('--halo-jar is required; only the pinned official JAR is accepted')
        build(args.halo_jar, args.artifact, args.javac)
    else:
        lab = load_lab(args.runtime.resolve(), args.halo_port, args.hexo_port)
        exercise(lab, args.artifact, args.expect_layout)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError, subprocess.CalledProcessError) as error:
        print('Layout probe error:', error, file=sys.stderr)
        sys.exit(1)
