#!/usr/bin/env python3
"""Owned, reversible broken-cover and publication-icon browser acceptance."""
import argparse,copy,json,os,subprocess,sys
from pathlib import Path
REPO=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(REPO/'scripts/lab'))
import lab
p=argparse.ArgumentParser();p.add_argument('--package',required=True);p.add_argument('--source-sha',required=True);p.add_argument('--output',required=True);a=p.parse_args()
if not os.environ.get('LAB_RUNTIME'):raise RuntimeError('Explicit owned LAB_RUNTIME required')
installed=json.loads((lab.RUNTIME/'installed-package.json').read_text())
if installed['sourceCommit']!=a.source_sha or installed['sha256']!=lab.digest(a.package):raise RuntimeError('Installed candidate differs')
out=Path(a.output).resolve();out.relative_to(REPO/'.runtime');out.mkdir(exist_ok=False,parents=True)
client=lab.Client();api=f'/apis/api.console.halo.run/v1alpha1/themes/{lab.THEME}/json-config';saved=client.api(api);results=[]
try:
 for layout in [1,5,6,7]:
  config=copy.deepcopy(saved);config['index']['index_layout']=str(layout);config['cover']['index_enable']=True;config['loading']['img']['err']='/lab/avatar.svg';config.setdefault('pjax',{})['enable']=False;client.api(api,'PUT',config)
  manifest={'installed':installed,'halo':lab.BASE['halo'],'runtime':str(lab.RUNTIME),'layout':layout,'output':str(out)}
  file=out/f'manifest-{layout}.json';file.write_text(json.dumps(manifest))
  subprocess.run(['bun',str(REPO/'scripts/home-layouts/cover-failure.mjs'),str(file)],cwd=REPO,check=False)
  results.extend(json.loads((out/f'report-{layout}.json').read_text()))
finally:
 client.api(api,'PUT',saved)
 if client.api(api)!=saved:raise RuntimeError('Config restore failed')
report={'installed':installed,'observations':len(results),'failed':sum(not r['pass'] for r in results),'configurationRestored':True,'results':results};(out/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='results'}));sys.exit(bool(report['failed']))
