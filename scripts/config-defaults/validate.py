#!/usr/bin/env python3
"""Read-only content checks and reversible settings on an owned synthetic Halo lab."""
import copy, hashlib, json, subprocess, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lab'))
import lab
SESSION = 'config-defaults-' + str(lab.PORTS['halo'])
CONFIG = '/apis/api.console.halo.run/v1alpha1/themes/' + lab.THEME + '/json-config'
OUT = lab.RUNTIME.parent / 'config-defaults-validation'

def browser(*args):
    r = subprocess.run(['agent-browser', '--session', SESSION, '--json', *args], capture_output=True, text=True, timeout=45)
    value = json.loads(r.stdout) if r.stdout.strip() else {}
    if r.returncode or not value.get('success'): raise RuntimeError('Browser failed: ' + args[0] + ' ' + str(value.get('error') or r.stderr)[:300])
    return value.get('data', {}).get('result')

def main():
    client = lab.Client()  # verifies ownership before any settings mutation
    original = client.api(CONFIG)
    OUT.mkdir(parents=True, exist_ok=True)
    lab.write_json(OUT / 'original.json', original, private=True)
    installed = json.loads((lab.RUNTIME / 'installed-package.json').read_text())
    results = []
    def config(**groups):
        value = copy.deepcopy(original)
        for key, group in groups.items(): value.setdefault(key, {}).update(group)
        client.api(CONFIG, 'PUT', value)
        return value
    def page(route):
        browser('open', lab.BASE['halo'] + route)
        browser('wait', '--fn', '!!window.MainApp?.useTheme && !document.body.classList.contains("loading")')
    def check(name, js):
        value = browser('eval', js)
        results.append({'name': name, 'result': 'passed' if value is True else 'failed', 'observation': value})
        print(name, results[-1]['result'], flush=True)
        if value is not True: raise AssertionError(name + ': ' + str(value))
    restored = False
    try:
        browser('open', lab.BASE['halo'])
        browser('eval', 'localStorage.removeItem("halo-butterfly-next.color-scheme")')
        for width,height in [(1440,1000),(390,844)]:
            browser('set','viewport',str(width),str(height))
            config()
            page('/')
            check('defaults-'+str(width), 'document.querySelector("[data-index-layout]").dataset.indexLayout==="3" && MainApp.conf.style_mode==="system" && !document.documentElement.classList.contains("appearance-avatar") && document.querySelector(".above-subtitle--text").textContent===MainApp.conf.site_subtitle && !performance.getEntriesByType("resource").some(x=>x.name.includes("charts.min.js"))')
            for n in range(1,8):
                config(index={'index_layout':str(n),'index_post_content':{'method':'3','length':120}})
                page('/')
                check('layout-'+str(n)+'-'+str(width), 'document.querySelector("[data-index-layout]").dataset.indexLayout==='+json.dumps(str(n))+' && !document.querySelector("[data-legacy-layout]") && !!document.querySelector(".essay .excerpt")')
        config(index={'index_layout':'invalid','post_layout':'tile'})
        page('/')
        check('obsolete-layout-ignored','document.querySelector("[data-index-layout]").dataset.indexLayout==="3"')
        browser('eval', 'document.querySelector("#darkmode").click()')
        check('reader-override','localStorage.getItem("halo-butterfly-next.color-scheme")===document.documentElement.dataset.colorScheme')
        browser('eval','document.querySelector("#darkmode-reset").click()')
        check('reader-reset','localStorage.getItem("halo-butterfly-next.color-scheme")===null && document.documentElement.dataset.colorScheme===(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")')
        config(style={'mode':'dark'}); page('/')
        check('fixed-dark','document.documentElement.dataset.colorScheme==="dark" && !document.querySelector("#darkmode") && !document.querySelector("#darkmode-reset")')
        config(style={'mode':'schedule'},darkmode={'night_start':18,'night_end':6}); page('/')
        check('schedule','document.documentElement.dataset.colorScheme===((new Date().getHours()>=18 || new Date().getHours()<6)?"dark":"light")')
        config(appearance={'avatar_effect':True}); page('/')
        check('avatar-explicit','document.documentElement.classList.contains("appearance-avatar")')
        for route,selector,field in [('/categories/','.category-list','category_ui'),('/tags/','.equinox','tag_ui')]:
            config(); page(route)
            check(field+'-default','!!document.querySelector('+json.dumps(selector)+') && !document.querySelector(".chart") && !performance.getEntriesByType("resource").some(x=>x.name.includes("charts.min.js"))')
            config(appearance={field:'chart'}); page(route)
            browser('wait','--fn','!!document.querySelector(".chart canvas")')
            check(field+'-chart','performance.getEntriesByType("resource").filter(x=>x.name.includes("charts.min.js")).length===1 && !!document.querySelector('+json.dumps(selector)+')')
        config(appearance={'category_ui':'chart'},CDN={'option':{'charts':'/missing-charts.js'}});page('/categories/')
        browser('wait','--fn','!!document.querySelector(".chart canvas")')
        check('chart-native-error-local-fallback','!!document.querySelector(".chart canvas") && document.querySelector(".category-list")!==null')
        config(index={'enable_above':False,'above_background':'/lab/cover-autumn-forest.webp'})
        page('/about-preview/')
        check('single-independent','MainApp.conf.enable_above===true && MainApp.conf.above_background==="/lab/cover-architecture.webp"')
        page('/archives/preview-1/')
        check('post-native-cover','MainApp.conf.above_background==="/lab/cover-mountain-lake.webp"')
        for shrink in ['expanded','collapsed','disabled']:
            config(render={'code_shrink':shrink});page('/archives/preview-1/')
            browser('wait','--fn','!!document.querySelector(".code-toolbar") || !!document.querySelector(".code-copy")')
            check('code-'+shrink,'(()=>{const b=document.querySelector(".code-expander");return '+ ('!b' if shrink=='disabled' else '!!b && b.getAttribute("aria-expanded")==='+json.dumps('false' if shrink=='collapsed' else 'true'))+'})()')
        config(CDN={'asset_base':'/themes/halo-butterfly-next/assets','option':{'fontawesome':'javascript:invalid'}})
        page('/')
        check('root-direct','document.querySelector("[data-resource-key=main]").src.includes("/themes/halo-butterfly-next/assets/js/index.min.js") && document.querySelector("[data-resource-key=fontawesome]").href.includes("/plugins/fontawesome/css/all.min.css")')
        config(CDN={'asset_base':'https://invalid.test/assets?bad','option':{}});page('/')
        check('invalid-root-local','document.querySelector("[data-resource-key=main]").src.startsWith(location.origin)')
        config(pjax={'enable':True},CDN={'asset_base':'/themes/halo-butterfly-next/assets','option':{}},index={'index_layout':'3'})
        page('/');browser('eval','window.__configPjaxSentinel=1')
        for route in ['/categories/','/tags/','/archives/','/','/categories/','/']:
            browser('eval','document.querySelector('+json.dumps('a[href="'+route+'"]')+').click()')
            browser('wait','--fn','location.pathname==='+json.dumps(route)+' && !!MainApp.useTheme && !document.body.classList.contains("theme-navigating")')
            check('pjax-'+str(len(results)), 'window.__configPjaxSentinel===1 && !!MainApp.useTheme')
    finally:
        client.api(CONFIG,'PUT',original)
        restored = client.api(CONFIG) == original
        browser('close')
        lab.write_json(OUT/('report-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'.json'), {'schema':1,'testedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'haloVersion':lab.VERSIONS['halo']['version'],'installedPackage':installed,'sourceIsDirtyWorktree':True,'results':results,'restored':restored,'limitations':['Halo-only headless Chromium; not Hexo comparison, Safari, real device, screen reader, independent review or CI.']})
    if not restored: raise RuntimeError('Config restoration failed')
    return 0
if __name__=='__main__':raise SystemExit(main())
