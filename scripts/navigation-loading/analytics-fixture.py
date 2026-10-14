"""Owned Halo fixture: only GA4 manual protocol, synthetic measurement ID."""
from pathlib import Path
import json
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lab'))
import lab
assert json.loads((lab.RUNTIME / 'lab.json').read_text()) == {'schema': 1, 'ports': lab.PORTS, 'owner': 'halo-butterfly-next-comparison'}
assert (lab.RUNTIME / 'seed.json').exists(), 'Owned seeded comparison content required'
client = lab.Client()
plugin = client.api('/apis/plugin.halo.run/v1alpha1/plugins/PluginCommentWidget')
assert plugin['spec']['version'] == '3.3.2' and plugin['status']['phase'] == 'STARTED'
route = f'/apis/api.console.halo.run/v1alpha1/themes/{lab.THEME}/json-config'
config = client.api(route)
config.update(pjax={'enable': True, 'exclude': ''}, analytics={'google_analytics': 'G-TEST123', 'google_analytics_manual_pageviews': True}, chat={'use': 'none'}, google_adsense={'enable': False}, share={'use': 'none'}, busuanzi={'provider': 'halo'}, effects={})
config.setdefault('CDN', {}).setdefault('option', {})['google_analytics'] = ''
client.api(route, 'PUT', config)
print('Owned manual analytics fixture ready; synthetic ID only')
