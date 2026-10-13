"""Background CSS and footer inheritance against a task-owned real Halo."""
import copy, json, subprocess, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lab'))
import lab

def browser(*args):
    p=subprocess.run(['agent-browser','--session','backgrounds-'+str(lab.PORTS['halo']),'--json',*args],capture_output=True,text=True,timeout=60)
    result=json.loads(p.stdout)
    if p.returncode or not result.get('success'):raise RuntimeError(str(result.get('error'))[:300])
    return result.get('data',{}).get('result')

def main():
    if not lab.owned_process('halo'):raise RuntimeError('Task-owned Halo is required')
    client=lab.Client();route='/apis/api.console.halo.run/v1alpha1/themes/'+lab.THEME+'/json-config'
    original=client.api(route);checks=[]
    scenarios=[('color','#29466b','true','rgb(41, 70, 107)','none'),
        ('gradient','linear-gradient(135deg, rgb(41, 70, 107), rgb(102, 136, 170))','true','rgba(0, 0, 0, 0)','linear-gradient'),
        ('footer-own','#29466b','#102030','rgb(41, 70, 107)','none'),
        ('footer-off','#29466b','false','rgb(41, 70, 107)','none')]
    try:
      for name,above,footer,color,image in scenarios:
        config=copy.deepcopy(original);config.setdefault('index',{})['above_background']=above;config['index']['enable_above']=True
        config.setdefault('footer',{})['footer_img']=footer;config.setdefault('mask',{})['footer']=True
        client.api(route,'PUT',config)
        for width,height in [(1440,1000),(390,844)]:
          browser('set','viewport',str(width),str(height))
          for mode in ['light','dark']:
            browser('set','media',mode);browser('open',lab.BASE['halo']+'/')
            result=browser('eval',r'''(async()=>{const end=Date.now()+10000;while(!MainApp.useCommon&&Date.now()<end)await new Promise(r=>setTimeout(r,100));const a=document.querySelector('.above'),f=document.querySelector('footer.footer');return {ready:!!MainApp.useCommon,topColor:getComputedStyle(a).backgroundColor,topImage:getComputedStyle(a).backgroundImage,footerColor:getComputedStyle(f).backgroundColor,footerImage:getComputedStyle(f).backgroundImage,footerOn:f.classList.contains('footer--bg'),mask:f.classList.contains('footer--mask'),preloads:[...document.querySelectorAll('link[as="image"]')].map(x=>x.href),width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth};})()''')
            passed=result['ready'] and result['topColor']==color and image in result['topImage'] and not result['preloads'] and not result['overflow']
            if footer=='true':passed=passed and result['footerColor']==result['topColor'] and result['footerImage']==result['topImage'] and result['mask']
            elif footer=='false':passed=passed and not result['footerOn'] and not result['mask']
            else:passed=passed and result['footerColor']=='rgb(16, 32, 48)' and result['mask']
            result.update(name=name,mode=mode,passed=bool(passed));checks.append(result)
      if not all(x['passed'] for x in checks):raise RuntimeError('Background assertions failed')
    finally:
      client.api(route,'PUT',original);restored=client.api(route)==original
      report={'installed':json.loads((lab.RUNTIME/'installed-package.json').read_text()),'checks':checks,'restored':restored,'limitations':['Headless Chromium viewports, not physical devices or Safari.']}
      output=lab.RUNTIME.parent/'backgrounds.json';output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
      browser('close');print(str(output),'passed',sum(x['passed'] for x in checks),'/',len(checks),'restored',restored)
      if not restored:raise RuntimeError('Configuration restore failed')
if __name__=='__main__':main()
