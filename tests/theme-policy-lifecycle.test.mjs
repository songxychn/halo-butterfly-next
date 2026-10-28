import {test} from 'bun:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const built=await Bun.build({entrypoints:['src/js/core/theme.ts'],target:'browser',format:'iife',plugins:[{name:'test-theme',setup(build){build.onLoad({filter:/\/theme\.ts$/},async args=>({contents:(await readFile(args.path,'utf8')).replace('export default class Theme','class Theme')+'\nglobalThis.PolicyTheme=Theme;',loader:'ts'}));}}]});
if(!built.success)throw Error('theme bundle failed');
const source=await built.outputs[0].text();
function fixture(conf={},blocked=false){
 const listeners=[],timers=[],storage=new Map();
 const window={addEventListener(k,f){listeners.push([this,k,f]);},removeEventListener(k,f){const i=listeners.findIndex(x=>x[0]===this&&x[1]===k&&x[2]===f);if(i>=0)listeners.splice(i,1);},matchMedia(){return {matches:true,addEventListener:window.addEventListener,removeEventListener:window.removeEventListener};}};
 const document={documentElement:{dataset:{}},addEventListener:window.addEventListener,removeEventListener:window.removeEventListener};
 const MainApp={conf};
 const context={MainApp,window,document,localStorage:{getItem:k=>{if(blocked)throw Error('blocked');return storage.get(k);},setItem:(k,v)=>{if(blocked)throw Error('blocked');storage.set(k,v);},removeItem:k=>storage.delete(k)},setTimeout:(fn,delay)=>{timers.push({fn,delay,cleared:false});return timers.length;},clearTimeout:id=>{if(timers[id-1])timers[id-1].cleared=true;}};
 vm.createContext(context);vm.runInContext(source,context);
 const theme=new context.PolicyTheme();
 return {theme,context,storage,listeners,timers,document};
}
test('reader override and restore work with blocked storage',()=>{
 const f=fixture({},true);assert.equal(f.theme.getMode(),'dark');
 f.theme.toggleMode();assert.equal(f.theme.getMode(),'light');
 const change=f.listeners.find(x=>x[1]==='change');change[2]({matches:true});assert.equal(f.theme.getMode(),'light');
 f.theme.resetMode();assert.equal(f.theme.getMode(),'dark');
});
test('schedule installs a boundary timer and multiple theme consumers receive updates',()=>{
 const f=fixture({style_mode:'schedule',darkmode_night_start:18,darkmode_night_end:6});assert(f.timers.length>0);
 let a=0,b=0;f.theme.change(()=>a++);f.theme.change(()=>b++);f.theme.toggleMode();assert.equal(a,1);assert.equal(b,1);
 f.theme.resetMode();assert.equal(f.storage.has('halo-butterfly-next.color-scheme'),false);assert.equal(a,2);assert.equal(b,2);
 assert.equal(f.timers.filter(x=>!x.cleared).length,1);
});
test('fixed mode ignores persisted reader choice and toggle attempts',()=>{
 const f=fixture({style_mode:'light'});f.theme.toggleMode();assert.equal(f.theme.getMode(),'light');assert.equal(f.storage.size,0);
});
