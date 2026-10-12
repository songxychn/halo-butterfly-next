/** Small local effects implementation, loaded only for explicitly enabled options. */
import {enabled, cssValue} from '../core/appearance.ts';
type Options = Record<string, unknown>;
const config = window.MainApp.conf.effects || {};
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const mobile = matchMedia('(max-width: 768px)');
const active = (name: string) => {
  const value = config[name] as Options | undefined;
  return value && enabled(value.enable) && (!mobile.matches || enabled(value.mobile)) && !reduced.matches ? value : null;
};
const bounded = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Number(value); return value === '' || value == null || !Number.isFinite(n) ? fallback : Math.min(max, Math.max(min,n));
};
const instances: (() => void)[] = [];
const listen = (type: string, fn: EventListener) => { document.addEventListener(type,fn); instances.push(()=>document.removeEventListener(type,fn)); };
let frame = 0;
function start() {
  stop();
  const ribbon = active('canvas_ribbon'), flutter = active('canvas_fluttering_ribbon'), nest = active('canvas_nest'), fireworks = active('fireworks'), power = active('activate_power_mode');
  let canvas: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null;
  let width = innerWidth, height = innerHeight, time = 0;
  const particles: {x:number;y:number;vx:number;vy:number;life:number;color:string}[] = [];
  const dots = Array.from({length: nest ? Math.trunc(bounded(nest.count,99,1,150)) : 0},()=>({x:Math.random()*width,y:Math.random()*height,vx:Math.random()-.5,vy:Math.random()-.5}));
  let hue = Math.random()*360;
  if (ribbon || flutter || nest || fireworks || power) {
    canvas = document.createElement('canvas'); canvas.className = 'appearance-effect'; canvas.dataset.appearanceEffect = 'canvas';
    canvas.setAttribute('aria-hidden','true'); canvas.style.inset = '0';
    canvas.style.zIndex = String(bounded(fireworks?.zIndex ?? ribbon?.zIndex ?? nest?.zIndex,fireworks || power ? 10 : -1,-1,100));
    document.body.append(canvas); ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); canvas=null; }
    const resize = () => {
      width=innerWidth; height=innerHeight;
      if (canvas && ctx) { const dpr=Math.min(devicePixelRatio || 1,2); canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0); }
    };
    resize(); window.addEventListener('resize',resize); instances.push(()=>window.removeEventListener('resize',resize));
    if (canvas) instances.push(()=>canvas?.remove());
  }
  const burst = (x:number,y:number,colorful=true) => {
    for(let i=0;i<16 && particles.length<160;i++) particles.push({x,y,vx:(Math.random()-.5)*8,vy:(Math.random()-.7)*8,life:1,color:colorful?`hsl(${Math.random()*360} 80% 65%)`:'#49b1f5'});
    resume();
  };
  const draw = () => {
    frame=0;
    if (!ctx || document.hidden || reduced.matches) return;
    ctx.clearRect(0,0,width,height); time+=.01;
    if (ribbon || flutter) {
      const size=bounded(ribbon?.size,150,20,500);
      ctx.globalAlpha=bounded(ribbon?.alpha,.6,0,1);
      for(let i=0;i<Math.ceil(width/size)+1;i++) {
        const wave=flutter?Math.sin(time+i)*40:0;
        ctx.fillStyle=`hsl(${hue+i*25} 80% 70%)`;ctx.beginPath();ctx.moveTo(i*size,height*.5+wave);ctx.lineTo((i+1)*size,height*.5+Math.sin(i+1)*size+wave);ctx.lineTo((i+1)*size,height*.5+Math.sin(i+1)*size+wave+size/2);ctx.closePath();ctx.fill();
      }
    }
    if (nest) {
      const rgb=String(nest.color || '0,0,255');
      ctx.strokeStyle=/^\d{1,3},\d{1,3},\d{1,3}$/.test(rgb) && rgb.split(',').every(v=>Number(v)<=255)?`rgb(${rgb})`:'rgb(0,0,255)';
      ctx.globalAlpha=bounded(nest.opacity,.7,0,1);
      for(let i=0;i<dots.length;i++) {
        const a=dots[i];a.x=(a.x+a.vx+width)%width;a.y=(a.y+a.vy+height)%height;
        for(let j=i+1;j<dots.length;j++) { const b=dots[j];if(Math.hypot(a.x-b.x,a.y-b.y)<100){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();} }
      }
    }
    for(let i=particles.length-1;i>=0;i--) {
      const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.1;p.life-=.025;
      if(p.life<=0) { particles.splice(i,1);continue; }
      ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);
    }
    ctx.globalAlpha=1;
    if (flutter || nest || particles.length) frame=requestAnimationFrame(draw);
  };
  function resume() { if (!frame && ctx && !document.hidden && !reduced.matches) frame=requestAnimationFrame(draw); }
  listen('visibilitychange',()=>{ if(document.hidden) { cancelAnimationFrame(frame);frame=0; } else resume(); });
  resume();
  let textIndex=0;
  const labels=new Set<HTMLElement>();
  instances.push(()=>{for(const label of labels)label.remove();});
  listen('click', ((event: MouseEvent) => {
    if (!event.isTrusted || event.detail===0 || (event.target as Element)?.closest('a,button,input,textarea,select,[contenteditable]')) return;
    if (ribbon && enabled(ribbon.click_to_change)) { hue=Math.random()*360;resume(); }
    if (fireworks) burst(event.clientX,event.clientY);
    const heart=active('click_heart'), text=active('clickShowText');
    if ((!heart && !text) || labels.size>=20) return;
    const values = Array.isArray(text?.text) ? text.text : [];
    const strings=values.map(v=>typeof v==='string'?v:String((v as Options)?.value || '')).filter(Boolean);
    const index=text && enabled(text.random)?Math.floor(Math.random()*strings.length):textIndex++%strings.length;
    for (const content of [heart?'♥':'',text?strings[index] || '':'']) {
      if (!content || labels.size>=20) continue;
      const label=document.createElement('span');label.className='appearance-click';label.setAttribute('aria-hidden','true');label.textContent=content;
      label.style.left=event.clientX+'px';label.style.top=event.clientY+'px';label.style.zIndex='100';label.style.color=`hsl(${Math.random()*360} 80% 50%)`;
      label.style.fontSize=cssValue('font-size',text?.fontSize)||'20px';
      document.body.append(label);labels.add(label);
      const remove=()=>{labels.delete(label);label.remove();};label.addEventListener('animationend',remove,{once:true});setTimeout(remove,1500);
    }
  }) as EventListener);
  if(power) listen('input',((event: Event)=>{
    const target=event.target;
    if(!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) || (target instanceof HTMLInputElement && target.type !== 'text' && target.type !== 'search') || target.closest('[data-private], [autocomplete="off"]')) return;
    const box=target.getBoundingClientRect();burst(box.left+Math.min(box.width,30),box.top+box.height/2,enabled(power.colorful));
    if(enabled(power.shake)) target.animate([{translate:'0'},{translate:'2px 0'},{translate:'-2px 0'},{translate:'0'}],{duration:120});
  }) as EventListener);
}
function stop() { cancelAnimationFrame(frame);frame=0;for(const dispose of instances.splice(0))dispose(); }
if (!document.documentElement.hasAttribute('data-appearance-effects-bound')) {
  document.documentElement.setAttribute('data-appearance-effects-bound','true');
  reduced.addEventListener('change',start);mobile.addEventListener('change',start);
  window.addEventListener('pagehide',stop);window.addEventListener('pageshow',start);start();
}
