#!/usr/bin/env python3
"""Top-image scenarios on an owned synthetic Halo lab; requires headless agent-browser."""
import copy
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lab'))
import lab

OUT = lab.RUNTIME.parent / 'top-image-validation'
SESSION = 'top-image-validation-' + str(lab.PORTS['halo'])
CONFIG = '/apis/api.console.halo.run/v1alpha1/themes/' + lab.THEME + '/json-config'
POST = '/apis/content.halo.run/v1alpha1/posts/preview-1'
PAGE = '/apis/content.halo.run/v1alpha1/singlepages/about-preview'
TAG = '/apis/content.halo.run/v1alpha1/tags/butterfly'
CATEGORY = '/apis/content.halo.run/v1alpha1/categories/development'


def browser(*args):
    result = subprocess.run(['agent-browser', '--session', SESSION, '--json', *args],
                            capture_output=True, text=True, timeout=45)
    if result.returncode:
        raise RuntimeError('Headless browser command failed: ' + args[0])
    value = json.loads(result.stdout)
    if not value.get('success'):
        raise RuntimeError('Headless browser command failed: ' + args[0])
    return value.get('data', {}).get('result')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', nargs='+', help='Run named scenario assertions only')
    args = parser.parse_args()
    # Client checks ownership and credentials permissions before any writes.
    client = lab.Client()
    OUT.mkdir(parents=True, exist_ok=True)
    originals = {path: client.api(path) for path in [CONFIG, POST, PAGE, TAG, CATEGORY]}
    lab.write_json(OUT / 'originals.json', originals, private=True)
    installed = json.loads((lab.RUNTIME / 'installed-package.json').read_text())
    results = []

    def update(path, mutate):
        for attempt in range(4):
            value = client.api(path)
            mutate(value)
            try:
                client.api(path, 'PUT', value)
                return
            except lab.ApiError as error:
                if error.status != 409 or attempt == 3:
                    raise
                time.sleep(0.1 * 2 ** attempt)

    def config(**groups):
        value = copy.deepcopy(originals[CONFIG])
        for group, fields in groups.items():
            value.setdefault(group, {}).update(fields)
        client.api(CONFIG, 'PUT', value)

    def content(path, cover=None, visibility=None):
        def mutate(value):
            if cover is not None:
                value['spec']['cover'] = cover
            if visibility is not None:
                value['metadata'].setdefault('annotations', {})['top_img_enable'] = visibility
        update(path, mutate)

    def check(name, route, enabled, image=None, title=None, screenshot=False):
        if args.only and name not in args.only:
            return
        for width, height in [(1440, 1000), (390, 844)]:
            browser('set', 'viewport', str(width), str(height))
            for mode in ['light', 'dark']:
                item = {'scenario': name, 'route': route, 'width': width, 'mode': mode}
                try:
                    browser('eval', 'localStorage.setItem("halo-butterfly-next.color-scheme",' + json.dumps(mode) + ')')
                    browser('open', lab.BASE['halo'] + route)
                    data = browser('eval', '''Promise.all([document.fonts.ready,new Promise(r=>setTimeout(r,1100))]).then(()=>{
                      const top=document.querySelector('.header .above');
                      return {enabled:window.MainApp.conf.enable_above,visible:!!top,
                        image:document.documentElement.style.getPropertyValue('--above-background'),
                        title:(document.querySelector('.header h1')||document.querySelector('.content h1'))?.textContent,
                        meta:document.querySelectorAll('.post-meta').length,
                        preload:[...document.querySelectorAll('link[as="image"]')].map(x=>x.getAttribute('href')),
                        overflow:document.documentElement.scrollWidth>innerWidth,
                        loading:document.body.classList.contains('loading'),
                        scheme:document.documentElement.dataset.colorScheme,
                        version:navigator.userAgent,
                        imageErrors:[...document.images].filter(i=>i.classList.contains('error')).length};
                    })''')
                    item['actual'] = data
                    assert data['enabled'] == enabled and data['visible'] == enabled, 'visibility'
                    assert data['scheme'] == mode, 'mode'
                    assert not data['loading'] and not data['overflow'], 'readiness/layout'
                    if route == '/archives/preview-1/':
                        assert data['meta'] == 1, 'duplicate post metadata'
                    if image is not None:
                        assert data['image'] == ('url(' + json.dumps(image) + ')' if image else ''), 'image'
                    if title is not None:
                        assert data['title'] == title, 'title'
                    if not enabled:
                        assert not data['preload'] and not data['image'], 'disabled image fetch'
                    assert not data['imageErrors'], 'unexpected img fallback'
                    if screenshot:
                        browser('screenshot', str(OUT / (name + '-' + str(width) + '-' + mode + '.png')))
                    item['result'] = 'passed'
                except Exception as error:
                    item.update(result='failed', error=str(error))
                results.append(item)
        print(name + ': ' + str(sum(x['result'] == 'passed' for x in results[-4:])) + '/4', flush=True)

    try:
        browser('open', lab.BASE['halo'] + '/')
        content(CATEGORY, cover='/lab/cover-autumn-forest.webp')
        content(TAG, cover='/lab/cover-golden-mountain.webp')
        check('native-category', '/categories/development/', True, '/lab/cover-autumn-forest.webp', '主题开发')
        check('native-tag', '/tags/butterfly/', True, '/lab/cover-golden-mountain.webp', 'Butterfly')
        check('native-post', '/archives/preview-1/', True, originals[POST]['spec']['cover'])
        config(image={'default_top_img': '/lab/cover-sand-dunes.webp'})
        content(POST, cover='')
        check('post-default', '/archives/preview-1/', True, '/lab/cover-sand-dunes.webp')
        content(PAGE, cover='')
        check('single-default', '/about-preview/', True, '/lab/cover-sand-dunes.webp')
        config(image={'default_top_img': ''})
        check('post-empty-legacy', '/archives/preview-1/', True, '')
        check('single-home-legacy', '/about-preview/', True, originals[CONFIG]['index']['above_background'])
        config(loading={'img': {**originals[CONFIG]['loading']['img'], 'random_enable': True, 'random_link': '/lab/cover-autumn-forest.webp'}})
        check('post-random-legacy', '/archives/preview-1/', True, '/lab/cover-autumn-forest.webp')
        config(image={'default_top_img': '/lab/cover-sand-dunes.webp'}, index={'above_background': ''})
        check('home-default', '/', True, '/lab/cover-sand-dunes.webp')
        content(POST, cover='/lab/missing-top-image.webp')
        check('broken-cover-fallback', '/archives/preview-1/', True, '/lab/cover-sand-dunes.webp')
        config(image={'default_top_img': '/lab/missing-default.webp'})
        check('broken-both-pure-color', '/archives/preview-1/', True, '')
        content(POST, cover=originals[POST]['spec']['cover'], visibility='false')
        config()
        check('post-hidden', '/archives/preview-1/', False, '', 'Butterfly 对照：排版与交互', True)
        content(POST, visibility='true')
        config(post={'enable_above': False})
        check('post-show-override', '/archives/preview-1/', True, originals[POST]['spec']['cover'])
        content(POST, visibility='inherit')
        check('post-inherit-disabled', '/archives/preview-1/', False, '')
        content(PAGE, visibility='false')
        config()
        check('single-hidden', '/about-preview/', False, '', '关于对照实验室')
        content(PAGE, visibility='true')
        config(index={'enable_above': False})
        check('single-show-override', '/about-preview/', True, originals[CONFIG]['index']['above_background'])
        content(POST, visibility='true')
        config(image={'disable_top_img': True})
        for route in ['/', '/archives/', '/categories/', '/categories/development/', '/tags/', '/tags/butterfly/', '/archives/preview-1/', '/about-preview/']:
            check('global-off-' + route.strip('/').replace('/', '-'), route, False, '')
        content(POST, visibility='inherit')
        content(PAGE, visibility='inherit')
        config(image={'disable_top_img': 'true'})
        check('global-off-string', '/archives/preview-1/', False, '')
        # A legacy config really has no image group, rather than new defaults.
        legacy = copy.deepcopy(originals[CONFIG]); legacy.pop('image', None)
        client.api(CONFIG, 'PUT', legacy)
        check('legacy-missing-group', '/archives/preview-1/', True, originals[POST]['spec']['cover'])
    finally:
        for path, original in originals.items():
            if path == CONFIG:
                client.api(path, 'PUT', original)
            else:
                def restore(current):
                    current['spec']['cover'] = original['spec'].get('cover', '')
                    current['metadata']['annotations'] = original['metadata'].get('annotations', {})
                update(path, restore)
        restored = all(client.api(path) == original if path == CONFIG else
                       client.api(path)['spec'].get('cover', '') == original['spec'].get('cover', '') and
                       client.api(path)['metadata'].get('annotations', {}) == original['metadata'].get('annotations', {})
                       for path, original in originals.items())
        report = {'testedAt': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'installed': installed,
                  'runnerSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  'restored': restored, 'results': results,
                  'limitations': ['Headless Chromium only; no Safari or physical-device acceptance.',
                                  'No full fixed Hexo dual-site acceptance.']}
        lab.write_json(OUT / 'report.json', report)
        browser('close')
    failed = sum(item['result'] != 'passed' for item in results)
    print(str(len(results) - failed) + '/' + str(len(results)) + '; restored=' + str(restored))
    return 1 if failed or not restored or not results else 0


if __name__ == '__main__':
    sys.exit(main())
