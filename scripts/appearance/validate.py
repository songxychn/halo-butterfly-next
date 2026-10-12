#!/usr/bin/env python3
"""Limited configuration checks against a caller-selected, owned synthetic Halo lab."""
import copy, json, subprocess, sys, time, zipfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'lab'))
import lab
CONFIG='/apis/api.console.halo.run/v1alpha1/themes/'+lab.THEME+'/json-config'
POST='/apis/content.halo.run/v1alpha1/posts/preview-1'
SESSION='appearance-'+str(lab.PORTS['halo'])
OUT=lab.RUNTIME.parent/'validation'

def browser(*args):
    result=subprocess.run(['agent-browser','--session',SESSION,'--json',*args],capture_output=True,text=True,timeout=45)
    if result.returncode: raise RuntimeError('Browser command failed: '+args[0])
    value=json.loads(result.stdout)
    if not value.get('success'): raise RuntimeError(str(value.get('error'))[:300])
    return value.get('data',{}).get('result')

SCRIPT=r'''async()=>{
 await document.fonts.ready;
 const deadline=Date.now()+5000;
 while(Date.now()<deadline && !window.MainApp?.useCommon) await new Promise(r=>setTimeout(r,50));
 await new Promise(r=>setTimeout(r,350));
 const style=(el,p)=>el?getComputedStyle(el).getPropertyValue(p):null;
 const root=document.documentElement, author=document.querySelector('.aside-user'),article=document.querySelector('.render');
 return {title:document.title,scheme:root.dataset.colorScheme,classes:root.className,font:style(document.body,'font-size'),family:style(document.body,'font-family'),theme:style(root,'--theme').trim(),
  desc:author?.querySelector('.desc')?.textContent,button:!!author?.querySelector('a.button'),buttonIcon:author?.querySelector('a.button i')?.className,
  cards:[...document.querySelectorAll('.main > .aside > .card')].map(e=>({id:e.id,name:e.querySelector('.name')?.textContent,position:e.dataset.cardPosition})),
  customText:document.querySelector('.aside-custom')?.textContent,tagColors:[...document.querySelectorAll('.aside-tags [data-aside-tags] a')].map(e=>({color:style(e,'color'),size:style(e,'font-size')})),
  chart:!!document.querySelector('.content > .chart'),categoryLinks:document.querySelectorAll('.content .category-list a').length,
  cloudColors:[...document.querySelectorAll('.tags .equinox a')].map(e=>style(e,'color')),
  align:style(article,'text-align'),headingIcon:article?.querySelector('h2')?getComputedStyle(article.querySelector('h2'),'::before').content:null,
  hr:article?.querySelector('hr')?getComputedStyle(article.querySelector('hr'),'::before').display:null,
  codeSize:style(article?.querySelector('code'),'font-size'),meta:document.querySelector('meta[name="theme-color"]')?.content,
  colors:[...document.querySelectorAll('.cover-color')].map(e=>({color:style(e,'background-color'),parent:e.parentElement.className})),
  covers:[...document.querySelectorAll('.essay .cover img,.aside-recent-post .thumbnail img,.archives .cover img')].map(e=>e.getAttribute('src')),
  logos:[...document.querySelectorAll('.links img.logo')].map(e=>({src:e.getAttribute('src'),failed:e.classList.contains('image-failed'),attempt:e.dataset.fallbackTried,width:e.naturalWidth})),
  effects:!!document.getElementById('appearance-effects'),canvas:document.querySelectorAll('[data-appearance-effect]').length,
  effectLabels:[...document.querySelectorAll('.appearance-click')].map(e=>e.textContent),width:innerWidth,titleFont:!!document.getElementById('appearance-title-font'),
  inputCheck:window.appearanceInputCheck || null,
  overflow:root.scrollWidth>innerWidth,loading:document.body.classList.contains('loading'),ready:!!window.MainApp?.useCommon};
}'''

def main():
    client=lab.Client()
    if not lab.owned_process('halo'): raise RuntimeError('Owned running Halo required')
    installed=json.loads((lab.RUNTIME/'installed-package.json').read_text())
    package=lab.REPO/'dist'/installed['name']
    if lab.digest(package)!=installed['sha256']: raise RuntimeError('Package differs from installed identity')
    installed_files=0
    with zipfile.ZipFile(package) as archive:
        for entry in archive.infolist():
            if entry.is_dir(): continue
            target=lab.RUNTIME/'halo/data/themes'/lab.THEME/entry.filename
            if not target.is_file() or target.read_bytes()!=archive.read(entry): raise RuntimeError('Installed file mismatch: '+entry.filename)
            installed_files+=1
    plugins=client.api('/apis/plugin.halo.run/v1alpha1/plugins?size=100')['items']
    plugin_state=[{'name':p['metadata']['name'],'version':p['spec']['version'],'enabled':p['spec'].get('enabled'),'phase':p.get('status',{}).get('phase')} for p in plugins]
    links=next((p for p in plugin_state if p['name']=='PluginLinks'),None)
    links_lock=json.loads((lab.REPO/'fixtures/plugins/versions.json').read_text())['plugins'][0]
    links_jar=lab.RUNTIME/'halo/data/plugins/PluginLinks-2.3.0.jar'
    if not links or not links['enabled'] or links['phase']!='STARTED' or links['version']!='2.3.0' or lab.digest(links_jar)!=links_lock['sha256']: raise RuntimeError('Locked PluginLinks 2.3.0 must be started')
    OUT.mkdir(parents=True,exist_ok=True)
    originals={path:client.api(path) for path in [CONFIG,POST]}
    lab.write_json(OUT/'originals.json',originals,private=True)
    results=[]
    font_asset=lab.RUNTIME/'halo/data/attachments/lab/appearance-font.css'
    font_original=font_asset.read_bytes() if font_asset.exists() else None
    font_asset.parent.mkdir(parents=True,exist_ok=True)
    font_asset.write_text('/* Synthetic same-origin font stylesheet; no remote font dependency. */\n')
    def config(groups):
        value=copy.deepcopy(originals[CONFIG])
        for group,fields in groups.items(): value.setdefault(group,{}).update(fields)
        client.api(CONFIG,'PUT',value)
    def cover(value):
        for attempt in range(4):
            post=client.api(POST);post['spec']['cover']=value
            try: client.api(POST,'PUT',post);return
            except lab.ApiError as error:
                if error.status!=409 or attempt==3: raise
                time.sleep(.1*2**attempt)
    def check(name,route,assertion,groups=None,screenshot=False,action=None):
        config(groups or {})
        for width,height in [(1440,1000),(390,844)]:
            browser('set','viewport',str(width),str(height))
            for mode in ['light','dark']:
                entry={'name':name,'route':route,'width':width,'mode':mode}
                try:
                    browser('eval','localStorage.setItem("halo-butterfly-next.color-scheme",'+json.dumps(mode)+')')
                    browser('open',lab.BASE['halo']+route)
                    browser('eval','document.querySelector("#Butterfly > .main")?.scrollIntoView({behavior:"instant",block:"start"})')
                    if action: action()
                    actual=browser('eval','('+SCRIPT+')()')
                    entry['actual']=actual
                    assert actual['ready'] and not actual['loading'] and actual['scheme']==mode,actual
                    assert not actual['overflow'],'Horizontal overflow'
                    assert assertion(actual,mode),actual
                    entry['status']='passed'
                    if screenshot: browser('screenshot',str(OUT/(name+'-'+str(width)+'-'+mode+'.png')))
                except Exception as error:
                    entry['status']='failed';entry['error']=str(error)[:1500]
                results.append(entry)
                lab.write_json(OUT/'progress.json',results)
                print(name,width,mode,entry['status'],flush=True)
    try:
        browser('open',lab.BASE['halo'])
        check('legacy-defaults','/',lambda a,m:a['font']=='14px' and a['button'] and not a['effects'],screenshot=True)
        cards=[{'position':'top','name':'自定义 <b>标题</b>','id_name':'appearance-top','class_name':'wide-card','html':'<p>合成自定义内容</p>','order':2},{'position':'bottom','name':'底部卡片','id_name':'appearance-bottom','html':'<p>底部内容</p>','order':1}]
        check('author-and-custom','/',lambda a,m:a['desc']=='配置作者描述' and not a['button'] and a['cards'][0]['id']=='appearance-top' and a['cards'][-1]['id']=='appearance-bottom',{'aside':{'card_author':{'enable':True,'description':'配置作者描述','button':{'enable':False}},'custom_cards':cards}},True)
        check('article-custom','/archives/preview-1/',lambda a,m:a['cards'][0]['id']=='appearance-top' and a['cards'][-1]['id']=='appearance-bottom',{'aside':{'custom_cards':cards}})
        check('aside-disabled','/',lambda a,m:len(a['cards'])==0,{'aside':{'enable':False,'custom_cards':cards}})
        check('author-icon','/',lambda a,m:a['buttonIcon']=='fa-brands fa-github',{'aside':{'card_author':{'enable':True,'button':{'enable':True,'icon':'fa-brands fa-github'}}}})
        check('aside-colors','/',lambda a,m:len(a['tagColors'])>0 and a['tagColors'][0]['color']==('rgb(18, 52, 86)' if m=='light' else 'rgb(171, 205, 239)'),{'aside':{'card_tags':{'limit':0,'color':True,'orderby':'name','order':1,'custom_colors':[{'light':'#123456','dark':'#abcdef'}]}}})
        check('category-list','/categories/',lambda a,m:not a['chart'] and a['categoryLinks']>0,{'appearance':{'category_ui':'list'}})
        check('tag-cloud','/tags/',lambda a,m:not a['chart'] and len(a['cloudColors'])>0 and a['cloudColors'][0]==('rgb(18, 52, 86)' if m=='light' else 'rgb(171, 205, 239)'),{'appearance':{'tag_ui':'cloud','tag_custom_colors':[{'light':'#123456','dark':'#abcdef'}]}})
        appearance={'font':{'global_font_size':'18px','font_family':'serif','code_font_family':'monospace','code_font_size':'17px'},'theme_color':{'enable':True,'main':'#123456','meta_theme_color_light':'#123456','meta_theme_color_dark':'#abcdef'},'beautify':{'enable':True,'field':'post','title_prefix_icon':'\\f0c1','title_prefix_icon_color':'#234567'},'text_align_justify':True,'hr_icon':{'enable':False},'avatar_effect':False,'enter_transitions':True,'blog_title_font':{'font_link':'/lab/appearance-font.css','font_family':'serif'}}
        check('appearance-post','/archives/preview-1/',lambda a,m:a['font']=='18px' and a['theme']=='#123456' and a['align']=='justify' and a['codeSize']=='17px' and a['meta']==('#123456' if m=='light' else '#abcdef') and a['titleFont'] and 'appearance-avatar' not in a['classes'] and 'appearance-beautify-post' in a['classes'],{'appearance':appearance},True)
        check('appearance-clear','/archives/preview-1/',lambda a,m:a['font']=='14px' and 'appearance-enter' not in a['classes'] and 'appearance-beautify-post' not in a['classes'])
        cover('');
        check('cover-candidate-color','/',lambda a,m:any(x['color']=='rgb(18, 52, 86)' for x in a['colors']),{'cover':{'default_cover_list':[{'url':'#123456'}]}},True)
        check('cover-candidate-image','/',lambda a,m:'/lab/cover.svg' in a['covers'],{'cover':{'default_cover_list':[{'url':'/lab/cover.svg'}]}})
        check('cover-empty-candidates','/',lambda a,m:'/lab/cover.svg' not in a['covers'],{'cover':{'default_cover_list':[{'url':''},None]}})
        cover(originals[POST]['spec'].get('cover',''))
        check('link-fallback','/links',lambda a,m:len(a['logos'])>0 and all((x['src'] or '').endswith('/lab/avatar.svg') and x['attempt']=='true' and x['width']>0 for x in a['logos']),{'image':{'flink_error':'/lab/avatar.svg'}})
        check('link-double-failure','/links',lambda a,m:len(a['logos'])>0 and all(x['failed'] and x['src'] is None for x in a['logos']),{'image':{'flink_error':'/lab/missing-fallback.png'}})
        check('effects-enabled','/',lambda a,m:a['effects'] and a['canvas']==1,{'effects':{'canvas_ribbon':{'enable':True,'mobile':True,'size':150,'alpha':.6,'zIndex':1,'click_to_change':True}}},True)
        check('effects-mobile-disabled','/',lambda a,m:a['canvas']==(0 if a['width']<768 else 1),{'effects':{'canvas_fluttering_ribbon':{'enable':True,'mobile':False}}})
        check('effects-nest','/',lambda a,m:a['effects'] and a['canvas']==1,{'effects':{'canvas_nest':{'enable':True,'mobile':True,'count':99,'color':'0,0,255','opacity':.7}}})
        def click_effect():
            browser('eval','new Promise((resolve,reject)=>{const deadline=Date.now()+5000;const ready=()=>{if(!document.querySelector("canvas.appearance-effect")){if(Date.now()>deadline){reject(new Error("Effect did not initialize"));return;}setTimeout(ready,30);return;}const div=document.createElement("div");div.dataset.appearanceTest="true";div.textContent="合成点击区域";div.style.cssText="position:fixed;left:20px;top:200px;width:150px;height:60px;z-index:101;background:white";document.body.append(div);resolve(true);};ready();})')
            browser('click','[data-appearance-test]')
        check('effects-click','/',lambda a,m:a['canvas']==1 and '♥' in a['effectLabels'] and '<b>合成文字</b>' in a['effectLabels'],{'effects':{'fireworks':{'enable':True,'mobile':True},'click_heart':{'enable':True,'mobile':True},'clickShowText':{'enable':True,'mobile':True,'text':[{'value':'<b>合成文字</b>'}],'fontSize':'15px'}}},False,click_effect)
        def power_input():
            browser('eval','window.appearanceInputCheck={text:0,password:0};for(const kind of ["text","password"]){const input=document.createElement("input");input.type=kind;input.dataset.powerTest=kind;input.style.cssText="position:fixed;left:20px;top:"+(kind==="text"?200:250)+"px;z-index:101;width:150px";const animate=input.animate.bind(input);input.animate=(...args)=>{window.appearanceInputCheck[kind]++;return animate(...args);};document.body.append(input);}')
            browser('fill','[data-power-test="text"]','合成输入')
            browser('fill','[data-power-test="password"]','synthetic-password')
        check('effects-power','/',lambda a,m:a['canvas']==1 and a['inputCheck']['text']>0 and a['inputCheck']['password']==0,{'effects':{'activate_power_mode':{'enable':True,'mobile':True,'colorful':True,'shake':True}}},False,power_input)
        browser('set','media','light','reduced-motion')
        check('effects-reduced','/',lambda a,m:not a['effects'] and a['canvas']==0,{'effects':{'canvas_ribbon':{'enable':True,'mobile':True}}})
    finally:
        if font_original is None: font_asset.unlink(missing_ok=True)
        else: font_asset.write_bytes(font_original)
        restore=[]
        for path,original in originals.items():
            try:
                if path==CONFIG: client.api(path,'PUT',original)
                else: cover(original['spec'].get('cover',''))
                restore.append({'path':path,'status':'restored'})
            except Exception as error: restore.append({'path':path,'status':'failed','error':str(error)})
        try: browser('close')
        except Exception: pass
        report={'testedAt':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'installed':installed,'installedFilesMatch':installed_files,'plugins':plugin_state,'linksJarSha256':lab.digest(links_jar),'fixtureSha256':lab.fixture_hash(),'haloVersion':'2.26.1','results':results,'restore':restore,'limitations':['Limited author configuration checks; no complete 1.0 parity, Safari, device, screen-reader or performance acceptance.','Optional Hexo preparation failed before comparison; Halo-only synthetic fixtures used.']}
        lab.write_json(OUT/'report.json',report)
    failures=[x for x in results if x['status']!='passed']
    if failures or any(x['status']!='restored' for x in restore): raise RuntimeError(str(len(failures))+' failed scenarios')
    print('All',len(results),'limited checks passed; original configuration restored')
if __name__=='__main__': main()
