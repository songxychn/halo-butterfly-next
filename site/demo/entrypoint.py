#!/usr/bin/env python3
"""Container entrypoint for the self-contained H2 Halo demo image."""
import fcntl
import hashlib
import json
import os
import shlex
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

SOURCE = Path('/opt/demo/source')
sys.path[:0] = [str(SOURCE / 'site/tools'), str(SOURCE / 'site/demo')]
from importer import import_public
from runtime import read_json, write_json

DATA = Path('/root/.halo2')
BUNDLE = Path('/opt/demo/bundle')
LOCAL = urllib.request.build_opener(urllib.request.ProxyHandler({}))


class Runtime:
    root = DATA / 'demo-operations'
    base = 'http://127.0.0.1:8090'

    def __init__(self, process, external_url):
        self.process = process
        self.external_url = external_url

    def check(self):
        if self.process.poll() is not None:
            raise RuntimeError('Owned Halo process exited')
        return self.process.pid

    owned_pid = check


def check_pages(public_url):
    parsed = urlparse(public_url)
    headers = {'Host': parsed.netloc, 'X-Forwarded-Proto': parsed.scheme}
    mapping = read_json(BUNDLE / 'permalinks.json')
    for path in ['/', '/page/2', '/docs', *mapping.values()]:
        with LOCAL.open(urllib.request.Request('http://127.0.0.1:8090' + path, headers=headers), timeout=20) as response:
            body = response.read()
        if parsed.hostname not in ('127.0.0.1', 'localhost') and (b'127.0.0.1:8090' in body or b'localhost:8090' in body):
            raise RuntimeError('Loopback URL leaked into public page: ' + path)
    for asset in read_json(BUNDLE / 'sources.json')['assets']:
        path = f"/site-assets/{asset['id']}-{asset['sha256'][:16]}.webp"
        with LOCAL.open(urllib.request.Request('http://127.0.0.1:8090' + path, headers=headers), timeout=20) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != asset['sha256']:
            raise RuntimeError('Public asset checksum mismatch: ' + path)


def health():
    if not (DATA / 'demo-operations/ready.json').exists():
        return 1
    with LOCAL.open('http://127.0.0.1:8090/actuator/health/readiness', timeout=5) as r:
        return 0 if json.load(r).get('status') == 'UP' else 1


def main():
    os.umask(0o077)
    DATA.mkdir(parents=True, exist_ok=True)
    release = read_json(BUNDLE / 'release.json')
    operations = DATA / 'demo-operations'
    operations.mkdir(exist_ok=True)
    lock = (operations / 'instance.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    ready = operations / 'ready.json'
    ready.unlink(missing_ok=True)
    if not (operations / 'import-started.json').exists():
        (DATA / 'plugins').mkdir(exist_ok=True)
        shutil.copyfile('/opt/demo/search.jar', DATA / 'plugins/PluginSearchWidget-1.8.0.jar')
    public_url = os.environ.get('HALO_EXTERNAL_URL', 'http://127.0.0.1:8090').rstrip('/')
    parsed = urlparse(public_url)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc:
        raise RuntimeError('Invalid HALO_EXTERNAL_URL: ' + public_url)
    if any(k.startswith('SPRING_R2DBC_') for k in os.environ):
        raise RuntimeError('Demo requires its embedded H2 database')
    cmd = [
        'java', *shlex.split(os.environ.get('JVM_OPTS', '-Xmx512m')),
        '-XX:SharedArchiveFile=application.jsa', '-jar', 'application.jar',
        '--halo.work-dir=' + str(DATA),
        '--halo.external-url=' + public_url,
        '--spring.sql.init.platform=h2',
        f'--spring.r2dbc.url=r2dbc:h2:file:///{DATA}/db/halo-next?MODE=MySQL&DB_CLOSE_ON_EXIT=FALSE',
        '--halo.attachment.resource-mappings[0].path-pattern=/site-assets/**',
        '--halo.attachment.resource-mappings[0].locations[0]=site-assets',
        '--springdoc.api-docs.enabled=false',
    ]
    process = subprocess.Popen(cmd)

    def stop(signum=None, frame=None):
        if process.poll() is None:
            process.terminate()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        runtime = Runtime(process, public_url)
        for _ in range(180):
            runtime.check()
            try:
                with LOCAL.open(runtime.base + '/actuator/health/readiness', timeout=2) as r:
                    if json.load(r).get('status') == 'UP':
                        break
            except Exception:
                pass
            time.sleep(1)
        else:
            raise RuntimeError('Halo startup timeout')
        if not (operations / 'import-complete.json').exists():
            import_public(runtime, BUNDLE, DATA, public_url)
        check_pages(public_url)
        receipt = {**release, 'contentCount': len(read_json(BUNDLE / 'permalinks.json')), 'database': 'h2', 'ready': True}
        write_json(DATA / 'attachments/site-assets/demo-version.json', receipt)
        write_json(ready, receipt)
        return process.wait()
    finally:
        ready.unlink(missing_ok=True)
        stop()
        try:
            process.wait(timeout=45)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


if __name__ == '__main__':
    if sys.argv[1:] == ['health']:
        try:
            sys.exit(health())
        except Exception:
            sys.exit(1)
    sys.exit(main())
