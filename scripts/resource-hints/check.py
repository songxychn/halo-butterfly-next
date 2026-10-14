"""Validate selected-origin hints on a task-owned Halo, restoring configuration afterwards."""
import copy, json, subprocess, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lab'))
import lab

def browser(*args):
    p = subprocess.run(['agent-browser', '--session', 'hints-'+str(lab.PORTS['halo']), '--json', *args], capture_output=True, text=True, timeout=60)
    value = json.loads(p.stdout)
    if p.returncode or not value.get('success'): raise RuntimeError(str(value.get('error', p.stderr))[:500])
    return value.get('data', {}).get('result')

def main():
    if not lab.owned_process('halo'): raise RuntimeError('A task-owned running Halo is required')
    marker=json.loads((lab.RUNTIME/'lab.json').read_text())
    if marker != {'schema':1,'ports':lab.PORTS,'owner':'halo-butterfly-next-comparison'}: raise RuntimeError('Lab identity differs')
    client=lab.Client(); route='/apis/api.console.halo.run/v1alpha1/themes/'+lab.THEME+'/json-config'
    original=client.api(route); checks=[]
    profiles=[('local',{},set()),('shared',{'asset_base':'https://resource-hints.invalid/assets'}, {'https://resource-hints.invalid'}),
      ('split',{'asset_base':'https://resource-hints.invalid/assets','option':{'main_css':'https://style-hints.invalid/page.css','fontawesome':'https://font-hints.invalid/all.css','mermaid':'https://disabled-hints.invalid/mermaid.js'}},
       {'https://resource-hints.invalid','https://style-hints.invalid','https://font-hints.invalid'})]
    try:
      for name,cdn,expected in profiles:
        config=copy.deepcopy(original);config['CDN']=cdn;client.api(route,'PUT',config)
        for width,height in [(1440,1000),(390,844)]:
          browser('set','viewport',str(width),str(height))
          for mode in ['light','dark']:
            browser('set','media',mode)
            browser('open',lab.BASE['halo']+'/')
            result=browser('eval',r'''(async()=>{const limit=Date.now()+15000;while(!window.MainApp?.useCommon&&Date.now()<limit)await new Promise(r=>setTimeout(r,100));return {title:document.title,ready:!!window.MainApp?.useCommon,hints:[...document.head.querySelectorAll('link[rel~="preconnect"]')].map(n=>({origin:n.href,cors:n.crossOrigin})),width:innerWidth};})()''')
            result.update(profile=name,mode=mode)
            origins={x['origin'].rstrip('/') for x in result['hints']}
            result['passed']=bool(result['ready'] and origins==expected and len({(x['origin'],x['cors']) for x in result['hints']})==len(result['hints']))
            checks.append(result)
      if not all(x['passed'] for x in checks):raise RuntimeError('One or more hint assertions failed')
    finally:
      client.api(route,'PUT',original)
      restored=client.api(route)==original
      out=lab.RUNTIME.parent/'resource-hints.json'
      out.write_text(json.dumps({'installed':json.loads((lab.RUNTIME/'installed-package.json').read_text()),'checks':checks,'restored':restored},ensure_ascii=False,indent=2)+'\n')
      browser('close')
      print(str(out), 'passed',sum(x['passed'] for x in checks),'/',len(checks),'restored',restored)
      if not restored:raise RuntimeError('Configuration restoration failed')

if __name__=='__main__': main()
