import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const theme = parse(await readFile(path.join(root, 'theme.yaml'), 'utf8'));
const zip = await JSZip.loadAsync(await readFile(path.join(root, 'dist', `${theme.metadata.name}-${pkg.version}.zip`)));
const required = ['theme.yaml', 'settings.yaml', 'annotation-setting.yaml', 'LICENSE', 'templates/index.html', 'templates/post.html'];
required.push('templates/assets/images/above.svg', 'templates/assets/plugins/fontawesome/LICENSE.txt', 'templates/assets/plugins/prism/LICENSE');
for (const page of ['index', 'post', 'archives', 'categories', 'category', 'tags', 'tag', 'single', 'photos', 'moments', 'links']) {
  required.push(`templates/assets/js/${page}.min.js`, `templates/assets/css/${page}.min.css`);
}
for (const name of ['circle', 'cross_line', 'dot', 'hourglass']) required.push(`templates/assets/plugins/loading/${name}.min.js`);
for (const name of required) if (!zip.file(name)) throw new Error(`安装包缺少 ${name}`);
for (const name of Object.keys(zip.files)) {
  if (!name.startsWith('templates/') && !required.includes(name)) throw new Error(`不允许打包 ${name}`);
  if (name.includes('..') || name.startsWith('/')) throw new Error(`非法路径 ${name}`);
  if (name.startsWith('templates/assets/font/') || name.endsWith('/above.png')) throw new Error(`旧版来源未核实的素材不应进入安装包：${name}`);
  if (!(await zip.file(name).async('nodebuffer')).equals(await readFile(path.join(root, name)))) throw new Error(`构建目录与安装包不一致：${name}`);
}
const config = parse(await zip.file('settings.yaml').async('string'));
if (config.metadata.name !== theme.spec.settingName) throw new Error('Setting 标识不一致');
if (theme.metadata.name !== 'halo-butterfly-next' || theme.spec.configMapName !== 'halo-butterfly-next-configMap') throw new Error('维护版必须使用独立标识');
if (theme.spec.requires !== '>=2.26.1 & <2.27.0' || 'require' in theme.spec) throw new Error('兼容版本声明错误');
const layout = await zip.file('templates/views/layout.html').async('string');
if (!layout.includes('#theme.assets')) throw new Error('资源必须由当前主题解析');
if (!(await zip.file('templates/views/config.html').async('string')).includes('/*[[')) throw new Error('Thymeleaf 内联表达式丢失');
console.log(`安装包检查通过：${Object.keys(zip.files).length} 个文件，所有页面和 Loading 资源齐全`);
