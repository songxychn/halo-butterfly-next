#!/usr/bin/env python3
"""Real Halo endpoint with a synthetic local Umami 3.4 response, not account acceptance."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import time
import subprocess
import copy
import os
from urllib.parse import parse_qs, urlsplit, urlencode
import urllib.error
import urllib.request
import lab as harness

lab = harness.lab
harness.owned()
if not lab.owned_process('halo'):
    raise RuntimeError('Owned running Halo required')
client = lab.Client()
requests = []
class Stub(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def do_GET(self):
        parsed = urlsplit(self.path)
        query = parse_qs(parsed.query)
        requests.append({'path': parsed.path, 'query': query, 'authorized': self.headers.get('Authorization') == 'Bearer platform-demand-synthetic-key'})
        if not requests[-1]['authorized']:
            self.send_response(401); self.end_headers(); return
        page = query.get('path', [''])[0]
        if page == 'eq./upstream-failure/':
            self.send_response(500); self.end_headers(); return
        data = json.dumps({'pageviews': 78 if page else 456, 'visitors': 12 if page else 120}).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
server = ThreadingHTTPServer(('127.0.0.1', 18628), Stub)
thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
name = 'PluginUmami'
plugin = client.api('/apis/plugin.halo.run/v1alpha1/plugins/' + name)
config_path = '/api/v1alpha1/configmaps/' + plugin['spec']['configMapName']
original = client.api(config_path)
theme_config_path = '/apis/api.console.halo.run/v1alpha1/themes/' + lab.THEME + '/json-config'
theme_original = client.api(theme_config_path)
report = {'haloVersion': lab.VERSIONS['halo']['version'], 'plugin': plugin['spec']['version'], 'upstream': 'synthetic local Umami 3.4.0 stats schema', 'checks': [], 'limitations': ['No real Umami account or production data; actual account reconciliation remains open.']}
public = lab.BASE['halo'] + '/apis/api.umami.halo.run/v1alpha1/stats'
def configure(**patch):
    value = client.api(config_path)
    basic = json.loads(value.get('data', {}).get('basic', '{}')); basic.update(patch)
    value.setdefault('data', {})['basic'] = json.dumps(basic)
    client.api(config_path, 'PUT', value)
    time.sleep(.4)
def get(query=''):
    try:
        response = lab.LOCAL.open(public + query, timeout=6)
        return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read())
try:
    report['result'] = 'failed'
    configure(publicStatsEnabled=False)
    assert get()[0] == 404
    report['checks'].append('disabled endpoint returns 404 anonymously')
    configure(publicStatsEnabled=True, disableTracker=True, endpoint='http://127.0.0.1:18628', websiteId='00000000-0000-4000-8000-000000000001', statsStartAt='2026-01-01T00:00:00Z')
    status, data = get('?' + urlencode({'path': '/archives/demand-none/'}))
    assert status == 200, (status, data)
    assert data == {'site_uv': 120, 'site_pv': 456, 'page_pv': 78}, data
    assert len(requests) == 2 and all(row['authorized'] for row in requests)
    assert all(row['path'] == '/api/websites/00000000-0000-4000-8000-000000000001/stats' for row in requests)
    report['checks'].append('anonymous public counts match synthetic authenticated upstream; fixed website and time range')
    for _ in range(5):
        assert get('?' + urlencode({'path': '/archives/demand-none/'}))[1] == data
    assert len(requests) == 2
    report['checks'].append('repeated public requests share cached upstream results')
    for query in ['?endpoint=https://example.invalid', '?websiteId=other', '?path=/a&path=/b', '?path=//outside', '?path=/a,b', '?path=/%2e%2e/a']:
        assert get(query)[0] == 400, query
    report['checks'].append('invalid and arbitrary upstream query controls rejected')
    status, failure = get('?' + urlencode({'path': '/upstream-failure/'}))
    assert status == 503 and failure == {'error': 'Statistics unavailable'}, (status, failure)
    report['checks'].append('upstream failure returns bounded 503 without credentials, URLs or fabricated zero')
    assert 'platform-demand-synthetic-key' not in json.dumps(data)
    theme_config = copy.deepcopy(theme_original)
    theme_config.setdefault('analytics', {})['umami_analytics'] = {
        'enable': True, 'serverURL': '', 'website_id': '',
        'UV_PV': {'site_uv': True, 'site_pv': True, 'page_pv': True, 'stats_url': '/apis/api.umami.halo.run/v1alpha1/stats'},
    }
    client.api(theme_config_path, 'PUT', theme_config)
    subprocess.run(['bun', str(harness.ROOT / 'scripts/platform-demand/umami-browser.mjs')], cwd=harness.ROOT, env={**os.environ, 'LAB_RUNTIME': str(lab.RUNTIME), 'BASE_URL': lab.BASE['halo']}, check=True)
    report['checks'].append('real home shows site UV/PV and post shows page PV via one anonymous same-origin request per document; credential absent from HTML')
    report['result'] = 'passed'
finally:
    errors = []
    report['themeConfigRestored'] = report['configRestored'] = False
    try:
        client.api(theme_config_path, 'PUT', theme_original)
        report['themeConfigRestored'] = client.api(theme_config_path) == theme_original
    except Exception as error:
        errors.append('theme restoration: ' + type(error).__name__)
    try:
        current = client.api(config_path); current['data'] = original.get('data', {})
        client.api(config_path, 'PUT', current)
        report['configRestored'] = client.api(config_path).get('data', {}) == original.get('data', {})
    except Exception as error:
        errors.append('plugin restoration: ' + type(error).__name__)
    server.shutdown(); server.server_close()
    report['requests'] = requests
    restored = report['themeConfigRestored'] and report['configRestored'] and not errors
    if not restored:
        report['result'] = 'failed'
        report['restorationErrors'] = errors
    lab.write_json(lab.RUNTIME.parent / 'umami-report.json', report)
    if not restored:
        raise RuntimeError('Lab restoration failed; inspect umami-report.json')
print(json.dumps({'result': report['result'], 'checks': len(report['checks']), 'configRestored': report['configRestored']}))
