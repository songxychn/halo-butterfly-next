import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('性能长文播种先检查冲突，失败无写请求且重复运行保持幂等',()=>{
 execFileSync('python3',[fileURLToPath(new URL('../scripts/perf/test_station.py',import.meta.url))],{stdio:'pipe'});
});
