/** Read-only Halo rendering with candidate CSS response substitution and local DOM fixtures. */
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve, join, dirname} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import JSZip from 'jszip';
import {validateBaseUrl} from '../browser/support.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
assert(process.env.LAB_RUNTIME,'LAB_RUNTIME required');
assert(process.env.FOOTER_AXE_PATH,'FOOTER_AXE_PATH required');
const lab=resolve(process.env.LAB_RUNTIME);
const base=validateBaseUrl(process.env.BASE_URL,JSON.parse(await readFile(join(lab,'lab.json'),'utf8')));
const installed=JSON.parse(await readFile(join(lab,'installed-package.json'),'utf8'));
const runtime=resolve(process.env.BROWSER_RUNTIME||join(root,'.runtime/browser-matrix'));
const output=resolve(process.argv[2]||join(root,'.evidence/footer/run-'+Date.now()));
await mkdir(dirname(output),{recursive:true});await mkdir(output);
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const bytes=await readFile(join(root,`dist/halo-butterfly-next-${pkg.version}.zip`));
const zip=await JSZip.loadAsync(bytes);
const candidateCss=await zip.file('templates/assets/css/index.min.css').async('string');
const axeSource=await readFile(process.env.FOOTER_AXE_PATH,'utf8');
process.env.PLAYWRIGHT_BROWSERS_PATH=join(runtime,'browsers');
process.env.PLAYWRIGHT_SKIP_BROWSER_GC='1';
const temp=join(root,'.runtime/footer/tmp');await mkdir(temp,{recursive:true});
Object.assign(process.env,{TMPDIR:temp,TMP:temp,TEMP:temp});
const {chromium}=await import(pathToFileURL(join(runtime,'deps/node_modules/playwright/index.mjs')));
const browser=await chromium.launch({headless:true,channel:'chromium'});
const hash=data=>createHash('sha256').update(data).digest('hex');
const report={sourceSha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTreeClean:!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),packageSha256:hash(bytes),cssSha256:hash(candidateCss),runnerSha256:hash(await readFile(fileURLToPath(import.meta.url))),installed,checks:[],limitations:['Read-only real Halo HTML; candidate index CSS substituted in browser responses, not installed.','White background image, mask and nav variants are browser-only DOM fixtures; no server settings changed.','Headless Chromium viewport, not real Safari/phone hardware.']};
try{
  for(const width of [1440,390])for(const mode of ['light','dark'])for(const background of ['solid','image-mask','image-no-mask'])for(const nav of [false,true]){
    const context=await browser.newContext({viewport:{width,height:1000}});
    const page=await context.newPage();let replaced=0;
    await page.route('**/*',route=>{
      const u=new URL(route.request().url());
      if(u.origin!==base)return route.abort();
      if(u.pathname.endsWith('/assets/css/index.min.css')){replaced++;return route.fulfill({status:200,contentType:'text/css',body:candidateCss})}
      return route.continue();
    });
    const response=await page.goto(base);assert.equal(response.status(),200);assert.equal(replaced,1);
    await page.evaluate(({mode,background,nav})=>{
      document.documentElement.dataset.colorScheme=mode;
      const footer=document.querySelector('.footer');
      footer.classList.toggle('footer--bg',background!=='solid');
      footer.classList.toggle('footer--mask',background==='image-mask');
      footer.style.backgroundImage=background==='solid'?'none':`url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="white"/></svg>')}")`;
      footer.querySelector('.footer-flex')?.remove();
      footer.querySelector('.footer-other').classList.toggle('footer-other--nav',nav);
      if(nav){const links=document.createElement('div');links.className='footer-flex';const a=document.createElement('a');a.className='footer-flex-item';a.href='/';a.textContent='合成页脚导航';links.append(a);footer.prepend(links)}
      for(const [cls,text] of [['footer_custom_text','合成自定义页脚文本'],['icp','合成备案链接'],['police','合成公安备案链接']]){
        footer.querySelector('.'+cls)?.remove();const el=document.createElement('div');el.className=cls;
        if(cls==='footer_custom_text')el.textContent=text;else{const a=document.createElement('a');a.href='/';a.textContent=text;el.append(a)}
        footer.querySelector('.footer-other').append(el);
      }
    },{mode,background,nav});
    await page.locator('.footer').scrollIntoViewIfNeeded();
    await page.addScriptTag({content:axeSource});
    const label=`${width}-${mode}-${background}-${nav?'nav':'no-nav'}`;
    const links=page.locator('.footer a');const count=await links.count();assert(count>=4);
    for(const state of ['normal','hover','focus']){
      // Every footer link is checked in its real state, not only the brand links.
      for(let index=0;index<(state==='normal'?1:count);index++){
        const link=links.nth(index);
        if(state==='normal'){await page.mouse.move(1,1);await page.evaluate(()=>document.activeElement.blur())}
        if(state==='hover')await link.hover();
        if(state==='focus'){
          await page.mouse.move(1,1);await link.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
          assert(await link.evaluate(e=>document.activeElement===e&&e.matches(':focus-visible')));
        }
        await page.waitForTimeout(350);
        assert(await link.evaluate(e=>getComputedStyle(e).textDecorationLine.includes('underline')));
        if(state==='focus')assert(await link.evaluate(e=>getComputedStyle(e).outlineStyle==='solid'&&parseFloat(getComputedStyle(e).outlineWidth)>=2));
        const data=await page.evaluate(async()=>{
          const f=document.querySelector('.footer');
          const painted=e=>{const s=getComputedStyle(e);return{selector:e.className||e.tagName,color:s.color,background:s.backgroundColor,opacity:s.opacity,filter:s.filter,mixBlendMode:s.mixBlendMode,zIndex:s.zIndex,position:s.position}};
          const nodes=[...f.querySelectorAll('.copyright,.framework-info>span,.framework-info>a,.footer_custom_text,.footer-flex-item,.icp a,.police a')].map(e=>{
            const ancestors=[];for(let p=e;p&&f.contains(p);p=p.parentElement)ancestors.push(painted(p));
            return{...painted(e),text:e.textContent,outline:getComputedStyle(e).outlineStyle,underline:getComputedStyle(e).textDecorationLine,ancestors};
          });
          return{nodes,footer:{background:getComputedStyle(f).backgroundColor,mask:getComputedStyle(f,'::before').backgroundColor,width:f.clientWidth,scrollWidth:f.scrollWidth},axe:await window.axe.run('.footer',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})};
        });
        assert(data.footer.scrollWidth<=data.footer.width+1,'Footer overflows horizontally');
        assert.equal(data.footer.background,'rgb(73, 177, 245)');
        assert(data.nodes.every(n=>n.color===(background==='solid'?'rgb(16, 42, 67)':'rgb(255, 255, 255)')));
        assert.deepEqual(data.axe.violations.map(v=>v.id),[]);
        const name=`${label}-${state}-${index}`;await writeFile(join(output,name+'.json'),JSON.stringify(data,null,2));
        const result=data.axe.incomplete.length?'needs-manual-review':'passed';
        if(data.axe.incomplete.length)process.exitCode=2;
        report.checks.push({name,result,incomplete:data.axe.incomplete.length});
      }
    }
    await page.locator('.footer').screenshot({path:join(output,label+'.png')});
    await context.close();console.log(label,'done');
  }
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error)}finally{await browser.close();report.result=process.exitCode===1?'failed':process.exitCode===2?'needs-manual-review':'passed';await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(report.result,report.checks.length)}
