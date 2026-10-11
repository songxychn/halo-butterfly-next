#!/usr/bin/env python3
"""Synthetic comments only; requires this task's explicitly owned comparison lab."""
import argparse
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import secrets
import time

p = argparse.ArgumentParser()
p.add_argument('--lab-runtime', required=True, type=Path)
p.add_argument('--baseline-package', required=True, type=Path)
p.add_argument('--source-sha', required=True)
p.add_argument('--widget-jar', required=True, type=Path)
a = p.parse_args()
runtime = a.lab_runtime.resolve()
identity = json.loads((runtime / 'lab.json').read_text())
if identity.get('owner') != 'halo-butterfly-next-comparison' or identity.get('schema') != 1:
    raise RuntimeError('Owned comparison lab required')
if (runtime / 'comment-enhancements-fixture.json').exists():
    raise RuntimeError('Fixture already exists; preserve it and use a new lab for a new run')
os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(identity['ports']['halo']), HEXO_PORT=str(identity['ports']['hexo']))
repo = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lab', repo / 'scripts/lab/lab.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
client = lab.Client()
lab.install(client, a.baseline_package, a.source_sha)
if not (runtime / 'seed.json').exists():
    lab.seed(client, reference=False)
else:
    # A failed fixture preparation may already have enabled the widget. Preserve
    # that state, while still proving the base synthetic content has not drifted.
    lab.validate_content(client, reference=False)
lock = json.loads((repo / 'fixtures/search-comment/versions.json').read_text())
widget = next(item for item in lock['plugins'] if item['name'] == 'PluginCommentWidget')
if hashlib.sha256(a.widget_jar.read_bytes()).hexdigest() != widget['sha256']:
    raise RuntimeError('Official widget JAR differs from the pinned fixture')
plugin_path = '/apis/plugin.halo.run/v1alpha1/plugins/PluginCommentWidget'
console = '/apis/api.console.halo.run/v1alpha1/plugins'
current = client.api(plugin_path)
if current['spec']['version'] != widget['version']:
    boundary = 'comments-' + secrets.token_hex(12)
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="widget.jar"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + a.widget_jar.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
    client.api(console + '/PluginCommentWidget/upgrade', 'POST', body, 'multipart/form-data; boundary=' + boundary)
current = client.api(plugin_path)
if not current['spec'].get('enabled'):
    client.api(console + '/PluginCommentWidget/plugin-state', 'PUT', {'enable': True, 'async': False})

def content(name, visibility, publish):
    obj = client.api('/apis/api.console.halo.run/v1alpha1/posts', 'POST', {
        'post': {'apiVersion': 'content.halo.run/v1alpha1', 'kind': 'Post', 'metadata': {'name': name, 'labels': {'comment-enhancements-fixture': 'true'}},
                 'spec': {'title': '合成评论权限样本', 'slug': name, 'owner': client.auth['username'], 'visible': visibility, 'allowComment': True, 'deleted': False, 'pinned': False, 'priority': 0, 'publish': False, 'cover': '', 'publishTime': '2026-08-01T04:00:00Z', 'tags': [], 'categories': [], 'excerpt': {'autoGenerate': True}}},
        'content': {'rawType': 'HTML', 'raw': '<p>合成权限样本</p>', 'content': '<p>合成权限样本</p>'}})
    if publish:
        client.api('/apis/api.console.halo.run/v1alpha1/posts/' + name + '/publish', 'PUT')
    return obj

content('comment-fixture-private', 'PRIVATE', True)
content('comment-fixture-draft', 'PUBLIC', False)
collection = '/apis/content.halo.run/v1alpha1/comments'
defs = [
    ('comment-fixture-old-top', 'Post', 'preview-1', '2020-01-01T00:00:00Z', True, False, True, '<p>很旧的置顶评论</p>'),
    ('comment-fixture-post', 'Post', 'preview-12', '2026-10-10T08:00:00Z', True, False, False, '<p>旧文章上的新评论 <img src="/lab/avatar.svg"><code>code</code><a href="/">链接</a></p>'),
    ('comment-fixture-page', 'SinglePage', 'about-preview', '2026-10-11T08:00:00Z', True, False, False, '<p>单页最新评论 &lt;script&gt;window.commentXss=1&lt;/script&gt; 😀</p>'),
    ('comment-fixture-hidden', 'Post', 'preview-1', '2026-10-11T09:00:00Z', True, True, False, '<p>不应公开的隐藏评论</p>'),
    ('comment-fixture-pending', 'Post', 'preview-1', '2026-10-11T10:00:00Z', False, False, False, '<p>不应公开的待审核评论</p>'),
    ('comment-fixture-private-comment', 'Post', 'comment-fixture-private', '2026-10-11T11:00:00Z', True, False, False, '<p>不应公开的私密文章评论</p>'),
    ('comment-fixture-draft-comment', 'Post', 'comment-fixture-draft', '2026-10-11T12:00:00Z', True, False, False, '<p>不应公开的草稿评论</p>'),
]
for name, kind, subject, date, approved, hidden, top, text in defs:
    client.api(collection, 'POST', {'apiVersion': 'content.halo.run/v1alpha1', 'kind': 'Comment',
        'metadata': {'name': name, 'labels': {'comment-enhancements-fixture': 'true'}},
        'spec': {'subjectRef': {'group': 'content.halo.run', 'version': 'v1alpha1', 'kind': kind, 'name': subject},
                 'owner': {'kind': 'User', 'name': client.auth['username']}, 'raw': text, 'content': text,
                 'approved': approved, 'hidden': hidden, 'top': top, 'priority': 0, 'allowNotification': False, 'creationTime': date}})

system = client.api('/api/v1alpha1/configmaps/system')
system['data']['comment'] = json.dumps({'enable': True, 'systemUserOnly': False, 'requireReviewForNew': True})
client.api('/api/v1alpha1/configmaps/system', 'PUT', system)
config_path = '/apis/api.console.halo.run/v1alpha1/themes/halo-butterfly-next/json-config'
config = client.api(config_path)
config.setdefault('comments', {}).update({'count': True, 'card_post_count': True})
client.api(config_path, 'PUT', config)
for _ in range(60):
    post = client.api('/apis/content.halo.run/v1alpha1/posts/preview-12')
    if post.get('status', {}).get('commentsCount', 0) > 0: break
    time.sleep(.25)
lab.write_json(runtime / 'comment-enhancements-fixture.json', {'owner': 'halo-butterfly-next-comment-enhancements', 'schema': 1,
    'sourceSha': a.source_sha, 'widget': widget, 'comments': [item[0] for item in defs],
    'config': config, 'systemComment': json.loads(system['data']['comment'])})
cookies = [{'name': x.name, 'value': x.value, 'domain': x.domain, 'path': x.path, 'expires': x.expires or -1,
            'httpOnly': x.has_nonstandard_attr('HttpOnly'), 'secure': x.secure, 'sameSite': 'Lax'} for x in client.jar]
lab.write_json(runtime / 'plugin-auth.private.json', {'cookies': cookies, 'csrf': client.csrf}, private=True)
print('Synthetic fixture ready: public/private/draft/pending/hidden and older pinned comments; auth retained only in private runtime')
