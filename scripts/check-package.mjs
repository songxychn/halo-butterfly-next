import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const theme = parse(await readFile(path.join(root, 'theme.yaml'), 'utf8'));
const zip = await JSZip.loadAsync(await readFile(path.join(root, 'dist', `${theme.metadata.name}-${pkg.version}.zip`)));

const required = [
  'theme.yaml', 'settings.yaml', 'annotation-setting.yaml', 'LICENSE',
  'templates/index.html', 'templates/post.html', 'templates/layout.html', 'templates/error/404.html',
  'templates/assets/css/core.min.css',
  'templates/assets/images/above.svg',
  'templates/assets/plugins/fontawesome/LICENSE.txt',
  'templates/assets/plugins/prism/LICENSE',
  'templates/assets/plugins/prism/themes/LICENSE',
  'templates/assets/plugins/pace/pace.min.js',
  'templates/assets/plugins/pace/pace-theme-minimal.css',
  'templates/assets/js/masonry.min.js',
  'templates/assets/js/charts.min.js',
  'templates/assets/js/effects.min.js',
  'templates/assets/licenses/hexo-butterfly-5.7.0-LICENSE.txt',
  'templates/assets/licenses/UPSTREAM-ATTRIBUTION.txt',
];
for (const name of ['default', 'en', 'ja', 'ko', 'zh', 'zh_CN', 'zh_HK', 'zh_TW']) {
  required.push(`i18n/${name}.properties`);
}
for (const name of ['mermaid', 'chartjs', 'abcjs']) {
  required.push(`templates/assets/renderers/${name}.min.js`);
}
for (const page of ['index', 'post', 'archives', 'categories', 'category', 'tags', 'tag', 'single', 'photos', 'moments', 'links', 'plugin', 'error404']) {
  required.push(`templates/assets/js/${page}.min.js`, `templates/assets/css/${page}.min.css`);
}
for (const name of ['circle', 'cross_line', 'dot', 'hourglass']) {
  required.push(`templates/assets/plugins/loading/${name}.min.js`);
}
for (const name of required) {
  if (!zip.file(name)) throw new Error(`安装包缺少 ${name}`);
}

const zipNames = Object.keys(zip.files);
if (!zipNames.some(file => /^templates\/assets\/js\/chunks\/.+\.js$/.test(file))) {
  throw new Error('安装包缺少共享 ES Module chunks');
}
for (const dep of ['viewerjs', 'mermaid', 'chart.js', 'abcjs', 'dompurify', 'pace-js', 'echarts', 'tocbot', 'typed.js']) {
  const metadata = JSON.parse(await readFile(path.join(root, 'node_modules', dep, 'package.json'), 'utf8'));
  const prefix = `templates/assets/licenses/${dep.replaceAll('/', '-')}-${metadata.version}-`;
  if (!zipNames.some(file => file.startsWith(prefix))) {
    throw new Error(`安装包缺少第三方依赖许可：${dep}`);
  }
}

for (const name of zipNames) {
  if (!name.startsWith('templates/') && !required.includes(name)) throw new Error(`不允许打包 ${name}`);
  if (name.includes('..') || name.startsWith('/')) throw new Error(`非法路径 ${name}`);
  if (!(await zip.file(name).async('nodebuffer')).equals(await readFile(path.join(root, name)))) {
    throw new Error(`构建目录与安装包不一致：${name}`);
  }
  if (/^templates\/assets\/(?:js|renderers|plugins\/loading)\/.*\.js$/.test(name)) {
    if (/\bprocess\.env\.NODE_ENV\b/.test(await zip.file(name).async('string'))) {
      throw new Error(`浏览器脚本残留未解析的构建环境引用：${name}`);
    }
  }
  if (name.endsWith('.css') && /fonts\.(?:googleapis|gstatic)\.com/i.test(await zip.file(name).async('string'))) {
    throw new Error(`主题 CSS 不应依赖 Google Fonts：${name}`);
  }
}

const config = parse(await zip.file('settings.yaml').async('string'));
if (config.metadata.name !== theme.spec.settingName) throw new Error('Setting 标识不一致');
if (theme.metadata.name !== 'halo-butterfly-next' || theme.spec.configMapName !== 'halo-butterfly-next-configMap') {
  throw new Error('维护版必须使用独立标识');
}
if (!/^>=\d+\.\d+\.\d+$/.test(theme.spec.requires) || 'require' in theme.spec) {
  throw new Error('兼容版本声明必须只包含最低正式版本，如 >=2.20.2');
}

const layout = await zip.file('templates/views/layout.html').async('string');
if (!layout.includes('#theme.assets') || !layout.includes('core.min.css')) {
  throw new Error('布局必须加载 #theme.assets 与 core.min.css');
}
const publicLayout = await zip.file('templates/layout.html').async('string');
if (!/th:fragment="html\s*\(\s*head\s*,\s*content\s*\)"/.test(publicLayout)) {
  throw new Error('公共布局必须提供 html(head, content) 契约');
}
if (!publicLayout.includes('#theme.assets') || !publicLayout.includes('core.min.css')) {
  throw new Error('公共布局资源必须由当前主题解析并加载 core.min.css');
}
const protectedConfig = await zip.file('templates/views/config.html').async('string');
if (!protectedConfig.includes('data-config=') || !protectedConfig.includes('JsonUtils).objectToJson')) {
  throw new Error('安全配置数据传递缺失');
}
for (const file of Object.values(zip.files).filter(f => !f.dir && f.name.endsWith('.html'))) {
  const html = await file.async('string');
  if (/\bth:inline=(["'])javascript\1/i.test(html)) {
    throw new Error(`禁止使用不安全的 th:inline="javascript"：${file.name}`);
  }
  if (/\bth:attr="[^"]*T\(/.test(html)) {
    throw new Error(`th:attr 处于 Thymeleaf 3.1 受限表达式上下文，禁止直接调用 T(...)：${file.name}`);
  }
}

console.log(`安装包检查通过：${zipNames.length} 个文件，核心样式、ES Module 分块与所有页面资源齐全`);
