#!/usr/bin/env python3
"""Verify real 404 status/content negotiation and themed HTML on the local lab."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import urllib.error
import urllib.request


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.title = ''
        self.in_title = False

    def handle_starttag(self, tag, attributes):
        self.tags.append((tag, dict(attributes)))
        if tag == 'title':
            self.in_title = True

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', required=True, choices=['http://127.0.0.1:18095', 'http://127.0.0.1:18096'])
    parser.add_argument('--output', type=Path, default=Path('.evidence/error-page/http'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    repo = Path(__file__).resolve().parents[2]
    version = json.loads((repo / 'package.json').read_text())['version']
    package = repo / f'dist/halo-butterfly-next-{version}.zip'
    site_title = json.loads((repo / 'fixtures/comparison/content.json').read_text())['site']['title']
    report = {'sourceSha': subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip(), 'sourceWorktreeDirty': bool(subprocess.check_output(['git', '-C', str(repo), 'status', '--porcelain'], text=True).strip()), 'artifactSha256': hashlib.sha256(package.read_bytes()).hexdigest(), 'base': args.base, 'checks': []}
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    cases = [(method, path, accept) for method in ['GET', 'HEAD'] for path in ['/__error404_fixture__/missing', '/__error404_fixture__/deep/path?probe=escaped%3Ctext%3E'] for accept in ['text/html', 'application/json']]
    cases += [('GET', '/', 'text/html'), ('GET', '/themes/halo-butterfly-next/assets/css/error404.min.css', 'text/css'), ('GET', '/themes/halo-butterfly-next/assets/js/error404.min.js', 'text/javascript')]
    try:
        for index, (method, path, accept) in enumerate(cases):
            url = args.base + path
            try:
                response = opener.open(urllib.request.Request(url, method=method, headers={'Accept': accept}), timeout=30)
            except urllib.error.HTTPError as error:
                response = error
            body = response.read()
            expected = 404 if path.startswith('/__error404_fixture__/') else 200
            record = {'method': method, 'path': path, 'accept': accept, 'status': response.code, 'contentType': response.headers.get('Content-Type'), 'url': response.url, 'bytes': len(body), 'bodySha256': hashlib.sha256(body).hexdigest()}
            report['checks'].append(record)
            assert response.code == expected and response.url == url, record
            if method == 'HEAD':
                assert body == b'', record
            elif expected == 404 and accept == 'text/html':
                assert 'text/html' in record['contentType'], record
                html = body.decode('utf-8'); page = Page(); page.feed(html)
                assert site_title in page.title and '404' in page.title, page.title
                assert any(attrs.get('id') == 'error-content' for _, attrs in page.tags), 'Theme error template missing'
                assert any(tag == 'meta' and attrs.get('name') == 'robots' and 'noindex' in attrs.get('content', '') for tag, attrs in page.tags)
                assert not any(tag == 'link' and 'canonical' in attrs.get('rel', '').split() for tag, attrs in page.tags), '404 must not canonicalize to a valid content page'
                assert any(tag == 'a' and attrs.get('class') == 'error-home' and attrs.get('href') == '/' for tag, attrs in page.tags)
                (args.output / f'{index}-404.html').write_text(html)
            elif expected == 404:
                problem = json.loads(body)
                assert problem['status'] == 404 and 'application/problem+json' in record['contentType'], record
                (args.output / f'{index}-problem.json').write_text(json.dumps(problem, ensure_ascii=False, indent=2))
        report['result'] = 'passed'
    except Exception as error:
        report.update(result='failed', error=str(error))
        raise
    finally:
        (args.output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f"{len(report['checks'])} real HTTP error-page checks passed")


if __name__ == '__main__':
    main()
