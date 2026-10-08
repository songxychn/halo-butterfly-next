import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const theme = parse(await readFile(path.join(root, 'theme.yaml'), 'utf8'));
const zip = await JSZip.loadAsync(await readFile(path.join(root, 'dist', `${theme.metadata.name}-${pkg.version}.zip`)));
const required = ['theme.yaml', 'settings.yaml', 'annotation-setting.yaml', 'LICENSE', 'templates/index.html', 'templates/post.html', 'templates/layout.html', 'templates/error/404.html'];
required.push('templates/assets/images/above.svg', 'templates/assets/plugins/fontawesome/LICENSE.txt', 'templates/assets/plugins/prism/LICENSE');
required.push('templates/assets/licenses/viewerjs-1.14.0-LICENSE');
const lazyloadSource = JSON.parse(await readFile(path.join(root, 'third-party-licenses/vanilla-lazyload-source.json'), 'utf8'));
for (const record of [lazyloadSource.local, lazyloadSource.license]) {
  if (createHash('sha256').update(await readFile(path.join(root, record.path))).digest('hex') !== record.sha256) throw new Error('LazyLoad 来源或许可字节改变，需重新核查');
}
for (const file of ['vanilla-lazyload-LICENSE.txt', 'vanilla-lazyload-NOTICE.txt']) {
  const entry = zip.file(`templates/assets/licenses/${file}`);
  if (!entry || !(await entry.async('nodebuffer')).equals(await readFile(path.join(root, 'third-party-licenses', file)))) throw new Error(`LazyLoad 许可或署名缺失/不一致：${file}`);
}
const prismThemes = JSON.parse(await readFile(path.join(root, 'third-party-licenses/prism-themes-source.json'), 'utf8'));
const prismThemesLicense = await readFile(path.join(root, prismThemes.license.path));
if (createHash('sha256').update(prismThemesLicense).digest('hex') !== prismThemes.license.sha256) throw new Error('Prism Themes 许可正文与固定官方摘要不符');
const prismThemesEntry = zip.file('templates/assets/plugins/prism/themes/LICENSE');
if (!prismThemesEntry || !(await prismThemesEntry.async('nodebuffer')).equals(prismThemesLicense)) throw new Error('安装包缺少或改写了 Prism Themes 独立许可');
const upstreamSources = JSON.parse(await readFile(path.join(root, 'third-party-licenses/upstream-sources.json'), 'utf8'));
for (const source of upstreamSources.sources) {
  const original = await readFile(path.join(root, 'third-party-licenses', source.file));
  if (createHash('sha256').update(original).digest('hex') !== source.sha256) throw new Error(`上游许可正文与固定来源摘要不符：${source.file}`);
}
for (const file of ['hexo-butterfly-5.7.0-LICENSE.txt', 'normalize-8.0.1-LICENSE.md', 'UPSTREAM-ATTRIBUTION.txt']) {
  const entry = zip.file(`templates/assets/licenses/${file}`);
  if (!entry || !(await entry.async('nodebuffer')).equals(await readFile(path.join(root, 'third-party-licenses', file)))) throw new Error(`安装包缺少或改写了上游许可材料：${file}`);
}
for (const file of upstreamSources.adaptedFiles) {
  if (!(await readFile(path.join(root, file.path), 'utf8')).includes('third-party-licenses/UPSTREAM-ATTRIBUTION.txt')) throw new Error(`改写源文件缺少归属声明指针：${file.path}`);
}
for (const page of ['index', 'post', 'archives', 'categories', 'category', 'tags', 'tag', 'single', 'photos', 'moments', 'links', 'plugin', 'error404']) {
  required.push(`templates/assets/js/${page}.min.js`, `templates/assets/css/${page}.min.css`);
}
for (const name of ['circle', 'cross_line', 'dot', 'hourglass']) required.push(`templates/assets/plugins/loading/${name}.min.js`);
for (const name of required) if (!zip.file(name)) throw new Error(`安装包缺少 ${name}`);
for (const name of Object.keys(zip.files).filter(name => /^templates\/assets\/(?:js|plugins\/loading)\/.*\.js$/.test(name))) {
  if (/\bprocess\.env\.NODE_ENV\b/.test(await zip.file(name).async('string'))) throw new Error(`浏览器脚本残留未解析的构建环境引用：${name}`);
}
for (const name of Object.keys(zip.files)) {
  if (name.endsWith('.css') && /fonts\.(?:googleapis|gstatic)\.com/i.test(await zip.file(name).async('string'))) throw new Error(`主题 CSS 不应依赖 Google Fonts：${name}`);
  if (/fancyapps/i.test(name)) throw new Error(`旧灯箱许可文件不应进入安装包：${name}`);
  if (/\.(js|css)$/.test(name) && /@fancyapps|fancyapps\.com|--f-spinner-width/.test(await zip.file(name).async('string'))) throw new Error(`旧灯箱实现不应进入安装包：${name}`);
  if (!name.startsWith('templates/') && !required.includes(name)) throw new Error(`不允许打包 ${name}`);
  if (name.includes('..') || name.startsWith('/')) throw new Error(`非法路径 ${name}`);
  if (name.startsWith('templates/assets/font/') || name.endsWith('/above.png')) throw new Error(`旧版来源未核实的素材不应进入安装包：${name}`);
  if (!(await zip.file(name).async('nodebuffer')).equals(await readFile(path.join(root, name)))) throw new Error(`构建目录与安装包不一致：${name}`);
}
const config = parse(await zip.file('settings.yaml').async('string'));
if (config.metadata.name !== theme.spec.settingName) throw new Error('Setting 标识不一致');
if (theme.metadata.name !== 'halo-butterfly-next' || theme.spec.configMapName !== 'halo-butterfly-next-configMap') throw new Error('维护版必须使用独立标识');
if (!/^>=\d+\.\d+\.\d+$/.test(theme.spec.requires) || 'require' in theme.spec) throw new Error('兼容版本声明必须只包含最低正式版本，如 >=2.20.2');
const layout = await zip.file('templates/views/layout.html').async('string');
if (!layout.includes('#theme.assets')) throw new Error('资源必须由当前主题解析');
const publicLayout = await zip.file('templates/layout.html').async('string');
if (!/th:fragment="html\s*\(\s*head\s*,\s*content\s*\)"/.test(publicLayout)) throw new Error('公共布局必须提供 html(head, content) 契约');
if (!publicLayout.includes('#theme.assets')) throw new Error('公共布局资源必须由当前主题解析');
if (!(await zip.file('templates/views/config.html').async('string')).includes('/*[[')) throw new Error('Thymeleaf 内联表达式丢失');
console.log(`安装包检查通过：${Object.keys(zip.files).length} 个文件，所有页面和 Loading 资源齐全`);
