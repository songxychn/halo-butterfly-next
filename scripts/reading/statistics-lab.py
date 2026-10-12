#!/usr/bin/env python3
"""Configure only an owned local comparison lab for reading/sharing checks."""
import argparse
import importlib.util
import json
import os
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('preset', choices=['sharejs', 'native', 'addtoany', 'busuanzi', 'off', 'restore'])
parser.add_argument('--runtime', required=True)
args = parser.parse_args()
runtime = Path(args.runtime).resolve()
identity = json.loads((runtime / 'lab.json').read_text())
if identity.get('owner') != 'halo-butterfly-next-comparison':
    raise SystemExit('An owned comparison lab is required')
os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(identity['ports']['halo']), HEXO_PORT=str(identity['ports']['hexo']))
spec = importlib.util.spec_from_file_location('reading_lab', Path(__file__).resolve().parents[1] / 'lab/lab.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
client = lab.Client()
endpoint = f'/apis/api.console.halo.run/v1alpha1/themes/{lab.THEME}/json-config'
saved = runtime / 'reading-original-config.json'
current = client.api(endpoint)
if not saved.exists():
    lab.write_json(saved, current, private=True)
if args.preset == 'restore':
    client.api(endpoint, 'PUT', json.loads(saved.read_text()))
else:
    current.setdefault('copy', {}).update(enable=args.preset != 'off', copyright={'enable': args.preset != 'off', 'limit_count': 4})
    current.setdefault('translate', {}).update(enable=args.preset != 'off', defaultEncoding=2, translateDelay=25, msgToTraditionalChinese='转繁', msgToSimplifiedChinese='转简')
    current.setdefault('wordcount', {}).update(enable=args.preset != 'off', post_wordcount=True, min2read=True, total_wordcount=args.preset != 'off')
    current.setdefault('busuanzi', {}).update(provider='busuanzi' if args.preset == 'busuanzi' else 'halo', page_pv=args.preset != 'off', site_pv=args.preset != 'off', site_uv=args.preset != 'off')
    current.setdefault('share', {}).update(use='' if args.preset == 'off' else ('native' if args.preset == 'busuanzi' else args.preset), sharejs={'sites':'facebook,x,wechat,weibo,qq'}, addtoany={'item':'facebook,x,email,copy_link'})
    client.api(endpoint, 'PUT', current)
    # Dedicated synthetic public article; never modify fixture/user articles.
    name = 'reading-sharing-fixture'
    path = '/apis/api.console.halo.run/v1alpha1/posts'
    posts = client.api('/apis/content.halo.run/v1alpha1/posts?size=100')['items']
    if not any(post['metadata']['name'] == name for post in posts):
        html = '<h2>阅读分享测试</h2><p id="reading-copy">中文 hello world &#20013; &#x6587; &nbsp; &amp; don\'t!</p><pre><code>简体代码</code></pre><p translate="no">简体原文</p><script type="application/json">{"text":"不计入统计"}</script>'
        post = {'apiVersion':'content.halo.run/v1alpha1','kind':'Post','metadata':{'name':name},'spec':{'title':'阅读 & Share <b>标题</b>', 'slug':name,'owner':client.auth['username'],'visible':'PUBLIC','deleted':False,'publish':False,'pinned':False,'priority':0,'allowComment':False,'excerpt':{'autoGenerate':True},'cover':'','categories':[],'tags':[],'publishTime':'2026-09-01T12:00:00Z'}}
        client.api(path, 'POST', {'post':post,'content':{'content':html,'raw':html,'rawType':'HTML'}})
        client.api(path+'/'+name+'/publish', 'PUT')
print('Applied local reading preset:', args.preset)
