"""Configure only this checkout's owned, seeded PJAX lab; no deployed site access."""
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lab'))
import lab

if json.loads((lab.RUNTIME / 'lab.json').read_text()) != {'schema': 1, 'ports': lab.PORTS, 'owner': 'halo-butterfly-next-comparison'}:
    raise RuntimeError('Owned lab identity required')
if not (lab.RUNTIME / 'comment-enhancements-fixture.json').exists():
    raise RuntimeError('Prepare the pinned official comment fixture first')
client = lab.Client()
route = f'/apis/api.console.halo.run/v1alpha1/themes/{lab.THEME}/json-config'
config = client.api(route)
config['pjax'] = {'enable': True, 'exclude': ''}
config.setdefault('comments', {})['lazyload'] = False
config.setdefault('mermaid', {}).update({'enable': True, 'code_write': True})
config.setdefault('chartjs', {})['enable'] = True
config.setdefault('abcjs', {})['enable'] = True
client.api(route, 'PUT', config)
name = 'pjax-rich-content'
try:
    post = client.api('/apis/content.halo.run/v1alpha1/posts/' + name)
    if post['metadata'].get('labels', {}).get('pjax-fixture') != 'true':
        raise RuntimeError('Refusing to replace an unrelated post')
except lab.ApiError as error:
    if error.status != 404:
        raise
    markup = '''<h2 id="portable-content">通用代码围栏与 HTML</h2>
<pre><code class="language-mermaid">flowchart LR\n A[First] --&gt; B[Second]</code></pre>
<pre><code class="language-chartjs">{"type":"bar","data":{"labels":["A","B"],"datasets":[{"label":"Count","data":[1,2]}]}}</code></pre>
<pre><code class="language-abc">X:1\nT:Fixture\nM:4/4\nL:1/4\nK:C\nC D E F|</code></pre>
<div class="gallery-container"><div class="gallery-items">[{"url":"/lab/avatar.svg","alt":"合成头像"},{"url":"/lab/avatar.svg","alt":"合成头像二"}]</div></div>'''
    spec = {'title': 'PJAX 正文渲染夹具', 'slug': name, 'owner': client.auth['username'], 'visible': 'PUBLIC', 'allowComment': True, 'deleted': False, 'pinned': False, 'priority': 0, 'publish': False, 'cover': '', 'publishTime': '2026-08-01T04:00:00Z', 'tags': [], 'categories': [], 'excerpt': {'autoGenerate': True}}
    client.api('/apis/api.console.halo.run/v1alpha1/posts', 'POST', {'post': {'apiVersion': 'content.halo.run/v1alpha1', 'kind': 'Post', 'metadata': {'name': name, 'labels': {'pjax-fixture': 'true'}}, 'spec': spec}, 'content': {'rawType': 'HTML', 'raw': markup, 'content': markup}})
    client.api('/apis/api.console.halo.run/v1alpha1/posts/' + name + '/publish', 'PUT')
print('Owned PJAX fixture ready: eager comments, three renderers, article gallery')
