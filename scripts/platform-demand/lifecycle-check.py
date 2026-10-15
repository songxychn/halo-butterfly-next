#!/usr/bin/env python3
"""Disable/re-enable plugins and switch themes only in the owned demand lab."""
import json
import time
import lab as harness

lab = harness.lab
harness.owned()
if not lab.owned_process('halo'):
    raise RuntimeError('Owned running Halo required')
client = lab.Client()
plugins = ['PluginCommentWidget', 'plugin-katex']
original = {name: client.api('/apis/plugin.halo.run/v1alpha1/plugins/' + name)['spec']['enabled'] for name in plugins}
system = client.api('/api/v1alpha1/configmaps/system')
theme = json.loads(system['data']['theme'])['active']
assert theme == lab.THEME, 'Run only with the candidate theme active'
themes = client.api('/apis/theme.halo.run/v1alpha1/themes')['items']
assert any(row['metadata']['name'] == 'theme-earth' for row in themes)
report = {'haloVersion': lab.VERSIONS['halo']['version'], 'checks': [], 'restored': False, 'result': 'failed'}

def state(name, enabled):
    client.api('/apis/api.console.halo.run/v1alpha1/plugins/' + name + '/plugin-state', 'PUT', {'enable': enabled, 'async': False})
    time.sleep(.3)

def activate(name):
    client.api('/apis/api.console.halo.run/v1alpha1/themes/' + name + '/activation', 'PUT')
    time.sleep(.3)

def html():
    with lab.LOCAL.open(lab.BASE['halo'] + '/archives/demand-raw/', timeout=20) as response:
        assert response.status == 200
        value = response.read().decode()
    assert '</html>' in value, 'Incomplete server-rendered document'
    return value

try:
    for name in plugins:
        state(name, False)
    value = html()
    assert 'halo-comment-widget-contract' not in value
    assert 'data-katex-demand="1"' not in value
    assert '/plugins/PluginCommentWidget/assets/' not in value
    assert '/plugins/plugin-katex/assets/' not in value
    assert 'math-inline' in value
    report['checks'].append('disabled plugins: complete HTTP 200, raw content preserved, no plugin resources')
    for name in plugins:
        state(name, True)
    value = html()
    assert 'halo-comment-widget-contract' in value and 'data-katex-demand="1"' in value
    report['checks'].append('re-enabled plugins restore both resource contracts')
    activate('theme-earth')
    value = html()
    assert 'halo-comment-widget-contract' not in value
    assert 'modulepreload' in value and '/plugins/PluginCommentWidget/assets/static/comment-widget.js' in value
    assert '/plugins/PluginCommentWidget/assets/static/index.css' in value
    report['checks'].append('Earth theme receives default CommentWidget global resources without theme opt-in')
    activate(theme)
    value = html()
    assert 'halo-comment-widget-contract' in value
    assert 'rel="modulepreload" href="/plugins/PluginCommentWidget/' not in value
    report['checks'].append('returning to candidate theme restores managed comment resources')
    report['result'] = 'passed'
finally:
    errors = []
    try:
        activate(theme)
    except Exception as error:
        errors.append('theme restoration: ' + type(error).__name__)
    for name, enabled in original.items():
        try:
            state(name, enabled)
        except Exception as error:
            errors.append(name + ' restoration: ' + type(error).__name__)
    try:
        restored_theme = json.loads(client.api('/api/v1alpha1/configmaps/system')['data']['theme'])['active']
        report['restored'] = restored_theme == theme and all(client.api('/apis/plugin.halo.run/v1alpha1/plugins/' + name)['spec']['enabled'] == enabled for name, enabled in original.items())
    except Exception as error:
        errors.append('restoration verification: ' + type(error).__name__)
    if not report['restored'] or errors:
        report['result'] = 'failed'
        report['restorationErrors'] = errors
    lab.write_json(lab.RUNTIME.parent / 'lifecycle-report.json', report)
    if not report['restored'] or errors:
        raise RuntimeError('Lab restoration failed; inspect lifecycle-report.json')
print(json.dumps(report))
