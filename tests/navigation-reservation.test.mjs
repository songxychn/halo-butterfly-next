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

test('navigation reservation excludes fault, combination and performance entry points until restoration',()=>{
 execFileSync('python3',['-B','-c',`
import importlib.util,json,pathlib,tempfile
root=pathlib.Path.cwd()
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
guard=load('reservation_guard',root/'scripts/perf/fault-followup.py')
reservation=load('navigation_reservation',root/'scripts/acceptance/navigation/reservation.py')
with tempfile.TemporaryDirectory(dir=root/'.runtime') as folder:
 base=pathlib.Path(folder);runtime=base/'lab';runtime.mkdir();cpu=base/'cpu';run='a'*20
 locks=reservation.acquire(runtime,run,guard,cpu)
 reservation.validate_delegation(runtime,run,guard,cpu)
 before={str(p):p.read_bytes() for p in base.rglob('*') if p.is_file()}
 for competing in [lambda:guard.acquire_run_locks(runtime,'b'*20,cpu),lambda:(runtime/'acceptance-combinations.lock').open('x'),lambda:cpu.mkdir()]:
  try:competing();raise AssertionError('Competing writer entered navigation reservation')
  except FileExistsError:pass
  assert {str(p):p.read_bytes() for p in base.rglob('*') if p.is_file()}==before
 owner=cpu/'owner.json';original=owner.read_text();value=json.loads(original);value['runId']='b'*20;owner.write_text(json.dumps(value))
 try:reservation.validate_delegation(runtime,run,guard,cpu);raise AssertionError('Forged CPU delegation accepted')
 except RuntimeError as e:assert 'CPU reservation differs' in str(e)
 try:guard.release_run_locks(locks);raise AssertionError('Changed owner was released')
 except RuntimeError:pass
 assert all(p.exists() for p,_ in locks),'Partial release after ownership mismatch'
 owner.write_text(original);guard.release_run_locks(locks);assert not list(runtime.iterdir()) and not cpu.exists()
 competing=guard.acquire_run_locks(runtime,'b'*20,cpu)
 try:reservation.acquire(runtime,run,guard,cpu);raise AssertionError('Navigation entered existing writer reservation')
 except RuntimeError:pass
 guard.release_run_locks(competing)
 cpu.mkdir();(cpu/'owner.json').write_text('existing performance owner')
 try:reservation.acquire(runtime,run,guard,cpu);raise AssertionError('Navigation entered performance CPU window')
 except FileExistsError:pass
 assert (cpu/'owner.json').read_text()=='existing performance owner' and not list(runtime.iterdir())
`],{stdio:'pipe'});
},15000);
