/** Real author-link accessibility checks on the task-owned synthetic Halo. */
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const base=process.argv[2];
if(base!=='http://127.0.0.1:18095')throw new Error('Pass the isolated author-link Halo URL explicitly.');
const output=resolve(process.argv[3]||'.evidence/aside-a11y/final');mkdirSync(output,{recursive:true});
const session=`aside-a11y-${process.pid}`;
const command=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:45000});
function evaluate(code){const r=JSON.parse(execFileSync('agent-browser',['--session',session,'--json','eval','--stdin'],{input:code,encoding:'utf8',timeout:45000}));if(!r.success)throw new Error(JSON.stringify(r));return r.data.result;}
function settle(){evaluate("(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));return true})()");}
const version=JSON.parse(readFileSync('package.json','utf8')).version;
const artifactPath=`dist/halo-butterfly-next-${version}.zip`;
const provenance={sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceWorktreeDirty:Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()),artifactPath,artifactSha256:createHash('sha256').update(readFileSync(artifactPath)).digest('hex'),session};
const checks=[],states=[];
function check(expression,name){const passed=evaluate(`Boolean(${expression})`);checks.push({name,passed});if(!passed)throw new Error(name);}
function contrast(foreground,background){
 const luminance=value=>{const rgba=value.match(/[\d.]+/g).map(Number);if(rgba.length>3&&rgba[3]!==1)throw new Error('Expected opaque colors');return rgba.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);};
 const a=luminance(foreground),b=luminance(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
try{
 for(const width of [1440,390])for(const mode of ['light','dark']){
  command('open',base+'/');command('set','viewport',String(width),width===1440?'1000':'844');command('wait','--fn',"document.readyState==='complete'");
  if(evaluate('document.documentElement.dataset.colorScheme')!==mode){command('scrollintoview','.footer');command('wait','--fn',"document.querySelector('.side-btn').classList.contains('active')");settle();command('click','.switch-model');command('wait','--fn',`document.documentElement.dataset.colorScheme==='${mode}'`);}
  command('scrollintoview','.aside-user > .button');settle();
  check("document.querySelectorAll('.aside-user > a.button').length===1 && !document.querySelector('.aside-user .button button')",`${width}/${mode}: one native author link`);
  check("(()=>{const a=document.querySelector('.aside-user > .button');return a.getAttribute('href')==='/about-preview/'&&a.target==='_blank'&&a.textContent==='关于对照实验室'})()",`${width}/${mode}: configured text, href and target preserved`);
  for(const state of ['normal','hover','focus']){
   command('mouse','move','0','0');evaluate('document.activeElement.blur()');
   if(state==='hover')command('hover','.aside-user > .button');
   if(state==='focus'){command('focus','.aside-user .data .item:last-child');command('press','Tab');check("document.activeElement.matches('.aside-user > a.button') && document.activeElement.matches(':focus-visible')",`${width}/${mode}: Tab enters author link with keyboard focus`);}
   settle();
   const data=evaluate(`(()=>{const a=document.querySelector('.aside-user > .button'),s=getComputedStyle(a);return {viewport:[innerWidth,innerHeight],mode:document.documentElement.dataset.colorScheme,state:${JSON.stringify(state)},color:s.color,background:s.backgroundColor,filter:s.filter,fontSize:s.fontSize,fontWeight:s.fontWeight,outline:{width:s.outlineWidth,style:s.outlineStyle,color:s.outlineColor,offset:s.outlineOffset},focusVisible:a.matches(':focus-visible'),html:a.outerHTML,browser:navigator.userAgent}})()`);
   data.contrastRatio=contrast(data.color,data.background);if(data.contrastRatio<4.5||data.filter!=='none')throw new Error(`Insufficient or filtered contrast: ${JSON.stringify(data)}`);
   if(state==='focus'&&(Number.parseFloat(data.outline.width)<2||Number.parseFloat(data.outline.offset)<2||data.outline.style==='none'))throw new Error('Missing visible keyboard outline');
   checks.push({name:`${width}/${mode}/${state}: small text contrast >=4.5`,passed:true,ratio:data.contrastRatio});
   const name=`${width}-${mode}-${state}`;
   const audit=JSON.parse(command('a11y','--selector','.aside-user','--tags','wcag2a,wcag2aa','--json'));
   writeFileSync(resolve(output,name+'-a11y.json'),JSON.stringify(audit,null,2));
   if(!audit.success||audit.data.counts.violations!==0||audit.data.counts.incomplete!==0)throw new Error('Author-card axe check unresolved: '+name);
   command('wait','--fn',"Array.from(document.images).filter(i=>{const r=i.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth}).every(i=>i.complete&&i.naturalWidth>0&&(!i.dataset.lazySrc||i.classList.contains('loaded')||i.classList.contains('error')))");
   command('screenshot',resolve(output,name+'.png'));writeFileSync(resolve(output,name+'-state.json'),JSON.stringify(data,null,2));states.push(data);
   if(state==='focus'){command('press','Tab');check("!document.activeElement.closest('.aside-user > .button')",`${width}/${mode}: next Tab leaves the single author-link stop`);command('press','Shift+Tab');check("document.activeElement.matches('.aside-user > a.button')",`${width}/${mode}: reverse Tab returns to the author link`);}
  }
  const before=JSON.parse(command('tab','list','--json')).data.tabs;
  const original=before.find(tab=>tab.active);
  command('press','Enter');
  command('wait','--fn',"document.readyState==='complete' && location.pathname==='/about-preview/'");
  const after=JSON.parse(command('tab','list','--json')).data.tabs;
  const opened=after.filter(tab=>!before.some(old=>old.targetId===tab.targetId));
  if(opened.length!==1||opened[0].url!==base+'/about-preview/'||!after.some(tab=>tab.targetId===original.targetId&&tab.url===base+'/'))throw new Error('Native author-link Enter did not preserve the original tab and open its configured destination');
  checks.push({name:`${width}/${mode}: native Enter opens configured local destination in one new tab`,passed:true,tabs:after});
  command('tab','close',opened[0].tabId);command('tab',original.tabId);
 }
 writeFileSync(resolve(output,'report.json'),JSON.stringify({...provenance,base,testedAt:new Date().toISOString(),result:'passed',checks,states},null,2));
 process.stdout.write(`${checks.length} author-link browser checks passed. Reports: ${output}\n`);
}catch(error){writeFileSync(resolve(output,'report.json'),JSON.stringify({...provenance,base,testedAt:new Date().toISOString(),result:'failed',checks,states,error:String(error)},null,2));throw error;}finally{command('close');}
