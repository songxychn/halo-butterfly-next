#!/usr/bin/env python3
"""Seed synthetic resource-demand cases only inside this task's owned lab."""
import json
import time
import lab as harness

lab = harness.lab
harness.owned()
if not lab.owned_process('halo'):
    raise RuntimeError('Owned running Halo required')
client = lab.Client()
config_path = '/apis/api.console.halo.run/v1alpha1/themes/' + lab.THEME + '/json-config'
config = client.api(config_path)
config.setdefault('comments', {})['lazyload'] = True
config.setdefault('pjax', {})['enable'] = True
client.api(config_path, 'PUT', config)
system = client.api('/api/v1alpha1/configmaps/system')
comments = json.loads(system['data'].get('comment', '{}'))
comments['enable'] = True
system['data']['comment'] = json.dumps(comments)
client.api('/api/v1alpha1/configmaps/system', 'PUT', system)

links = '<p><a id="to-raw" href="/archives/demand-raw/">原始公式</a> <a id="to-none" href="/archives/demand-none/">无公式</a> <a id="to-mathml" href="/archives/demand-mathml/">MathML</a> <a id="to-page" href="/demand-page/">独立页面</a></p>'
long_body = '<h2>按需资源合成内容</h2>' + ''.join('<p>合成段落 %s：测试首屏不加载评论资源，滚动到评论区域后按需加载。</p>' % i for i in range(100))
mathml = '<span class="katex-inline"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow><annotation encoding="application/x-tex">x+1</annotation></semantics></math></span>'
raw = '<span class="math-inline">x^2+1</span><div class="math-display">\\sum_{i=1}^{n}i</div>'
fixtures = [
    ('posts', 'Post', 'post', 'demand-none', '', True),
    ('posts', 'Post', 'post', 'demand-raw', raw, True),
    ('posts', 'Post', 'post', 'demand-mathml', mathml, True),
    ('posts', 'Post', 'post', 'demand-closed', '', False),
    ('singlepages', 'SinglePage', 'page', 'demand-page', raw, True),
]
for plural, kind, key, name, formula, allow in fixtures:
    resource = '/apis/content.halo.run/v1alpha1/' + plural + '/' + name
    try:
        old = client.api(resource)
        if old['metadata'].get('labels', {}).get('platform-demand-fixture') != 'true':
            raise RuntimeError('Refusing to replace unrelated content')
        continue
    except lab.ApiError as error:
        if error.status != 404:
            raise
    markup = links + formula + long_body + links
    spec = {'title': '按需资源 ' + name, 'slug': name, 'allowComment': allow, 'deleted': False, 'pinned': False, 'priority': 0, 'publish': False, 'visible': 'PUBLIC', 'owner': client.auth['username'], 'excerpt': {'autoGenerate': True}, 'cover': '', 'publishTime': '2026-10-15T00:00:00Z'}
    if plural == 'posts':
        spec.update(tags=[], categories=[])
    console = '/apis/api.console.halo.run/v1alpha1/' + plural
    client.api(console, 'POST', {key: {'apiVersion': 'content.halo.run/v1alpha1', 'kind': kind, 'metadata': {'name': name, 'labels': {'platform-demand-fixture': 'true'}}, 'spec': spec}, 'content': {'rawType': 'HTML', 'raw': markup, 'content': markup}})
    client.api(console + '/' + name + '/publish', 'PUT')

for name, patches in {
    'PluginCommentWidget': {'avatar': {'enable': False}, 'editor': {'enableEmoji': False, 'enableUpload': False}},
    'plugin-katex': {'basic': {'resource_loading': 'on_demand', 'enable_frontend_katex': True, 'inline_selector': '.math-inline', 'display_selector': '.math-display'}},
}.items():
    plugin = client.api('/apis/plugin.halo.run/v1alpha1/plugins/' + name)
    endpoint = '/api/v1alpha1/configmaps/' + plugin['spec']['configMapName']
    value = client.api(endpoint)
    for group, patch in patches.items():
        settings = json.loads(value.get('data', {}).get(group, '{}'))
        settings.update(patch)
        value.setdefault('data', {})[group] = json.dumps(settings)
    client.api(endpoint, 'PUT', value)
# Private authentication only for the isolated acceptance runner, never exported as evidence.
cookies = [{'name': c.name, 'value': c.value, 'domain': c.domain, 'path': c.path, 'expires': c.expires or -1, 'httpOnly': c.has_nonstandard_attr('HttpOnly'), 'secure': c.secure, 'sameSite': 'Lax'} for c in client.jar]
lab.write_json(lab.RUNTIME / 'browser-auth.private.json', {'cookies': cookies, 'csrf': client.csrf}, private=True)
lab.write_json(lab.RUNTIME / 'demand-fixtures.json', {'routes': ['/' + ('archives/' if p == 'posts' else '') + n + '/' for p, k, key, n, f, a in fixtures], 'source': 'synthetic HTML through local Halo API; not editor acceptance', 'haloVersion': lab.VERSIONS['halo']['version']})
print('Resource demand fixtures ready', flush=True)
