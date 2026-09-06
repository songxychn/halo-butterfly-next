/** Real Halo interaction regression using a task-owned headless agent-browser. */
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, existsSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const base = process.argv[2];
if (base !== 'http://127.0.0.1:18090') throw new Error('Pass the authorized isolated Halo URL explicitly.');
const output = resolve(process.argv[3] || '.evidence/navigation/browser');
const empty = process.argv.includes('--empty');
mkdirSync(output, {recursive: true});
const session = execFileSync('agent-browser', ['session', 'id', '--scope', 'worktree', '--prefix', `navigation-check-${process.pid}`], {encoding: 'utf8'}).trim();
const reports = [];
const provenance = {
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
  sourceWorktreeDirty: Boolean(execFileSync('git', ['status', '--porcelain'], {encoding: 'utf8'}).trim()),
  artifactSha256: existsSync('dist/halo-butterfly-next-0.1.0-alpha.1.zip') ? createHash('sha256').update(readFileSync('dist/halo-butterfly-next-0.1.0-alpha.1.zip')).digest('hex') : null,
  session,
};
function command(...args) {
  return execFileSync('agent-browser', ['--session', session, ...args], {encoding: 'utf8', timeout: 40000});
}
function evaluate(code) {
  const result = JSON.parse(execFileSync('agent-browser', ['--session', session, '--json', 'eval', '--stdin'], {input: code, encoding: 'utf8', timeout: 40000}));
  if (!result.success) throw new Error(JSON.stringify(result));
  return result.data.result;
}
function check(expression, name) {
  const result = evaluate(`Boolean(${expression})`);
  reports.push({name, result});
  if (!result) throw new Error('Failed: ' + name);
}
function wait(expression) {command('wait', '--fn', expression);}
function pointerOpen() {
  command('click', '.nav .bars');
  wait("!document.querySelector('#mobile-navigation').hidden && document.querySelector('#mobile-navigation').getBoundingClientRect().right <= innerWidth + 0.5");
}
function returnToTop() {
  evaluate('window.scrollTo(0,0)');
  wait("document.querySelector('.nav').getBoundingClientRect().top >= -0.5");
}
function observeLeaf() {
  evaluate("sessionStorage.removeItem('navigation-test-leaf');document.addEventListener('click',event=>{const a=event.target.closest('.bar-children--link');if(a)sessionStorage.setItem('navigation-test-leaf',JSON.stringify({href:a.getAttribute('href'),expanded:a.closest('.bar-item').querySelector('.menu-toggle').getAttribute('aria-expanded')}))},{once:true})");
}
function checkLeaf(name) {
  check("JSON.parse(sessionStorage.getItem('navigation-test-leaf'))?.expanded === 'true'", name);
}
function fresh(width, height, mode) {
  command('open', base + '/');
  command('set', 'viewport', String(width), String(height));
  wait("document.readyState === 'complete'");
  if (evaluate('document.documentElement.dataset.colorScheme') !== mode) {
    command('scrollintoview', '.footer');
    wait("document.querySelector('.side-btn').classList.contains('active')");
    evaluate("Promise.all(document.querySelector('.side-btn').getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))).then(()=>true)");
    command('click', '.switch-model');
    wait(`document.documentElement.dataset.colorScheme === '${mode}'`);
  }
  evaluate('window.scrollTo(0, 0)');
  evaluate("(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));return true})()");
  wait("document.querySelector('.nav').getBoundingClientRect().top >= -0.5");
}
function screenshot(name) {
  evaluate(`(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));return true})()`);
  wait("Array.from(document.images).filter(i=>{const r=i.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth}).every(i=>i.complete&&i.naturalWidth>0&&(!i.dataset.lazySrc||i.classList.contains('loaded')||i.classList.contains('error')))");
  command('screenshot', resolve(output, name + '.png'));
  writeFileSync(resolve(output, name + '-a11y.json'), command('a11y', '--selector', name.startsWith('desktop') ? '.nav' : '#mobile-navigation', '--tags', 'wcag2a,wcag2aa', '--json'));
  writeFileSync(resolve(output, name + '-state.json'), JSON.stringify(evaluate(`({url:location.href,mode:document.documentElement.dataset.colorScheme,viewport:[innerWidth,innerHeight],active:document.activeElement.outerHTML,focusVisible:document.activeElement.matches(':focus-visible'),focusOutline:{width:getComputedStyle(document.activeElement).outlineWidth,color:getComputedStyle(document.activeElement).outlineColor},browser:navigator.userAgent,links:Array.from(document.querySelectorAll('.nav a,#mobile-navigation a')).map(a=>({text:a.textContent.trim(),href:a.getAttribute('href')}))})`), null, 2));
}
try {
  // A unique task-owned session starts a fresh headless browser on every run.
  for (const mode of ['light', 'dark']) {
    fresh(1440, 1000, mode);
    check("!document.querySelector('.nav .controls a')", mode + ': unavailable search plugin without error');
    if (!empty) {
      command('focus', '.nav .menu-item:first-child > .link');
      command('press', 'Tab');
      check("document.activeElement.matches('.nav .menu-toggle')", mode + ': desktop parent reachable by Tab');
      command('press', 'Enter');
      check("document.activeElement.getAttribute('aria-expanded') === 'true' && !document.querySelector('.menu-children').hidden", mode + ': Enter opens desktop group');
      command('press', 'Tab');
      check("document.activeElement.matches('.menu-children--link')", mode + ': Tab reaches child');
      screenshot('desktop-' + mode);
      command('press', 'Escape');
      check("document.activeElement.matches('.nav .menu-toggle') && document.querySelector('.menu-children').hidden", mode + ': Escape closes and returns parent');
      command('press', 'Space');
      check("!document.querySelector('.menu-children').hidden", mode + ': Space opens desktop group');
      command('press', 'Tab');
      command('press', 'Enter');
      wait("location.pathname.replace(/\\/$/,'') === '/archives'");
      reports.push({name: mode + ': child Enter navigates to archives', result: true});
      fresh(1440, 1000, mode);
      check("(()=>{const n=document[Symbol.for('halo-butterfly-next.navigation')];return new n.constructor() === n && new n.constructor() === n})()", mode + ': repeated initialization reuses one controller');
      command('focus', '.nav .menu-toggle');
      command('press', 'Enter');
      command('press', 'Tab');
      command('set', 'viewport', '390', '844');
      wait("document.querySelector('.menu-children').hidden");
      check("document.activeElement.matches('.nav .bars') && document.querySelector('.nav .menu-toggle').getAttribute('aria-expanded') === 'false'", mode + ': desktop child focus moves to visible mobile toggle on resize');
      fresh(1440, 1000, mode);
      command('hover', '.nav .menu-item:nth-child(2)');
      check("!document.querySelector('.menu-children').hidden", mode + ': mouse hover opens desktop group');
      command('press', 'Escape');
      check("document.querySelector('.menu-children').hidden", mode + ': Escape dismisses stationary hover');
    } else {
      check("document.querySelectorAll('.nav .menu-item').length === 0", mode + ': empty desktop menu');
    }
    fresh(390, 844, mode);
    check("document.querySelector('#mobile-navigation').hidden && document.querySelector('#mobile-navigation').inert", mode + ': closed drawer excluded');
    command('focus', '.footer .theme');
    command('press', 'Tab');
    check("!document.activeElement.closest('#mobile-navigation')", mode + ': closed drawer not in Tab order');
    returnToTop();
    command('focus', '.nav .bars');
    command('press', 'Enter');
    check("document.activeElement.matches('.side-bar-close') && document.querySelector('.nav .bars').getAttribute('aria-expanded') === 'true'", mode + ': open moves focus inside');
    check("document.querySelector('.header').inert && document.body.style.overflow === 'hidden'", mode + ': background inert and scroll locked');
    command('press', 'Shift+Tab');
    check("document.activeElement === Array.from(document.querySelectorAll('#mobile-navigation a')).filter(a=>!a.closest('[hidden]')).at(-1)", mode + ': reverse Tab wraps to last link');
    command('press', 'Tab');
    check("document.activeElement.matches('.side-bar-close')", mode + ': Tab wraps to first');
    if (!empty) {
      command('focus', '#mobile-navigation .menu-toggle');
      command('press', 'Space');
      check("!document.querySelector('.bar-children').hidden && document.querySelector('.bar-item.child').classList.contains('active')", mode + ': mobile Space opens group');
      check("document.querySelectorAll('.bar-children i').length === 2", mode + ': mobile child icons rendered');
      command('press', 'Tab');
      check("document.activeElement.matches('.bar-children--link')", mode + ': mobile Tab reaches child');
      screenshot('mobile-' + mode);
      command('press', 'Escape');
      check("document.querySelector('.bar-children').hidden && !document.querySelector('#mobile-navigation').hidden && document.activeElement.matches('.menu-toggle')", mode + ': first Escape closes child group only');
      command('press', 'Enter');
      command('press', 'Tab');
      observeLeaf();
      command('press', 'Enter');
      wait("location.pathname.replace(/\\/$/,'') === '/archives'");
      reports.push({name: mode + ': mobile child Enter navigates', result: true});
      checkLeaf(mode + ': child keyboard activation does not collapse its parent');
      fresh(390, 844, mode);
      pointerOpen();
      command('click', '#mobile-navigation .menu-toggle');
      observeLeaf();
      command('click', '.bar-children--item:first-child > .bar-children--link');
      wait("location.pathname.replace(/\\/$/,'') === '/archives'");
      reports.push({name: mode + ': mobile child pointer navigates', result: true});
      checkLeaf(mode + ': child pointer activation does not collapse its parent');
      fresh(390, 844, mode);
      pointerOpen();
    } else {
      screenshot('mobile-empty-' + mode);
    }
    command('press', 'Escape');
    check("document.querySelector('#mobile-navigation').hidden && document.activeElement.matches('.nav .bars') && !document.querySelector('.header').inert && document.body.style.overflow !== 'hidden'", mode + ': Escape closes and restores focus/background/scroll');
    pointerOpen();
    command('click', '.side-bar-close');
    check("document.querySelector('#mobile-navigation').hidden && document.activeElement.matches('.nav .bars')", mode + ': close button restores toggle');
    pointerOpen();
    wait("document.querySelector('#mobile-navigation').getBoundingClientRect().left < 100");
    const outside = evaluate("({x:document.querySelector('#mobile-navigation').getBoundingClientRect().left / 2,y:100})");
    command('mouse', 'move', String(outside.x), String(outside.y));
    command('mouse', 'down');
    command('mouse', 'up');
    check("document.querySelector('#mobile-navigation').hidden && document.activeElement.matches('.nav .bars')", mode + ': mask closes drawer');
    pointerOpen();
    command('set', 'viewport', '1440', '1000');
    wait("document.querySelector('#mobile-navigation').hidden");
    check("document.body.style.overflow !== 'hidden' && document.activeElement.matches('.nav-title a') && !document.querySelector('.header').inert", mode + ': resize releases state and focuses visible desktop link');
    command('set', 'viewport', '390', '844');
    command('focus', '.nav .bars');
    command('press', 'Space');
    check("!document.querySelector('#mobile-navigation').hidden", mode + ': mobile Space reopens after resize');
    command('press', 'Escape');
    evaluate("document.body.style.setProperty('overflow-x','clip');document.body.style.setProperty('overflow-y','scroll','important');document.body.style.setProperty('padding-left','7px')");
    pointerOpen();
    command('press', 'Escape');
    check("document.body.style.overflowX === 'clip' && document.body.style.overflowY === 'scroll' && document.body.style.getPropertyPriority('overflow-y') === 'important' && document.body.style.paddingLeft === '7px'", mode + ': close preserves independent overflow axes, priority and unrelated inline styles');
    evaluate("document.body.style.removeProperty('overflow-x');document.body.style.removeProperty('overflow-y');document.body.style.removeProperty('padding-left')");
    for (const [mobileWidth, desktopWidth] of [[390, 1440], [768, 769]]) {
      command('set', 'viewport', String(mobileWidth), '844');
      returnToTop();
      command('focus', '.nav .bars');
      command('set', 'viewport', String(desktopWidth), '1000');
      evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))).then(()=>true)');
      check("document.querySelector('#mobile-navigation').hidden && document.activeElement.matches('.nav-title a')", `${mode}: closed toggle focus survives ${mobileWidth}→${desktopWidth}`);
      command('set', 'viewport', String(mobileWidth), '844');
      command('focus', '.footer .theme');
      command('set', 'viewport', String(desktopWidth), '1000');
      evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))).then(()=>true)');
      check("document.activeElement.matches('.footer .theme')", `${mode}: resize ${mobileWidth}→${desktopWidth} preserves content link focus`);
      command('set', 'viewport', String(mobileWidth), '844');
      command('focus', '.footer .theme');
      evaluate('document.activeElement.blur()');
      command('set', 'viewport', String(desktopWidth), '1000');
      evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))).then(()=>true)');
      check("document.activeElement === document.body", `${mode}: resize ${mobileWidth}→${desktopWidth} does not steal body focus last held in content`);
    }
  }
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({...provenance,testedAt: new Date().toISOString(),base,fixture:empty?'empty':'two-level',result:'passed',checks:reports},null,2));
  process.stdout.write(`${reports.length} real-browser navigation checks passed. Reports: ${output}\n`);
} catch (error) {
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({...provenance,testedAt:new Date().toISOString(),base,result:'failed',checks:reports,error:String(error)},null,2));
  throw error;
} finally {
  command('close');
}
