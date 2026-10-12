#!/usr/bin/env python3
"""SEO regression against this checkout's owned, already-seeded comparison Halo.

Run after installing the built ZIP into an isolated lab. No public-site target is accepted.
The optional browser checks use an independent headless agent-browser session.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import time
from html.parser import HTMLParser
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[2]


class Head(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.in_head = False
        self.metas = []
        self.canonicals = []
        self.jsonld = []
        self.json_text = None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'head': self.in_head = True
        if not self.in_head: return
        if tag == 'meta': self.metas.append(attrs)
        if tag == 'link' and attrs.get('rel') == 'canonical': self.canonicals.append(attrs['href'])
        if tag == 'script' and attrs.get('type') == 'application/ld+json': self.json_text = ''

    def handle_data(self, data):
        if self.json_text is not None: self.json_text += data

    def handle_endtag(self, tag):
        if tag == 'head': self.in_head = False
        if tag == 'script' and self.json_text is not None:
            self.jsonld.append(json.loads(self.json_text))
            self.json_text = None

    def values(self, key):
        return [m.get('content') for m in self.metas if m.get('name', m.get('property')) == key]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--port', type=int, required=True)
    parser.add_argument('--browser', action='store_true')
    parser.add_argument('--package', type=Path, help='Install a freshly built ZIP before checking')
    args = parser.parse_args()
    runtime = args.runtime.resolve()
    runtime.relative_to(ROOT / '.runtime')
    marker = json.loads((runtime / 'lab.json').read_text())
    assert marker['owner'] == 'halo-butterfly-next-comparison' and marker['ports']['halo'] == args.port
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(args.port), HEXO_PORT=str(marker['ports']['hexo']))
    spec = importlib.util.spec_from_file_location('seo_lab', ROOT / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(spec); spec.loader.exec_module(lab)
    assert lab.owned_process('halo') and (runtime / 'seed.json').is_file()
    client = lab.Client()
    if args.package:
        lab.install(client, args.package, subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip())
    cfg_path = f'/apis/api.console.halo.run/v1alpha1/themes/{lab.THEME}/json-config'
    cfg_saved = client.api(cfg_path)
    sys_path = '/api/v1alpha1/configmaps/system'
    sys_saved = client.api(sys_path)
    page_path = '/apis/content.halo.run/v1alpha1/singlepages/about-preview'
    page_saved = client.api(page_path)
    report = {
        'sourceSha': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'trackedWorkingTreeClean': not subprocess.check_output(['git', 'diff', 'HEAD', '--name-only'], cwd=ROOT, text=True).strip(),
        'testedAt': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'haloVersion': '2.26.1',
        'package': json.loads((runtime / 'installed-package.json').read_text()),
        'runnerSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'checks': [], 'limitations': ['不是完整 1.0 验收；未安装真实生态 SEO 插件；仅合成公共布局与 Halo 全局注入组合。'],
    }
    session = None
    probe = runtime / 'halo/data/themes/halo-butterfly-next/templates/seo-layout-probe.html'
    assert not probe.exists(), 'Refusing to replace an existing fixture'

    def save_config(config):
        client.api(cfg_path, 'PUT', config)
        time.sleep(.5)

    def html(path, status=200):
        try:
            res = lab.LOCAL.open(lab.BASE['halo'] + path, timeout=30)
            code = res.status; value = res.read().decode()
        except HTTPError as err:
            code = err.code; value = err.read().decode()
        assert code == status, (path, code)
        return value

    def check(name, action):
        action(); report['checks'].append({'name': name, 'result': 'passed'})
        print('PASS', name, flush=True)

    def require(condition, detail='Assertion failed'):
        assert condition, detail

    def replace_system(data):
        current = client.api(sys_path)
        current['data'] = copy.deepcopy(data)
        client.api(sys_path, 'PUT', current)
        time.sleep(.5)

    def replace_page(spec):
        current = client.api(page_path); current['spec'] = copy.deepcopy(spec)
        client.api(page_path, 'PUT', current)
        time.sleep(.5)

    def browser(*commands, code=None):
        res = subprocess.run(['agent-browser', '--session', session, '--allowed-domains', '127.0.0.1', '--json', *commands],
                             cwd=ROOT, input=code, capture_output=True, text=True, timeout=45)
        data = json.loads(res.stdout)
        assert res.returncode == 0 and data['success'], str(data.get('error', res.stderr))
        return data['data']

    try:
        cfg = copy.deepcopy(cfg_saved)
        cfg['base']['enable_seo'] = True
        cfg['seo'] = {'structured_data': True, 'alternate_name': [{'name': '实验站'}, None, {'name': ' '}],
                      'twitter_card': 'summary', 'twitter_id': '@author', 'twitter_site': '@site',
                      'twitter_image': '/lab/avatar.svg', 'fb_admins': '123', 'fb_app_id': '456',
                      'google_plus': 'https://publisher.example.invalid/',
                      'site_verification': [{'name': 'seo-verification', 'content': 'a"<&>值'}, None, {'name': '', 'content': 'ignored'}, {'name': 'seo-verification-2', 'content': 'second-platform'}, {'name': 'seo-duplicate', 'content': 'old'}, {'name': 'seo-duplicate', 'content': 'new'}]}
        cfg['inject'] = {
            'head': [{'html': '<script id="seo-head-1">window.__seoOrder=["head-1"];</script>'}, None, {'html': ' '},
                     {'html': '<script id="seo-head-2">window.__seoOrder.push("head-2");</script>'},
                     {'html': '<meta name="seo-literal-template" th:content="${7 * 7}" content="literal">'}],
            'bottom': [{'html': '<script id="seo-bottom-1">window.__seoOrder.push("bottom-1");</script>'},
                       {'html': '<script id="seo-bottom-2">window.__seoOrder.push("bottom-2");</script>'}]}
        save_config(cfg)
        system = copy.deepcopy(sys_saved['data'])
        system['codeInjection'] = json.dumps({'globalHead': '<script id="seo-global-head">window.__seoOrder.push("halo-head");</script>',
                                              'contentHead': '<meta name="seo-content-head" content="content">',
                                              'footer': '<script id="seo-global-footer">window.__seoOrder.push("halo-footer");</script>'})
        replace_system(system)
        routes = ['/', '/page/2/', '/archives/', '/categories/', '/categories/development/', '/tags/',
                  '/tags/butterfly/', '/archives/preview-1/', '/about-preview/']
        heads = {}
        for route in routes:
            raw = html(route); head = Head(raw); heads[route] = head
            check('canonical ' + route, lambda h=head, r=route: require(len(h.canonicals) == 1 and h.canonicals[0] == lab.BASE['halo'] + (r.rstrip('/') or '/'), h.canonicals))
            check('metadata and injection ' + route, lambda h=head, s=raw: require(
                h.values('seo-verification') == ['a"<&>值'] and h.values('twitter:card') == ['summary'] and
                h.values('twitter:image') == [lab.BASE['halo'] + '/lab/avatar.svg'] and h.values('twitter:creator') == ['@author'] and
                h.values('fb:app_id') == ['456'] and s.index('id="seo-head-1"') < s.index('id="seo-head-2"') < s.index('id="seo-global-head"') < s.index('</head>') and
                s.index('id="seo-global-footer"') < s.index('id="seo-bottom-1"') < s.index('id="seo-bottom-2"') < s.index('</body>')))
        check('JSON-LD route scope', lambda: require([d['@type'] for d in heads['/'].jsonld] == ['WebSite'] and [d['@type'] for d in heads['/archives/preview-1/'].jsonld] == ['BlogPosting'] and all(not heads[r].jsonld for r in routes if r not in ['/', '/archives/preview-1/'])))
        post_ld = heads['/archives/preview-1/'].jsonld[0]
        check('BlogPosting dates author and image', lambda: require(isinstance(post_ld['datePublished'], str) and 'T' in post_ld['dateModified'] and post_ld['author'][0]['name'] == lab.CONTENT['site']['author'] and post_ld['image'].startswith(lab.BASE['halo'] + '/lab/')))
        check('WebSite aliases include subtitle and hostname', lambda: require(heads['/'].jsonld[0]['alternateName'] == ['实验站', lab.CONTENT['site']['subtitle'], '127.0.0.1']))
        check('multiple verification platforms and same-name Halo deduplication', lambda: require(heads['/'].values('seo-verification-2') == ['second-platform'] and heads['/'].values('seo-duplicate') == ['new']))
        check('query excluded from canonical', lambda: require(Head(html('/page/2/?utm_source=seo-test')).canonicals == [lab.BASE['halo'] + '/page/2']))
        check('404 has no canonical or JSON-LD', lambda: require(not Head(html('/seo-not-found', 404)).canonicals and not Head(html('/seo-not-found', 404)).jsonld))
        check('injected HTML not evaluated as Thymeleaf', lambda: require(Head(html('/')).values('seo-literal-template') == ['literal']))
        for image, expected in [('https://images.example.invalid/p.png', 'https://images.example.invalid/p.png'), ('//images.example.invalid/p.png', 'http://images.example.invalid/p.png'), ('lab/avatar.svg', lab.BASE['halo'] + '/lab/avatar.svg'), ('', heads['/'].values('og:image')[0])]:
            cfg['seo']['twitter_image'] = image; save_config(cfg)
            check('Twitter URL ' + repr(image), lambda e=expected: require(Head(html('/')).values('twitter:image') == [e]))
        cfg['seo']['twitter_image'] = '/lab/avatar.svg'
        hostile = '<!--<script>"\\</script><script id="seo-escape-probe">window.__escaped=false</script><>&\u2028\u2029'
        cfg['seo']['alternate_name'] = [{'name': hostile}]; save_config(cfg)
        basic = json.loads(system['basic']); basic['title'] = hostile
        system['basic'] = json.dumps(basic); replace_system(system)
        raw = html('/'); parsed = Head(raw)
        check('JSON and attribute special characters roundtrip', lambda: require(parsed.jsonld[0]['name'] == hostile and parsed.jsonld[0]['alternateName'][0] == hostile and parsed.values('og:site_name') == [hostile] and '<script id="seo-escape-probe">' not in raw, {'name': parsed.jsonld[0]['name'], 'alias': parsed.jsonld[0]['alternateName'][0], 'og': parsed.values('og:site_name'), 'expected': hostile, 'rawScript': '<script id="seo-escape-probe">' in raw}))
        json_raw = re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', raw, re.S)
        check('JSON-LD HTML tokenizer safety', lambda: require(len(json_raw) == 1 and not any(c in json_raw[0] for c in ['<', '>', '\u2028', '\u2029']) and 'id="seo-bottom-2"' in raw))
        control = 'control \x00 \b \t \n \r \\\x00 \" \' end'
        cfg['seo']['alternate_name'] = [{'name': control}]; save_config(cfg)
        check('JSON control characters and literal backslashes roundtrip', lambda: require(Head(html('/')).jsonld[0]['alternateName'][0] == control))
        # Restore the synthetic site title before rendering screenshots/browser checks.
        system['basic'] = sys_saved['data']['basic']; replace_system(system)
        cfg['seo']['alternate_name'] = [{'name': '实验站'}]; save_config(cfg)
        # Exercise plugin-owned head through the real public layout contract.
        probe.write_bytes((ROOT / 'fixtures/seo/plugin-layout.html').read_bytes())
        page_spec = copy.deepcopy(page_saved['spec']); page_spec['template'] = probe.name; replace_page(page_spec)
        for _ in range(20):
            plugin_raw = html('/about-preview/')
            if 'seo-plugin-probe' in plugin_raw: break
            time.sleep(.2)
        else: raise AssertionError('Plugin fixture did not reconcile')
        plugin_head = Head(plugin_raw)
        check('plugin public layout keeps provided SEO and supports injection', lambda: require(plugin_head.canonicals == ['https://plugin.example.invalid/owned-page'] and plugin_head.values('og:title') == ['插件自有 OG'] and plugin_head.values('seo-verification') == ['a"<&>值'] and 'id="seo-bottom-2"' in plugin_raw))
        if args.browser:
            session = subprocess.check_output(['agent-browser', 'session', 'id', '--scope', 'worktree', '--prefix', 'seo'], cwd=ROOT, text=True).strip()
            browser('open', lab.BASE['halo'] + '/')
            for width, height in [(1440, 1000), (390, 844)]:
                for mode in ['light', 'dark']:
                    browser('set', 'viewport', str(width), str(height))
                    browser('set', 'media', mode)
                    # Use theme storage as well as media emulation, because user mode is persistent.
                    browser('eval', '--stdin', code=f"localStorage.setItem('halo-butterfly-next.color-scheme', '{mode}');")
                    for route in ['/', '/page/2/', '/archives/preview-1/', '/about-preview/']:
                        browser('errors', '--clear'); browser('open', lab.BASE['halo'] + route)
                        browser('wait', '--fn', 'window.__seoOrder?.includes("bottom-2") && !document.body.classList.contains("loading")')
                        result = browser('eval', '--stdin', code='''JSON.stringify({order:window.__seoOrder,escaped:!!document.querySelector('script#seo-escape-probe'),canonical:[...document.querySelectorAll('head link[rel="canonical"]')].map(x=>x.href),ld:[...document.querySelectorAll('head script[type="application/ld+json"]')].map(x=>JSON.parse(x.textContent)),lang:document.documentElement.lang,ready:!!window.MainApp,mode:document.documentElement.getAttribute('data-color-scheme')})''')
                        state = json.loads(result['result'])
                        check(f'browser {width}px {mode} {route}', lambda s=state, r=route: require(s['order'] == ['head-1','head-2','halo-head','halo-footer','bottom-1','bottom-2'] and not s['escaped'] and s['ready'] and len(s['canonical']) == 1 and s['mode'] == mode, s))
                        errors = browser('errors')
                        require(not errors.get('errors'), errors)
                        if route == '/': browser('screenshot', str(runtime / f'{width}-{mode}.png'))
        replace_page(page_saved['spec']); probe.unlink()
        # Disable switches independently; platform description and injection remain available.
        cfg['base']['enable_seo'] = False; save_config(cfg)
        head = Head(html('/'))
        check('SEO disabled preserves verification and Halo description', lambda: require(not head.canonicals and not head.values('og:title') and not head.jsonld and head.values('seo-verification') == ['a"<&>值'] and len(head.values('description')) == 1))
        cfg['base']['enable_seo'] = True; cfg['seo']['structured_data'] = False; save_config(cfg)
        check('JSON-LD independently disabled', lambda: require(not Head(html('/')).jsonld and len(Head(html('/')).canonicals) == 1))
        # Old saved configurations without either new group continue to render.
        cfg.pop('seo'); cfg.pop('inject'); save_config(cfg)
        raw = html('/')
        check('legacy config defaults and empty lists', lambda: require(len(Head(raw).canonicals) == 1 and not Head(raw).jsonld and 'id="seo-head-1"' not in raw and not Head(raw).values('seo-verification')))
        report['result'] = 'passed'
    except Exception as error:
        report['result'] = 'failed'; report['error'] = str(error)
        raise
    finally:
        save_config(cfg_saved)
        replace_system(sys_saved['data'])
        replace_page(page_saved['spec'])
        if probe.exists(): probe.unlink()
        if session:
            subprocess.run(['agent-browser', '--session', session, 'close'], cwd=ROOT, capture_output=True, timeout=20)
        report['restored'] = client.api(cfg_path) == cfg_saved and client.api(sys_path)['data'] == sys_saved['data'] and client.api(page_path)['spec'] == page_saved['spec']
        (runtime / 'seo-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        assert report['restored'], 'Fixture configuration restoration failed'


if __name__ == '__main__': main()
