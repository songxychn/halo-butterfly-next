#!/usr/bin/env python3
"""Manual real-Halo subtitle regression, using only this checkout's owned 18093/14002 lab."""
import argparse
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / '.runtime/subtitle-lab'
BASE = 'http://127.0.0.1:18093'
API_FIXTURES = {'subtitle-text.txt': '远程纯文本', 'subtitle-json.json': '{"data":{"content":"远程 JSON 文案"}}', 'subtitle-html.txt': '<b>甲</b>'}


def sha(value):
    return hashlib.sha256(value).hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline-package', type=Path, required=True)
    parser.add_argument('--baseline-sha', required=True)
    parser.add_argument('--package', type=Path, required=True)
    args = parser.parse_args()
    expected = {'schema': 1, 'ports': {'halo': 18093, 'hexo': 14002}, 'owner': 'halo-butterfly-next-comparison'}
    if json.loads((RUNTIME / 'lab.json').read_text()) != expected or not (RUNTIME / 'seed.json').is_file():
        raise RuntimeError('Bootstrap this checkout\'s dedicated subtitle lab before running')
    os.environ.update(LAB_RUNTIME=str(RUNTIME), HALO_PORT='18093', HEXO_PORT='14002')
    spec = importlib.util.spec_from_file_location('subtitle_lab', ROOT / 'scripts/lab/lab.py')
    lab = importlib.util.module_from_spec(spec); spec.loader.exec_module(lab)
    if not lab.owned_process('halo') or not lab.owned_process('hexo'):
        raise RuntimeError('Both dedicated lab processes must be owned by this checkout')
    source = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    clean = not subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip()
    session = subprocess.check_output(['agent-browser', 'session', 'id', '--scope', 'worktree', '--prefix', 'subtitle'], cwd=ROOT, text=True).strip()

    def browser(*command, script=None):
        result = subprocess.run(['agent-browser', '--session', session, '--allowed-domains', '127.0.0.1', '--json', *command],
                                cwd=ROOT, input=script, capture_output=True, text=True, timeout=45)
        if result.returncode:
            raise RuntimeError('Browser command failed: ' + (result.stderr or result.stdout))
        data = json.loads(result.stdout)
        if not data['success']: raise RuntimeError(str(data['error']))
        return data['data']

    def evaluate(script):
        return browser('eval', '--stdin', script=script)['result']

    report = {'sourceCommit': source, 'workingTreeClean': clean, 'fixtureSourceCommit': source,
              'fixtureSha256': sha(canonical(API_FIXTURES)), 'runnerSha256': sha(Path(__file__).read_bytes()),
              'labFixtureSha256': lab.fixture_hash(), 'upstreamCommit': lab.VERSIONS['butterfly']['commit'],
              'haloVersion': '2.26.1', 'packageSha256': sha(args.package.read_bytes()),
              'baseline': {'sourceCommit': args.baseline_sha, 'packageSha256': sha(args.baseline_package.read_bytes())},
              'capturedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'scenarios': [],
              'limitations': ['Independent headless Chromium only; mobile viewport is not a real touch device.',
                              'Synthetic local TEXT/JSON/404 only; no real third-party provider was contacted.',
                              'No full subtitle-domain, accessibility or visual parity approval.',
                              'Same-version development uploads retain asset URLs; candidate checks use a fresh browser. A version-changing preview upgrade remains a release gate.']}
    output = RUNTIME / 'subtitle-evidence.json'
    screenshots = RUNTIME / 'subtitle-shots'; screenshots.mkdir(exist_ok=True)

    def save():
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')

    client = lab.Client()
    config_path = f'/apis/api.console.halo.run/v1alpha1/themes/{lab.THEME}/json-config'
    for filename, body in API_FIXTURES.items():
        target = RUNTIME / 'halo/data/attachments/lab' / filename
        if target.exists() and target.read_text() != body: raise RuntimeError('Existing local API fixture differs')
        target.write_text(body)
    browser('close')
    browser('open')
    lab.install(client, args.baseline_package, args.baseline_sha)
    original = client.api(config_path)
    legacy = copy.deepcopy(original)
    legacy['index'].update(enable_above=True, typewriter_custom_text='<b>甲</b>|&|<i>乙</i>', enable_typewriter_random_text=False)
    legacy['index'].pop('enable_subtitle', None); legacy['index'].pop('subtitle_effect', None)
    client.api(config_path, 'PUT', legacy)
    report['legacyConfigSha256'] = sha(canonical(legacy))

    def scenario(name, patch, expected_text=None, visible=True, typed=False, api_calls=0, screenshot=True, child_elements=0):
        config = copy.deepcopy(legacy)
        config['index'].update(patch)
        client.api(config_path, 'PUT', config)
        saved = client.api(config_path)
        for key, value in config['index'].items():
            if saved['index'].get(key) != value: raise RuntimeError('Configuration did not persist: ' + key)
        item = {'name': name, 'configSha256': sha(canonical(saved)), 'indexConfig': config['index'], 'views': []}
        for width, height in [(1440, 1000), (390, 844)]:
            for mode in ['light', 'dark']:
                browser('set', 'viewport', str(width), str(height))
                browser('network', 'requests', '--clear')
                browser('open', BASE + '/')
                browser('wait', '--fn', 'document.readyState === "complete" && Boolean(window.MainApp?.useTheme)')
                evaluate('window.MainApp.useTheme.setMode(' + json.dumps(mode) + ')')
                browser('wait', '--fn', '''!document.body.classList.contains('loading') &&
                  !document.querySelector('.loading-container') &&
                  getComputedStyle(document.querySelector('#Butterfly')).display !== 'none' &&
                  document.getAnimations().filter(a => Number.isFinite(a.effect.getComputedTiming().iterations))
                    .every(a => ['finished','idle'].includes(a.playState))''')
                if typed:
                    browser('wait', '--fn', 'Boolean(document.querySelector(".typed-cursor")) && Boolean(document.querySelector(".above-subtitle--text")?.textContent)')
                    if expected_text is not None:
                        browser('wait', '--fn', 'document.querySelector(".above-subtitle--text")?.textContent === ' + json.dumps(expected_text))
                elif visible:
                    browser('wait', '--fn', 'document.querySelector(".above-subtitle--text")?.textContent === ' + json.dumps(expected_text or ''))
                state = evaluate('''({mode:document.documentElement.dataset.colorScheme,
                  width:innerWidth,documentWidth:document.documentElement.scrollWidth,
                  nodeCount:document.querySelectorAll('.above-subtitle').length,
                  cursors:document.querySelectorAll('.above-subtitle .typed-cursor').length,
                  text:document.querySelector('.above-subtitle--text')?.textContent ?? null,
                  childElements:document.querySelector('.above-subtitle--text')?.childElementCount ?? 0,
                  loading:document.body.classList.contains('loading'),
                  navigationOpacity:getComputedStyle(document.querySelector('.nav')).opacity,
                  subtitleOpacity:document.querySelector('.above-subtitle') ? getComputedStyle(document.querySelector('.above-subtitle')).opacity : null,
                  conf:{enabled:MainApp.conf.enable_subtitle,effect:MainApp.conf.subtitle_effect},
                  resources:performance.getEntriesByType('resource').map(x=>x.name).filter(x=>x.includes('/lab/subtitle-')),
                  userAgent:navigator.userAgent})''')
                assert state['mode'] == mode and state['width'] == width and state['documentWidth'] <= width, state
                assert state['nodeCount'] == int(visible) and state['cursors'] == int(typed), state
                assert state['childElements'] == child_elements, state
                assert not state['loading'] and state['navigationOpacity'] == '1', state
                if visible: assert state['subtitleOpacity'] == '1', state
                assert len(state['resources']) == api_calls, state
                if visible and not typed: assert state['text'] == (expected_text or ''), state
                if not visible: assert state['text'] is None, state
                requests = browser('network', 'requests', '--filter', '/lab/subtitle-')['requests']
                state['networkRequestCount'] = len(requests)
                assert len(requests) == api_calls, requests
                if screenshot:
                    file = screenshots / f'{name}-{width}-{mode}.png'
                    browser('screenshot', str(file))
                    state.update(screenshot=str(file.relative_to(RUNTIME)), screenshotSha256=sha(file.read_bytes()))
                item['views'].append(state)
        report['scenarios'].append(item); save()
        print('Passed subtitle scenario:', name, flush=True)

    scenario('before-upgrade-legacy', {}, typed=True, child_elements=1)
    lab.install(client, args.package, source)
    browser('close')
    browser('open')
    report['candidateBrowserCache'] = 'fresh independent browser after same-version development upload'
    upgraded = client.api(config_path)
    for group, fields in legacy.items():
        for key, value in fields.items():
            assert upgraded[group][key] == value, (group, key)
    report['upgradedConfigSha256'] = sha(canonical(upgraded))
    scenario('after-upgrade-missing-switches', {}, typed=True, child_elements=1)
    scenario('enabled', {'enable_subtitle': True, 'subtitle_effect': True}, typed=True, child_elements=1)
    random = {'enable_typewriter_random_text': True, 'typewriter_random_api': BASE + '/lab/subtitle-text.txt'}
    scenario('disabled', {**random, 'enable_subtitle': False}, visible=False)
    scenario('first-screen-disabled', {**random, 'enable_above': False, 'enable_subtitle': True}, visible=False)
    scenario('static', {'enable_subtitle': True, 'subtitle_effect': False, 'typewriter_custom_text': '<b>第一项</b>|&|第二项'}, '<b>第一项</b>')
    scenario('empty', {'enable_subtitle': True, 'subtitle_effect': True, 'typewriter_custom_text': ''}, '')
    scenario('api-text-static', {**random, 'subtitle_effect': False}, '远程纯文本', api_calls=1, screenshot=False)
    json_api = {**random, 'typewriter_random_api': BASE + '/lab/subtitle-json.json', 'typewriter_api_value_format': 'data.content'}
    scenario('api-json-static', {**json_api, 'subtitle_effect': False}, '远程 JSON 文案', api_calls=1, screenshot=False)
    scenario('api-json-missing-path', {**json_api, 'typewriter_api_value_format': 'data.missing.child', 'subtitle_effect': False}, '<b>甲</b>', api_calls=1, screenshot=False)
    scenario('api-404', {**random, 'typewriter_random_api': BASE + '/lab/subtitle-missing.json', 'subtitle_effect': False}, '<b>甲</b>', api_calls=1, screenshot=False)
    scenario('api-text-dynamic', random, typed=True, api_calls=1, screenshot=False)
    scenario('api-html-dynamic', {**random, 'typewriter_random_api': BASE + '/lab/subtitle-html.txt'}, '<b>甲</b>', typed=True, api_calls=1, screenshot=False)
    report['browserVersion'] = evaluate("navigator.userAgentData.getHighEntropyValues(['fullVersionList','platformVersion'])")
    client.api(config_path, 'PUT', legacy)
    report['retainedConfigSha256'] = sha(canonical(client.api(config_path)))
    report['result'] = 'passed'; save()
    browser('close')
    print('Evidence:', output)


if __name__ == '__main__':
    main()
