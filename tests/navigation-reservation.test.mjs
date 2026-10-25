import {test} from 'bun:test';
import {execFileSync} from 'node:child_process';

test('navigation refuses other writers/restoration and forged delegation before creating fixtures',()=>{
 execFileSync('python3',['-B','-c',`
import json,pathlib,subprocess,tempfile
root=pathlib.Path.cwd();runtime_root=root/'.runtime';runtime_root.mkdir(exist_ok=True)
for profile,delegation,extra in [('official-history',None,False),('history-matrix','b'*20,False),('history-matrix','a'*20,True),('official-history','a'*20,False)]:
 with tempfile.TemporaryDirectory(dir=runtime_root) as folder:
  runtime=pathlib.Path(folder)
  (runtime/'lab.json').write_text(json.dumps({'schema':1,'owner':'halo-butterfly-next-comparison','ports':{'halo':18845,'hexo':14845}}))
  (runtime/'navigation-coordinator.lock').write_text('a'*20)
  if extra:(runtime/'acceptance-comments.lock').write_text('another-writer')
  before={p.name:p.read_bytes() for p in runtime.iterdir()}
  command=['python3','-B','scripts/acceptance/navigation/run.py','--runtime',str(runtime),'--package',str(runtime/'missing.zip'),'--source-sha','1'*40,'--profile',profile,'--allow-synthetic-writes','yes']
  if delegation:command+=['--coordinator-run-id',delegation]
  result=subprocess.run(command,cwd=root,capture_output=True,text=True,timeout=10)
  assert result.returncode!=0
  assert any(message in result.stderr for message in ['Another acceptance writer or restoration is active','Coordinator reservation differs','Invalid coordinator delegation']),result.stderr
  assert {p.name:p.read_bytes() for p in runtime.iterdir()}==before,'Reserved runtime was modified'
`],{stdio:'pipe'});
},15000);
