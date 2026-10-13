#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Create an isolated Halo lab for body renderers; never modify an existing site."""
import argparse
import html
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import time

REPO = Path(__file__).resolve().parents[2]
os.environ.setdefault('LAB_RUNTIME', str(REPO / '.runtime/body-renderers/halo-lab'))
os.environ.setdefault('HALO_PORT', '18531')
os.environ.setdefault('HEXO_PORT', '14531')
spec = importlib.util.spec_from_file_location('comparison_lab', REPO / 'scripts/lab/lab.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)


def content():
    mermaid = 'flowchart LR\n  A[开始] --> B[完成]\n  accTitle: 固定测试流程\n  accDescr: 开始连接到完成'
    chart = json.dumps({'type': 'bar', 'data': {'labels': ['甲', '乙'], 'datasets': [{'label': '访问量', 'data': [12, 8], 'backgroundColor': {'light-mode': '#2563eb', 'dark-mode': '#93c5fd'}}, {'label': '阅读量', 'data': [7, 4]}]}, 'options': {'plugins': {'legend': {'display': True}}}}, ensure_ascii=False)
    abc = 'X:1\nT:固定测试乐谱\nM:4/4\nL:1/4\nK:C\nC D E F | G A B c |'
    good = '<h2>图表与乐谱</h2><p>正文保持可读。</p>'
    good += '<div id="fixture-mermaid" class="mermaid-wrap"><pre class="mermaid-src" hidden>' + html.escape(mermaid) + '</pre></div>'
    good += '<div id="fixture-chart" class="chartjs-container" data-width="80%"><pre class="chartjs-src" hidden>' + html.escape(chart) + '</pre><div class="chartjs-desc">合成数据说明</div></div>'
    good += '<div id="fixture-score" class="abc-music-sheet" data-params="{&quot;scale&quot;:0.9}">' + html.escape(abc) + '</div>'
    good += '<pre><code class="language-mermaid">' + html.escape(mermaid) + '</code></pre><pre><code class="language-chartjs">' + html.escape(chart) + '</code></pre><pre><code class="language-abc">' + html.escape(abc) + '</code></pre><pre><code class="language-javascript">const untouched = true;</code></pre>'
    bad = '<h2>错误输入</h2><div class="mermaid-wrap"><pre class="mermaid-src" hidden>graph TD; A[</pre></div><div class="chartjs-container"><pre class="chartjs-src" hidden>{"__proto__":{"polluted":true}}</pre></div><div class="abc-music-sheet">not a score</div>'
    return good, bad


def seed(client):
    good, bad = content()
    lab.write_json(lab.RUNTIME / 'renderer-fixtures.json', {'good': good, 'bad': bad})
    for plural, kind, name, markup, annotations in [
        ('posts', 'Post', 'body-charts', good, {}), ('singlepages', 'SinglePage', 'body-charts-page', good, {}),
        ('posts', 'Post', 'body-charts-off', good, {'mermaid': 'false', 'chartjs': 'false', 'abcjs': 'false'}),
        ('posts', 'Post', 'body-charts-on', good, {'mermaid': 'true', 'chartjs': 'true', 'abcjs': 'true'}),
        ('posts', 'Post', 'body-charts-errors', bad, {}),
    ]:
        key = 'post' if kind == 'Post' else 'page'
        console = '/apis/api.console.halo.run/v1alpha1/' + plural
        obj = {'apiVersion': 'content.halo.run/v1alpha1', 'kind': kind, 'metadata': {'name': name, 'annotations': annotations}, 'spec': {'title': '正文渲染测试 ' + name, 'slug': name, 'template': '', 'pinned': False, 'allowComment': False, 'deleted': False, 'visible': 'PUBLIC', 'priority': 0, 'publish': False, 'owner': client.auth['username'], 'htmlMetas': [], 'excerpt': {'raw': '', 'autoGenerate': True}, 'cover': '', 'publishTime': '2026-10-13T03:00:00Z'}}
        if kind == 'Post': obj['spec'].update({'tags': [], 'categories': []})
        client.api(console, 'POST', {key: obj, 'content': {'content': markup, 'raw': markup, 'rawType': 'HTML'}})
        client.api(console + '/' + name + '/publish', 'PUT')
    configure(client, True)


def configure(client, enabled):
    path = f'/apis/api.console.halo.run/v1alpha1/themes/{lab.THEME}/json-config'
    config = client.api(path)
    config['mermaid'] = {'enable': enabled, 'code_write': True, 'theme': {'light': 'default', 'dark': 'dark'}, 'zoom_pan': True, 'open_in_new_tab': True}
    config['chartjs'] = {'enable': enabled}
    config['abcjs'] = {'enable': enabled, 'per_page': True}
    client.api(path, 'PUT', config)
    time.sleep(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['bootstrap', 'install', 'on', 'off', 'stop'])
    parser.add_argument('--jar', type=Path)
    parser.add_argument('--package', type=Path)
    parser.add_argument('--source-sha')
    args = parser.parse_args()
    if args.command == 'stop':
        pid = lab.owned_process('halo')
        if pid: os.kill(pid, signal.SIGTERM)
        elif lab.listening(lab.PORTS['halo']): raise RuntimeError('Refusing to stop an unowned listener')
        return
    if args.command == 'bootstrap':
        if not args.jar or lab.digest(args.jar) != lab.VERSIONS['halo']['sha256']: raise RuntimeError('Provide the pinned Halo 2.26.1 JAR')
        if lab.RUNTIME.exists() and any(lab.RUNTIME.iterdir()): raise RuntimeError('Bootstrap requires an empty runtime')
        lab.write_json(lab.RUNTIME / 'lab.json', {'schema': 1, 'ports': lab.PORTS, 'owner': 'halo-butterfly-next-comparison'})
        (lab.RUNTIME / 'halo').mkdir(exist_ok=True)
        shutil.copyfile(args.jar, lab.RUNTIME / 'halo/halo-2.26.1.jar')
        shutil.copytree(lab.FIXTURES / 'assets', lab.RUNTIME / 'halo/data/attachments/lab')
        lab.start(halo_only=True)
        client = lab.Client(initialize=True)
        lab.install(client, args.package.resolve(), args.source_sha)
        seed(client)
    else:
        marker = json.loads((lab.RUNTIME / 'lab.json').read_text())
        if marker.get('owner') != 'halo-butterfly-next-comparison' or not lab.owned_process('halo'): raise RuntimeError('Requires the owned, running renderer lab')
        client = lab.Client()
        if args.command == 'install': lab.install(client, args.package.resolve(), args.source_sha)
        else: configure(client, args.command == 'on')
    print('Body renderer lab ready:', lab.BASE['halo'])


if __name__ == '__main__':
    main()
