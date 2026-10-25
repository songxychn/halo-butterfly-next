#!/usr/bin/env python3
"""Reserve an owned lab, temporarily disable plugins, run core history, restore."""
import argparse, importlib.util, json, os, secrets, subprocess, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--runtime', type=Path, required=True)
    p.add_argument('--package', type=Path, required=True)
    p.add_argument('--source-sha', required=True)
    p.add_argument('--profile', choices=['history-matrix','history-webkit-followup'], default='history-matrix')
    p.add_argument('--allow-synthetic-writes', choices=['yes'], required=True)
    a = p.parse_args(); runtime = a.runtime.resolve(strict=True)
    assert runtime.is_relative_to(ROOT / '.runtime')
    marker = json.loads((runtime / 'lab.json').read_text())
    assert marker['owner'] == 'halo-butterfly-next-comparison' and marker['schema'] == 1
    os.environ.update(LAB_RUNTIME=str(runtime), HALO_PORT=str(marker['ports']['halo']), HEXO_PORT=str(marker['ports']['hexo']))
    lab = load('nav_coordinate_lab', ROOT / 'scripts/lab/lab.py')
    guard = load('nav_coordinate_guard', ROOT / 'scripts/perf/fault-followup.py')
    assert lab.owned_process('halo') and not list(runtime.glob('*.lock'))
    jar = runtime / 'halo' / lab.HALO_JAR_NAME
    assert json.loads((runtime / 'halo-process.json').read_text())['identity'] == str(jar)
    assert lab.digest(jar) == lab.VERSIONS['halo']['sha256']
    assert json.loads((runtime / 'installed-package.json').read_text())['sha256'] == lab.digest(a.package)
    run = secrets.token_hex(10); output = runtime / 'navigation-coordination' / run
    output.mkdir(parents=True); lock = runtime / 'navigation-coordinator.lock'
    with lock.open('x') as f: f.write(run)
    report = {'runId':run, 'before':None, 'errors':[], 'restored':False}
    endpoint = '/apis/plugin.halo.run/v1alpha1/plugins'
    console = '/apis/api.console.halo.run/v1alpha1/plugins/'
    c = None; before = None
    def save(): lab.write_json(output / 'report.json', report)
    def inventory():
        d = c.api(endpoint + '?size=100'); assert not d.get('hasNext') and d.get('total',len(d['items'])) <= 100
        return d['items']
    def snapshot():
        rows=[]
        for x in sorted(inventory(),key=lambda x:x['metadata']['name']):
            cfg=None
            if x['spec'].get('configMapName'):
                try:cfg=c.api('/api/v1alpha1/configmaps/'+x['spec']['configMapName']).get('data',{})
                except lab.ApiError as e:
                    if e.status!=404:raise
            rows.append({'name':x['metadata']['name'],'created':x['metadata'].get('creationTimestamp'),'spec':x['spec'],'phase':x['status']['phase'],'configSha256':guard.sha(cfg)})
        return rows
    def change(row, enable):
        x=c.api(endpoint+'/'+row['name'])
        assert x['metadata'].get('creationTimestamp')==row['created']
        assert {k:v for k,v in x['spec'].items() if k!='enabled'}=={k:v for k,v in row['spec'].items() if k!='enabled'}
        if x['spec'].get('enabled')!=enable:c.api(console+row['name']+'/plugin-state','PUT',{'enable':enable,'async':False})
    save()
    try:
        c=lab.Client();guard.wait_for_stable_plugins(inventory);before=snapshot()
        lab.write_json(output/'before.private.json',before,private=True)
        report['before']={'sha256':guard.sha(before),'plugins':len(before),'enabled':sum(bool(x['spec'].get('enabled')) for x in before)};save()
        for row in before:change(row,False)
        guard.wait_for_stable_plugins(inventory)
        report['exitCode']=subprocess.call([sys.executable,str(Path(__file__).with_name('run.py')),'--runtime',str(runtime),'--package',str(a.package.resolve()),'--package-sha256',lab.digest(a.package),'--source-sha',a.source_sha,'--profile',a.profile,'--coordinator-run-id',run,'--allow-synthetic-writes','yes'],cwd=ROOT)
    except Exception as e:report['errors'].append(str(e))
    finally:
        if before:
            try:
                assert not (runtime/'acceptance-navigations.lock').exists(), 'Inner run needs recovery; keep coordinator reservation'
                for row in before:change(row,bool(row['spec'].get('enabled')))
                guard.wait_for_stable_plugins(inventory);after=snapshot()
                assert after==before, 'Plugin restoration differs'
                report['restored']=True;report['afterSha256']=guard.sha(after)
            except Exception as e:report['errors'].append('restore: '+str(e))
        if before is None or report['restored']:
            assert lock.read_text()==run;lock.unlink();report['lockReleased']=True
        save()
    print(json.dumps({'output':str(output),**report}))
    return 0 if report.get('exitCode')==0 and report['restored'] and not report['errors'] else 1
if __name__=='__main__':raise SystemExit(main())
