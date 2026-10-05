#!/usr/bin/env python3
import json, sys, time, urllib.request
from pathlib import Path
from common import version_key
wanted=json.loads(Path('.runtime/demo-bundle/release.json').read_text())
version_key(sys.argv[1])
for _ in range(90):
    try:
        request=urllib.request.Request('https://butterfly.baizhukui.com/site-assets/demo-version.json?t='+str(time.time_ns()),headers={
            'Cache-Control':'no-cache','Accept':'application/json',
            'User-Agent':'halo-butterfly-next-demo/1.0 (+https://github.com/songxychn/halo-butterfly-next)'})
        with urllib.request.urlopen(request,timeout=15) as response: actual=json.load(response)
        if all(actual.get(k)==wanted[k] for k in ['tag','sourceSha','themeSha256']) and actual.get('ready'):
            Path('.runtime/demo-public.json').write_text(json.dumps(actual,indent=2)+'\n');print('hk public deployment verified');sys.exit(0)
        if version_key(actual['tag'])>version_key(wanted['tag']): raise SystemExit('A newer version is already deployed')
    except (OSError,ValueError,KeyError): pass
    time.sleep(10)
raise SystemExit('Release/image published but hk deployment not confirmed; inspect hk updater status and retry deployment')
