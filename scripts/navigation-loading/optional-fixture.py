"""Configure owned fixture for page-scoped optional integrations."""
from pathlib import Path
import json
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lab'))
import lab
assert json.loads((lab.RUNTIME / 'lab.json').read_text()) == {'schema': 1, 'ports': lab.PORTS, 'owner': 'halo-butterfly-next-comparison'}
assert (lab.RUNTIME / 'comment-enhancements-fixture.json').exists()
client = lab.Client()
route = f'/apis/api.console.halo.run/v1alpha1/themes/{lab.THEME}/json-config'
config = client.api(route)
config['pjax'] = {'enable': True, 'exclude': ''}
config['share'] = {'use': 'sharejs', 'sharejs': {'sites': 'x,wechat,qq,facebook'}}
config['busuanzi'] = {'provider': 'busuanzi', 'site_pv': True, 'site_uv': True, 'page_pv': True}
config.setdefault('effects', {})['canvas_nest'] = {'enable': True, 'mobile': True, 'count': 12, 'color': '20,40,80', 'opacity': .7, 'zIndex': -1}
client.api(route, 'PUT', config)
print('Owned optional PJAX fixture ready')
