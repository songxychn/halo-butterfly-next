"""Owned loopback Halo runtime. No remote-server or shared-database support."""
import base64
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

REPO = Path(__file__).resolve().parents[2]
OWNER = 'halo-butterfly-next-docs-site'
VERSION = json.loads((REPO / 'fixtures/comparison/versions.json').read_text())['halo']
THEME = 'halo-butterfly-next'
LOCAL = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def sha(value):
    return hashlib.sha256(value).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
        temporary = Path(stream.name)
    temporary.chmod(0o600)
    temporary.replace(path)


def read_json(path):
    return json.loads(path.read_text())


class ApiError(RuntimeError):
    def __init__(self, method, path, status):
        self.status = status
        super().__init__(f'{method} {path}: HTTP {status}')


class Inputs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.csrf = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'input' and attrs.get('name') == '_csrf':
            self.csrf = attrs.get('value')


class Runtime:
    def __init__(self, directory, port=18141):
        self.root = Path(directory).absolute()
        if self.root.resolve() != self.root or not self.root.is_relative_to(REPO / '.runtime'):
            raise RuntimeError('Runtime must be a nonsymlink directory beneath this checkout .runtime')
        if not 1024 <= port <= 65535:
            raise RuntimeError('Port must be between 1024 and 65535')
        self.port = port
        self.base = f'http://127.0.0.1:{port}'
        self.marker = {'owner': OWNER, 'schemaVersion': 1, 'runtime': str(self.root), 'port': port}
        self.jar = self.root / 'halo/halo-2.26.1.jar'

    def check(self):
        if read_json(self.root / 'owner.json') != self.marker:
            raise RuntimeError('Runtime ownership mismatch')
        for relative in ['halo', 'halo/data', 'halo/data/attachments', 'halo/data/attachments/site-assets']:
            candidate = self.root / relative
            if candidate.resolve() != candidate:
                raise RuntimeError(f'Runtime path is a symlink: {relative}')

    def prepare(self, jar_source):
        if self.root.exists() and any(self.root.iterdir()):
            self.check()
        else:
            self.root.mkdir(parents=True, exist_ok=True)
            write_json(self.root / 'owner.json', self.marker)
        (self.root / 'halo/data/attachments/site-assets').mkdir(parents=True, exist_ok=True)
        if not self.jar.exists():
            source = Path(jar_source).resolve()
            if sha(source.read_bytes()) != VERSION['sha256']:
                raise RuntimeError('Pinned Halo JAR checksum mismatch')
            shutil.copyfile(source, self.jar)
        if sha(self.jar.read_bytes()) != VERSION['sha256']:
            raise RuntimeError('Pinned Halo JAR checksum mismatch')

    def owned_pid(self):
        self.check()
        file = self.root / 'process.json'
        if not file.exists():
            return None
        state = read_json(file)
        result = subprocess.run(['ps', '-p', str(state['pid']), '-o', 'command='], capture_output=True, text=True)
        expected = [str(self.jar), '--server.address=127.0.0.1', f'--server.port={self.port}', str(self.root / 'halo/data')]
        return state['pid'] if result.returncode == 0 and all(token in result.stdout for token in expected) else None

    def listening(self):
        with socket.socket() as sock:
            return sock.connect_ex(('127.0.0.1', self.port)) == 0

    def start(self):
        self.check()
        if sha(self.jar.read_bytes()) != VERSION['sha256']:
            raise RuntimeError('Pinned Halo JAR checksum mismatch')
        if self.listening() and not self.owned_pid():
            raise RuntimeError('Port occupied by a process not owned by this site')
        if not self.owned_pid():
            command = ['java', '-Xms128m', '-Xmx512m', '-Duser.timezone=Asia/Shanghai', '-jar', str(self.jar),
                       '--server.address=127.0.0.1', f'--server.port={self.port}',
                       '--halo.work-dir=' + str(self.root / 'halo/data'), '--halo.external-url=' + self.base,
                       '--springdoc.api-docs.enabled=true', '--spring.thymeleaf.cache=false',
                       '--halo.attachment.resource-mappings[0].path-pattern=/site-assets/**',
                       '--halo.attachment.resource-mappings[0].locations[0]=site-assets',
                       '--logging.level.org.thymeleaf.TemplateEngine=ERROR']
            with (self.root / 'halo.log').open('ab') as log:
                proc = subprocess.Popen(command, cwd=self.root, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            write_json(self.root / 'process.json', {'pid': proc.pid, 'command': command})
        for _ in range(90):
            try:
                LOCAL.open(self.base + '/actuator/health/readiness', timeout=2).read()
                return
            except (OSError, urllib.error.URLError):
                time.sleep(1)
        raise RuntimeError('Halo startup timed out; runtime and logs retained')

    def stop(self):
        pid = self.owned_pid()
        if pid:
            os.kill(pid, signal.SIGTERM)
        elif self.listening():
            raise RuntimeError('Refusing to stop unowned listener')


class Client:
    def __init__(self, runtime, initialize=False):
        runtime.check()
        if not runtime.owned_pid():
            raise RuntimeError('API access requires the owned local Halo process')
        self.runtime = runtime
        self.cookies = http.cookiejar.LWPCookieJar(str(runtime.root / 'session.cookies'))
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(self.cookies))
        credentials = runtime.root / 'credentials.json'
        if not credentials.exists():
            if not initialize:
                raise RuntimeError('Run init before content operations')
            write_json(credentials, {'username': 'site-maintainer', 'password': secrets.token_hex(24)})
        if credentials.stat().st_mode & 0o077:
            raise RuntimeError('Credential permissions must be 0600')
        self.auth = read_json(credentials)
        self.initialized_now = False
        session = runtime.root / 'session.json'
        if not initialize and session.exists() and Path(self.cookies.filename).exists():
            if session.stat().st_mode & 0o077 or Path(self.cookies.filename).stat().st_mode & 0o077:
                raise RuntimeError('Session permissions must be 0600')
            self.cookies.load(ignore_discard=True, ignore_expires=False)
            self.csrf = read_json(session)['csrf']
            try:
                self.api('/apis/content.halo.run/v1alpha1/posts?size=1')
                return
            except (ApiError, RuntimeError):
                self.cookies.clear()
        if initialize:
            response = self.opener.open(runtime.base + '/system/setup', timeout=30)
            parser = Inputs()
            parser.feed(response.read().decode())
            if urllib.parse.urlparse(response.url).path == '/system/setup' and parser.csrf:
                payload = {**self.auth, '_csrf': parser.csrf, 'email': 'site@example.invalid',
                           'siteTitle': 'Halo Butterfly Next', 'language': 'zh-CN', 'externalUrl': runtime.base}
                self.opener.open(urllib.request.Request(runtime.base + '/system/setup', data=urllib.parse.urlencode(payload).encode()), timeout=60).read()
                self.initialized_now = True
        page = self.opener.open(runtime.base + '/login', timeout=30).read().decode()
        parser = Inputs()
        parser.feed(page)
        self.csrf = parser.csrf
        match = re.search(r'const publicKey = (".*?");', page)
        if not match or not self.csrf:
            raise RuntimeError('Expected pinned Halo login form')
        with tempfile.NamedTemporaryFile(mode='w', dir=runtime.root, suffix='.pem') as key:
            key.write('-----BEGIN PUBLIC KEY-----\n' + json.loads(match.group(1)) + '\n-----END PUBLIC KEY-----\n')
            key.flush()
            encrypted = subprocess.run(['openssl', 'pkeyutl', '-encrypt', '-pubin', '-inkey', key.name,
                                        '-pkeyopt', 'rsa_padding_mode:pkcs1'], input=self.auth['password'].encode(), capture_output=True, check=True).stdout
        payload = {'username': self.auth['username'], 'password': base64.b64encode(encrypted).decode(), '_csrf': self.csrf}
        response = self.opener.open(urllib.request.Request(runtime.base + '/login', data=urllib.parse.urlencode(payload).encode()), timeout=30)
        if '/login' in response.url:
            raise RuntimeError('Local Halo login failed')
        self.cookies.save(ignore_discard=True, ignore_expires=False)
        Path(self.cookies.filename).chmod(0o600)
        write_json(session, {'csrf': self.csrf})

    def api(self, path, method='GET', data=None, content_type='application/json'):
        if not path.startswith('/') or path.startswith('//'):
            raise RuntimeError('API path must be local')
        headers = {'Accept': 'application/json', 'X-CSRF-TOKEN': self.csrf}
        if data is not None:
            headers['Content-Type'] = content_type
            if not isinstance(data, bytes):
                data = json.dumps(data).encode()
        try:
            response = self.opener.open(urllib.request.Request(self.runtime.base + path, data=data, headers=headers, method=method), timeout=45)
            value = response.read()
            if 'text/html' in response.headers.get('Content-Type', ''):
                raise RuntimeError('Unexpected HTML API response')
            return json.loads(value) if value else None
        except urllib.error.HTTPError as error:
            raise ApiError(method, path, error.code) from None

    def maybe(self, path):
        try:
            return self.api(path)
        except ApiError as error:
            if error.status != 404:
                raise
            return None

    def install(self, package):
        package = Path(package).resolve()
        digest = sha(package.read_bytes())
        record = self.runtime.root / 'installed-theme.json'
        if record.exists():
            if read_json(record)['sha256'] == digest:
                return
            raise RuntimeError('A different theme package is installed; explicit upgrade workflow required')
        if self.maybe('/apis/theme.halo.run/v1alpha1/themes/' + THEME):
            raise RuntimeError('Refusing to adopt an already installed theme')
        boundary = 'site-' + secrets.token_hex(12)
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="theme.zip"\r\nContent-Type: application/zip\r\n\r\n'.encode()
                + package.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
        result = self.api('/apis/api.console.halo.run/v1alpha1/themes/install', 'POST', body, 'multipart/form-data; boundary=' + boundary)
        if result['metadata']['name'] != THEME:
            raise RuntimeError('Unexpected theme package identity')
        self.api('/apis/api.console.halo.run/v1alpha1/themes/' + THEME + '/activation', 'PUT')
        write_json(record, {'package': package.name, 'sha256': digest, 'version': result['spec']['version']})
