"""Native body/UI locale separation within the owned fixture and restore window."""
import copy
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
import urllib.parse
import urllib.request


class LanguageMarkup(HTMLParser):
    def __init__(self):
        super().__init__()
        self.observed = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'html': self.observed['ui'] = attrs.get('lang')
        if tag == 'article' and 'render' in attrs.get('class', '').split(): self.observed['body'] = attrs.get('lang')
        if tag == 'meta' and attrs.get('property') == 'og:locale': self.observed['og'] = attrs.get('content')


def run_language(client, lab, guard, fixture, output, subject_url):
    original = client.api(subject_url)
    annotations = copy.deepcopy(original['metadata'].get('annotations', {}))
    basic = json.loads(client.api('/api/v1alpha1/configmaps/system')['data']['basic'])
    assert basic['language'] == 'zh-CN', 'This declared matrix requires the unchanged zh-CN site locale'
    report = {'status': 'running', 'cases': [], 'restored': False, 'siteLanguage': basic['language']}
    lab.write_json(output / 'language-restore.private.json', original, private=True)
    # name, body annotation, query, cookie, Accept-Language, expected UI/body/OG, browser matrix
    scenes = [
        ('query-over-cookie', 'ja', 'en', 'ko', 'ja', ['en', 'ja', 'ja_JP'], True),
        ('empty-body', '', 'ko', '', 'en', ['ko', 'ko', 'ko_KR'], True),
        ('invalid-body', 'invalid', 'zh-TW', '', 'en', ['zh-TW', 'zh-TW', 'zh_TW'], True),
        ('cookie-over-site', 'ko', '', 'ja', 'en', ['ja', 'ko', 'ko_KR'], False),
        ('site-over-accept', '', '', '', 'en', ['zh-CN', 'zh-CN', 'zh_CN'], False),
        ('unknown-ui', '', 'de', '', 'en', ['en', 'en', 'en_US'], False),
        ('regional-english', '', 'en-GB', '', 'en', ['en-GB', 'en-GB', 'en_GB'], False),
        ('regional-chinese', '', 'zh-SG', '', 'en', ['zh-SG', 'zh-SG', 'zh_SG'], False),
        ('traditional-body', 'zh-HK', 'en', '', 'en', ['en', 'zh-HK', 'zh_HK'], False),
    ]
    try:
        for name, annotation, query, cookie, accept, expected, browser in scenes:
            current = client.api(subject_url)
            current['metadata'].setdefault('annotations', {})['language'] = annotation
            client.api(subject_url, 'PUT', current)
            assert client.api(subject_url)['metadata']['annotations']['language'] == annotation
            url = lab.BASE['halo'] + fixture['post']['path'] + ('?language=' + urllib.parse.quote(query) if query else '')
            headers = {'Accept-Language': accept}
            if cookie: headers['Cookie'] = 'language=' + cookie
            with lab.LOCAL.open(urllib.request.Request(url, headers=headers), timeout=20) as response:
                assert response.status == 200
                html = response.read().decode()
            parser = LanguageMarkup(); parser.feed(html)
            row = {'name': name, 'annotation': annotation, 'query': query, 'cookie': cookie, 'accept': accept,
                   'expected': dict(zip(['ui', 'body', 'og'], expected)), 'observed': parser.observed,
                   'htmlSha256': hashlib.sha256(html.encode()).hexdigest(), 'status': 'running'}
            report['cases'].append(row)
            assert row['observed'] == row['expected'], row
            assert 'Owned local comment acceptance fixture.' in html, 'Author body changed'
            assert '??ui.' not in html, 'Missing UI translation'
            if browser:
                lab.write_json(output / 'language-fixture.json', {**fixture, **row})
                code = guard.run_browser(['bun', str(Path(__file__).with_name('language-check.mjs')), str(output / 'language-fixture.json')], output / (name + '.log'), lab.BASE['halo'], timeout=240)
                row['browserExitCode'] = code
                assert code == 0, 'Language browser matrix failed: ' + name
            row['status'] = 'passed'
            lab.write_json(output / 'language-report.json', report)
        report['status'] = 'passed-tested-scope'
    except Exception as error:
        report['status'] = 'failed'; report['error'] = str(error)
        raise
    finally:
        current = client.api(subject_url)
        if 'annotations' in original['metadata']: current['metadata']['annotations'] = annotations
        else: current['metadata'].pop('annotations', None)
        client.api(subject_url, 'PUT', current)
        report['restored'] = client.api(subject_url)['metadata'].get('annotations', {}) == annotations
        lab.write_json(output / 'language-report.json', report)
        assert report['restored'], 'Language annotation restoration failed'
