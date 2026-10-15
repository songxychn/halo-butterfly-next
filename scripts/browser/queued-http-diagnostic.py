#!/usr/bin/env python3
"""Bounded #338 queued/serial HTTP probe on an explicitly owned loopback lab.

Does not patch Halo, retry failures or certify browser failure attribution.
Creates one fixed synthetic attachment only with explicit permission.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import time
from urllib.parse import urlsplit
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
PROBE = b'<!doctype html><meta charset="utf-8"><title>338 isolated fetch probe</title><p>Isolated synthetic resource probe. No theme or plugin scripts.</p>'
PATHS = ['/lab/probe338.html', '/themes/halo-butterfly-next/assets/plugins/prism/themes/prism-one-dark.css', '/lab/cover.svg']
sha = lambda value: hashlib.sha256(value).hexdigest()


class Reader:
    """Preserve over-read bytes between correctly framed HTTP/1.1 responses."""
    def __init__(self, stream):
        self.stream, self.buffer = stream, b''

    def more(self):
        data = self.stream.recv(65536)
        if not data:
            raise EOFError('Peer closed before complete response')
        self.buffer += data

    def until(self, marker):
        while marker not in self.buffer:
            self.more()
        value, self.buffer = self.buffer.split(marker, 1)
        return value

    def take(self, count):
        while len(self.buffer) < count:
            self.more()
        value, self.buffer = self.buffer[:count], self.buffer[count:]
        return value

    def response(self):
        lines = self.until(b'\r\n\r\n').decode('iso-8859-1').split('\r\n')
        headers = {}
        for line in lines[1:]:
            key, value = line.split(':', 1)
            key = key.lower()
            if key in headers:
                raise ValueError('Duplicate response header: ' + key)
            headers[key] = value.strip()
        if headers.get('connection', '').lower() == 'close':
            raise ValueError('Unexpected connection-close response')
        transfer = headers.get('transfer-encoding', '').lower()
        if transfer:
            if transfer != 'chunked' or 'content-length' in headers:
                raise ValueError('Unsupported or ambiguous transfer framing')
            body = b''
            while True:
                count = int(self.until(b'\r\n').split(b';')[0], 16)
                if count == 0:
                    while self.until(b'\r\n'):
                        pass  # Consume optional trailers, preserving next response.
                    break
                if count < 0:
                    raise ValueError('Invalid chunk size')
                body += self.take(count)
                if self.take(2) != b'\r\n':
                    raise ValueError('Malformed chunk terminator')
        else:
            length = headers.get('content-length', '')
            if not re.fullmatch(r'\d+', length):
                raise ValueError('Missing valid Content-Length')
            body = self.take(int(length))
        return {'statusLine': lines[0], 'headers': headers, 'bytes': len(body), 'sha256': sha(body), 'bufferedAfterBytes': len(self.buffer), 'receivedAt': time.time()}


def owned_lab(args):
    lab = Path(args.lab_runtime).absolute()
    if lab.resolve() != lab or not lab.is_relative_to(ROOT / '.runtime'):
        raise ValueError('Nonsymlink lab inside this checkout .runtime required')
    marker = json.loads((lab / 'lab.json').read_text())
    url = urlsplit(args.base)
    if url.scheme != 'http' or url.hostname != '127.0.0.1' or not url.port or url.username or url.password or url.path not in ['', '/'] or url.query or url.fragment:
        raise ValueError('Explicit loopback http origin required')
    if marker.get('owner') != 'halo-butterfly-next-comparison' or marker.get('schema') != 1 or marker.get('ports', {}).get('halo') != url.port:
        raise ValueError('Lab ownership/port mismatch')
    process = json.loads((lab / 'halo-process.json').read_text())
    identity = process.get('identity', '')
    if not identity.startswith(str(lab) + os.sep) or not isinstance(process.get('pid'), int) or process['pid'] <= 0:
        raise ValueError('Invalid owned process record')
    command = subprocess.check_output(['ps', '-p', str(process['pid']), '-o', 'command='], text=True)
    if identity not in command or '--server.address=127.0.0.1' not in command or '--server.port=' + str(url.port) not in command:
        raise ValueError('Owned Halo process not running')
    installed_bytes = (lab / 'installed-package.json').read_bytes()
    installed = json.loads(installed_bytes)
    if not re.fullmatch(r'[a-f0-9]{40}', args.source_sha) or installed.get('sourceCommit') != args.source_sha or installed.get('sha256') != sha(Path(args.theme_package).read_bytes()):
        raise ValueError('Installed record/source/ZIP mismatch')
    output = Path(args.output).absolute()
    if output.parent.resolve() != output.parent or not output.is_relative_to(lab):
        raise ValueError('Output must have nonsymlink existing parent inside owned lab')
    if not re.fullmatch(r'[A-Za-z0-9._-]+', output.name):
        raise ValueError('Use a simple output directory name for request correlation')
    output.mkdir()  # Refuse existing evidence, including symlink output.
    attachment = lab / 'halo/data/attachments/lab/probe338.html'
    if attachment.parent.resolve() != attachment.parent or attachment.is_symlink():
        raise ValueError('Unsafe attachment path')
    if attachment.exists():
        if attachment.read_bytes() != PROBE:
            raise ValueError('Existing probe attachment differs; never overwrite')
    else:
        with attachment.open('xb') as stream:
            stream.write(PROBE)
    return lab, output, url.port, installed, installed_bytes


def run(args):
    lab, output, port, installed, installed_bytes = owned_lab(args)
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, message, headers, new_url):
            raise ValueError('Diagnostic resources must not redirect')
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    preflight = []
    for route in PATHS:
        with opener.open(args.base.rstrip('/') + route, timeout=3) as response:
            body = response.read()
            if response.status != 200:
                raise ValueError('Preflight must return 200')
            preflight.append({'path': route, 'status': response.status, 'bytes': len(body), 'sha256': sha(body)})
    report = {'schema': 1, 'source': 'https://github.com/halo-dev/halo/issues/10359', 'candidate': installed, 'candidateAttribution': 'Installed-record declaration and provided ZIP digest; no complete installed-file audit.', 'timeoutSeconds': 3, 'preflight': preflight, 'cases': [], 'toolSha256': sha(Path(__file__).read_bytes()), 'limitations': ['Fixed3 queued +3 sequential; no retries or Halo patch.', 'Not a browser reproduction or causal attribution of every historical failure.', 'Operator must separately record plugins/JVM/logging configuration.']}
    log_file = lab / 'halo.log'
    for mode in ['queued', 'sequential']:
        for index in range(3):
            row = {'mode': mode, 'id': mode + '-' + str(index + 1), 'responses': [], 'sent': []}
            report['cases'].append(row)
            start = log_file.stat().st_size
            with socket.create_connection(('127.0.0.1', port), timeout=3) as connection:
                connection.settimeout(3)
                reader = Reader(connection)
                row['clientAddress'] = connection.getsockname()
                requests = [(f'GET {route}?probe338={output.name}-{mode}-{index + 1}-{j} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAccept-Encoding: identity\r\nConnection: keep-alive\r\n\r\n').encode() for j, route in enumerate(PATHS)]
                def send(indices):
                    wire = b''.join(requests[j] for j in indices)
                    connection.sendall(wire)
                    row['sent'].append({'indices': indices, 'bytes': len(wire), 'at': time.time(), 'wire': wire.decode()})
                try:
                    if mode == 'queued':
                        send([0, 1])
                        row['responses'].append(reader.response())
                        row['responses'].append(reader.response())
                        send([2])
                        row['responses'].append(reader.response())
                    else:
                        for j in range(3):
                            send([j])
                            row['responses'].append(reader.response())
                    row['pass'] = all(value['statusLine'].startswith('HTTP/1.1 200 ') and value['sha256'] == preflight[j]['sha256'] for j, value in enumerate(row['responses']))
                except Exception as error:
                    row.update({'pass': False, 'error': repr(error), 'bufferedBytes': len(reader.buffer)})
                    try:
                        lines = subprocess.check_output(['netstat', '-anv', '-p', 'tcp'], text=True, stderr=subprocess.STDOUT, timeout=3).splitlines()
                        row['socketsBeforeClose'] = [line for line in lines if '.' + str(port) + ' ' in line]
                    except Exception as snapshot_error:
                        row['socketSnapshotError'] = str(snapshot_error)
            end = log_file.stat().st_size
            logs = log_file.read_bytes()[start:end]
            (output / (row['id'] + '.server.log')).write_bytes(logs)
            row.update({'serverLogStart': start, 'serverLogEnd': end, 'serverLogSha256': sha(logs), 'queuedDrainEvents': logs.count(b'Draining next pipelined HTTP request')})
            (output / (row['id'] + '.json')).write_text(json.dumps(row, indent=2) + '\n')
            (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
            print(row['id'], 'PASS' if row['pass'] else 'FAIL', flush=True)
    report['installationRecordUnchanged'] = (lab / 'installed-package.json').read_bytes() == installed_bytes
    report['pass'] = report['installationRecordUnchanged'] and len(report['cases']) == 6 and all(row['pass'] for row in report['cases'])
    (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    return 0 if report['pass'] else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['lab-runtime', 'base', 'source-sha', 'theme-package', 'output']:
        parser.add_argument('--' + name, required=True)
    parser.add_argument('--allow-synthetic-writes', required=True, choices=['yes'])
    raise SystemExit(run(parser.parse_args()))
