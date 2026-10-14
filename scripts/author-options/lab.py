"""Apply explicit, reversible D06 profiles only to an owned local comparison Halo."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lab'))
import lab

client = lab.Client()
mode = sys.argv[1] if len(sys.argv) > 1 else 'configured'
assert mode in ('configured', 'inherit', 'unsafe')
path = f'/apis/api.console.halo.run/v1alpha1/themes/{lab.THEME}/json-config'
config = client.api(path)
config['base']['date_format'] = 'yyyy/MM/dd HH:mm' if mode != 'unsafe' else 'XXXXXX'
config['aside']['enable'] = mode == 'inherit'
config['render']['code_shrink'] = 'expanded'
config['archives'].update({'title': 'Author archives' if mode == 'unsafe' else '', 'year': False, 'month': True})
config['tags']['cloud'] = {'orderby': 'name', 'order': -1, 'amount': 2, 'min_font': 1, 'max_font': 2, 'unit': 'rem'}
client.api(path, 'PUT', config)
for collection, name in [('posts','preview-1'),('singlepages','about-preview')]:
    path = f'/apis/content.halo.run/v1alpha1/{collection}/{name}'
    obj = client.api(path)
    annotations = obj['metadata'].setdefault('annotations', {})
    annotations.update({'aside':'true' if mode == 'configured' else ('false' if mode == 'unsafe' else 'inherit'), 'highlight_shrink':'collapsed' if mode == 'configured' else ('disabled' if mode == 'unsafe' else 'inherit')})
    if collection == 'posts':
        annotations.update({'copyright_author':'A <B>', 'copyright_author_href':'/about-preview', 'copyright_url':'https://example.invalid/original%20post', 'copyright_info':'<b>Plain statement</b>', 'copyright_license':'Custom license', 'copyright_license_url':'https://example.invalid/license'})
        if mode == 'unsafe':
            annotations.update({'copyright_author_href':'javascript:alert(1)', 'copyright_url':'//evil.invalid/x', 'copyright_info':'', 'copyright_license_url':'data:text/html,x'})
        if mode == 'inherit':
            for key in list(annotations):
                if key.startswith('copyright_'): annotations.pop(key)
    client.api(path, 'PUT', obj)
# Include empty/native tags to verify amount and sorting on every candidate.
for name, title in [('option-alpha','Alpha'),('option-zulu','Zulu')]:
    client.ensure('/apis/content.halo.run/v1alpha1/tags', {'apiVersion':'content.halo.run/v1alpha1','kind':'Tag','metadata':{'name':name},'spec':{'displayName':title,'slug':name,'color':'#1d4ed8'}})
print('Applied D06 profile:', mode)
