/** Browser acceptance of the theme 404 page; HTTP semantics are checked separately. */
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const [base, profileName = 'default', outputName = '.evidence/error-page/browser'] = process.argv.slice(2);
if (!['http://127.0.0.1:18095', 'http://127.0.0.1:18096'].includes(base)) throw new Error('Pass the explicitly assigned synthetic Halo URL.');
const profile = JSON.parse(readFileSync('fixtures/error-page/profiles.json', 'utf8'))[profileName];
if (!profile) throw new Error('Unknown error-page profile');
const output = resolve(outputName);
mkdirSync(output, {recursive: true});
const session = `error-page-${process.pid}`;
const command = (...args) => execFileSync('agent-browser', ['--session', session, ...args], {encoding: 'utf8', timeout: 45000});
function evaluate(code) {
  const response = JSON.parse(execFileSync('agent-browser', ['--session', session, '--json', 'eval', '--stdin'], {input: code, encoding: 'utf8', timeout: 45000}));
  if (!response.success) throw new Error(JSON.stringify(response));
  return response.data.result;
}
function settle() {
  evaluate('(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));return true})()');
}
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const artifactPath = `dist/halo-butterfly-next-${version}.zip`;
const provenance = {
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
  sourceWorktreeDirty: Boolean(execFileSync('git', ['status', '--porcelain'], {encoding: 'utf8'}).trim()),
  artifactPath, artifactSha256: createHash('sha256').update(readFileSync(artifactPath)).digest('hex'), session,
};
const checks = [], states = [];
function check(expression, name) {
  const passed = evaluate(`Boolean(${expression})`);
  checks.push({name, passed});
  if (!passed) throw new Error(name);
}
const siteTitle = JSON.parse(readFileSync('fixtures/comparison/content.json', 'utf8')).site.title;
try {
  const blockedImages = profile.abortImages || (profile.abortImage ? [profile.abortImage] : []);
  if (blockedImages.length) {
    command('open', 'about:blank');
    for (const image of blockedImages) command('network', 'route', image, '--abort');
  }
  const viewports = profileName === 'default' ? [1440, 390, 320] : [1440, 390];
  for (const width of viewports) for (const mode of profileName === 'default' || profileName === 'custom' ? ['light', 'dark'] : [width === 1440 ? 'dark' : 'light']) {
    const name = `${profileName}-${width}-${mode}`;
    command('open', base + '/__error404_fixture__/missing');
    command('set', 'viewport', String(width), width === 1440 ? '1000' : '844');
    command('wait', '--fn', `document.readyState==='complete' && ${profile.image ? "document.querySelector('.error-image')?.naturalWidth>0" : "document.querySelector('.error-image')?.hidden"}`);
    command('mouse', 'move', '0', '0');
    if (evaluate('document.documentElement.dataset.colorScheme') !== mode) {
      command('focus', '.switch-model'); command('press', 'Enter');
      command('wait', '--fn', `document.documentElement.dataset.colorScheme==='${mode}'`);
    }
    settle();
    check(`document.title.includes(${JSON.stringify(siteTitle)}) && document.querySelector('.error-title').textContent==='404'`, `${name}: error and site identity`);
    check(`document.querySelector('.error-subtitle').textContent===${JSON.stringify(profile.subtitle)} && !window.__error404_untrusted`, `${name}: configured text is escaped and complete`);
    if (profile.image) check(`new URL(document.querySelector('.error-image').currentSrc).pathname===${JSON.stringify(profile.image)} && document.querySelector('.error-image').naturalWidth>0`, `${name}: configured or fallback image loaded`);
    else check("document.querySelector('.error-image').hidden && document.querySelector('.error-image').naturalWidth===0", `${name}: exhausted decorative image is hidden`);
    if (profile.settings.background.includes('missing-image')) check("!document.querySelector('.error-image').hasAttribute('srcset')", `${name}: failed responsive candidates cannot override fallback src`);
    check("document.documentElement.scrollWidth<=innerWidth && document.querySelector('.error-home').getBoundingClientRect().width>0", `${name}: no horizontal overflow and home link rendered`);
    if (profile.geometry?.[width]) {
      const actual = evaluate("document.querySelector('.error-card').getBoundingClientRect().toJSON()"), expected = profile.geometry[width];
      const passed = Object.entries(expected).every(([key, value]) => Math.abs(actual[key] - value) <= 1);
      const label = `${name}: default card geometry matches fixed upstream within one CSS pixel`;
      checks.push({name: label, passed, actual, expected});
      if (!passed) throw new Error(label);
    }
    check("document.querySelector('meta[name=robots]').content.includes('noindex') && !document.querySelector('link[rel=canonical]')", `${name}: missing page is not indexed or canonicalized`);
    check("document.querySelector('#mobile-navigation').hidden && document.querySelector('#mobile-navigation').inert", `${name}: closed drawer is excluded from focus`);
    command('focus', '.error-home'); command('press', 'Tab');
    check("document.activeElement.matches('.switch-model:focus-visible') && document.activeElement.getBoundingClientRect().top>=0 && document.activeElement.getBoundingClientRect().bottom<=innerHeight", `${name}: keyboard reaches visible mode control`);
    command('press', 'Enter');
    command('wait', '--fn', `document.documentElement.dataset.colorScheme==='${mode === 'light' ? 'dark' : 'light'}'`);
    command('press', 'Enter'); command('wait', '--fn', `document.documentElement.dataset.colorScheme==='${mode}'`);
    checks.push({name: `${name}: keyboard mode toggle and return`, passed: true});
    if (width <= 768) {
      command('focus', '.nav .bars'); command('press', 'Enter'); settle();
      check("!document.querySelector('#mobile-navigation').hidden && !document.querySelector('#mobile-navigation').inert && document.querySelector('#mobile-navigation').contains(document.activeElement) && document.querySelector('.main').inert", `${name}: keyboard opens modal navigation and excludes background`);
      command('focus', '.side-bar-close'); command('press', 'Shift+Tab');
      check("document.querySelector('#mobile-navigation').contains(document.activeElement) && !document.activeElement.matches('.side-bar-close')", `${name}: reverse Tab wraps within mobile drawer`);
      command('press', 'Tab');
      check("document.activeElement.matches('.side-bar-close')", `${name}: Tab wraps back to close button`);
      command('press', 'Escape'); settle();
      check("document.querySelector('#mobile-navigation').hidden && document.querySelector('#mobile-navigation').inert && !document.querySelector('.main').inert && document.activeElement.matches('.nav .bars')", `${name}: Escape closes navigation and restores focus`);
    } else {
      command('focus', '.nav-title a'); command('press', 'Tab');
      check("document.activeElement.closest('.nav') && document.activeElement.matches(':focus-visible')", `${name}: desktop navigation participates in keyboard order`);
    }
    command('focus', '.error-home'); command('press', 'Tab'); command('press', 'Shift+Tab'); settle();
    check("document.activeElement.matches('.error-home:focus-visible') && parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=2", `${name}: home link has visible keyboard focus`);
    const state = evaluate(`(()=>{const card=document.querySelector('.error-card'),art=document.querySelector('.error-art'),info=document.querySelector('.error-info'),home=document.querySelector('.error-home'),style=getComputedStyle(home);return {profile:${JSON.stringify(profileName)},viewport:[innerWidth,innerHeight],mode:document.documentElement.dataset.colorScheme,title:document.title,subtitle:document.querySelector('.error-subtitle').textContent,image:document.querySelector('.error-image').currentSrc,card:card.getBoundingClientRect().toJSON(),art:art.getBoundingClientRect().toJSON(),info:info.getBoundingClientRect().toJSON(),home:{color:style.color,background:style.backgroundColor,outlineColor:style.outlineColor,outlineWidth:style.outlineWidth,outlineOffset:style.outlineOffset},browser:navigator.userAgent}})()`);
    const audit = JSON.parse(command('a11y', '--selector', '.error-card', '--tags', 'wcag2a,wcag2aa', '--json'));
    writeFileSync(resolve(output, name + '-a11y.json'), JSON.stringify(audit, null, 2));
    if (!audit.success || audit.data.counts.violations !== 0 || audit.data.counts.incomplete !== 0) throw new Error('404 card accessibility scan unresolved: ' + name);
    checks.push({name: `${name}: 404 card axe scan has no violations or incomplete results`, passed: true});
    command('screenshot', resolve(output, name + '-focus.png'), '--full');
    writeFileSync(resolve(output, name + '-state.json'), JSON.stringify(state, null, 2)); states.push(state);
    command('press', 'Enter'); command('wait', '--fn', "location.pathname==='/' && document.querySelector('#Butterfly.index')");
    check(`document.querySelector('.nav-title').textContent.includes(${JSON.stringify(siteTitle)})`, `${name}: native home link returns to the same site`);
    // A new document resets sequential focus: verify the skip link using a real Tab.
    command('open', base + '/__error404_fixture__/missing'); command('wait', '--fn', "document.readyState==='complete'");
    command('press', 'Tab');
    check("document.activeElement.matches('.error-skip-link:focus-visible')", `${name}: first Tab reveals the skip link`);
    command('press', 'Enter');
    check("document.activeElement.id==='error-content'", `${name}: skip link moves focus to error content`);
  }
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({...provenance, base, profileName, testedAt: new Date().toISOString(), result: 'passed', checks, states}, null, 2));
  process.stdout.write(`${checks.length} 404 browser checks passed for ${profileName}.\n`);
} catch (error) {
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({...provenance, base, profileName, testedAt: new Date().toISOString(), result: 'failed', checks, states, error: String(error)}, null, 2));
  throw error;
} finally { command('close'); }
