// Real Halo configuration precedence probe, always restores the starting settings.
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createRequire} from 'node:module';
import {createServer,request as httpRequest} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {REPO,RUNTIME,browserEnvironment,sha256} from '../browser/support.mjs';
const configClient=spawn('python3',['-u','-c',`import sys,json;sys.path.insert(0,'scripts/body-renderers');import lab
assert json.loads((lab.lab.RUNTIME/'lab.json').read_text()).get('owner')=='halo-butterfly-next-comparison'
assert lab.lab.owned_process('halo')
c=lab.lab.Client();p='/apis/api.console.halo.run/v1alpha1/themes/'+lab.lab.THEME+'/json-config'
for line in sys.stdin:
 try:
  original=c.api(p);next=json.loads(line);c.api(p,'PUT',next) if next is not None else None
  print(json.dumps({'config':original}),flush=True)
 except Exception as e:print(json.dumps({'error':str(e)}),flush=True)
`],{cwd:REPO,stdio:['pipe','pipe','inherit']});
const replies=createInterface({input:configClient.stdout})[Symbol.asyncIterator]();
const config=async value=>{configClient.stdin.write(JSON.stringify(value)+'\n');const reply=await replies.next();if(reply.done)throw new Error('Lab configuration client stopped');const data=JSON.parse(reply.value);if(data.error)throw new Error(data.error);return data.config;};

const proxy=createServer((req,res)=>{if(!['GET','HEAD'].includes(req.method)&&!(req.method==='POST'&&req.url==='/apis/api.halo.run/v1alpha1/trackers/counter')){res.writeHead(405).end();return;}const upstream=httpRequest({hostname:'127.0.0.1',port:18531,path:req.url,method:req.method,agent:false,headers:{...req.headers,host:'127.0.0.1:18531',connection:'close'}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});upstream.on('error',()=>res.writeHead(502).end());req.pipe(upstream);});
await new Promise(resolve=>proxy.listen(18534,'127.0.0.1',resolve));
const original=await config(null), report={sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:REPO,encoding:'utf8'}).trim(),packageSha256:sha256(await readFile(REPO+'/dist/halo-butterfly-next-0.1.0-alpha.4.zip')),transport:'diagnostic upstream Connection: close',results:[]};
const env=browserEnvironment();Object.assign(process.env,env);const pw=createRequire(RUNTIME+'/deps/package.json')('playwright');
// Fresh upstream connections isolate the known native transport boundary.
// This diagnostic is reported separately from native browser acceptance.
try {
 for(const scenario of ['global-off','abc-opt-in','code-write-off']) {
  const next=structuredClone(original);for(const key of ['mermaid','chartjs','abcjs'])next[key]={...next[key],enable:scenario!=='global-off'};
  next.mermaid.code_write=scenario!=='code-write-off';next.abcjs.per_page=scenario!=='abc-opt-in';await config(next);
  for(const engine of ['chromium','firefox','webkit']) {
   const browser=await pw[engine].launch({headless:true,env,...engine==='chromium'?{channel:'chromium'}:{}});
   try { for(const explicit of [false,true]) {
    const context=await browser.newContext({viewport:{width:390,height:844}});

    const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
    const slug=explicit?'body-charts-on':'body-charts';const result={scenario,engine,explicit,status:'running'};report.results.push(result);
    try {await page.goto('http://127.0.0.1:18534/archives/'+slug+'/',{waitUntil:'domcontentloaded'});
     const rendered=scenario==='global-off'?(explicit?6:0):scenario==='abc-opt-in'?(explicit?6:4):5;
     const disabled=scenario==='global-off'&&!explicit?6:scenario==='abc-opt-in'&&!explicit?2:0;
     await page.waitForFunction(({rendered,disabled})=>document.querySelectorAll('[data-render-state=rendered]').length===rendered&&document.querySelectorAll('[data-render-state=disabled]').length===disabled,{rendered,disabled});
     assert.deepEqual(errors,[]);result.status='passed';
    }catch(error){result.status='failed';result.failure=error.message;}
    finally{await context.close();}
   }}finally{await browser.close();}
  }
 }
}finally{proxy.close();await config(original);configClient.stdin.end();await mkdir(REPO+'/.runtime/body-renderers',{recursive:true});await writeFile(REPO+'/.runtime/body-renderers/overrides-report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report.results));if(report.results.some(r=>r.status==='failed'))process.exitCode=1;
