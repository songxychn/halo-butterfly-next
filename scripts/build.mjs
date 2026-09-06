import { cp, mkdir, readdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build as viteBuild } from 'vite';
import { transformAsync } from '@babel/core';
import * as sass from 'sass';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import autoprefixer from 'autoprefixer';
import JSZip from 'jszip';
import { parse } from 'yaml';

export const root = fileURLToPath(new URL('../', import.meta.url));
const stage = path.join(root, '.build/templates');
const assets = path.join(stage, 'assets');

export async function filesUnder(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(file));
    else if (entry.isFile()) files.push(file);
    else throw new Error(`不允许在主题包中包含符号链接：${file}`);
  }
  return files;
}

async function bundle(input, outputDir) {
  const name = path.basename(input, '.js');
  await viteBuild({
    configFile: false,
    logLevel: 'error',
    plugins: [{
      name: 'legacy-butterfly-decorators',
      enforce: 'pre',
      async transform(code, id) {
        if (!id.includes('/src/js/') || !id.endsWith('.js')) return;
        return transformAsync(code, {
          filename: id, babelrc: false, configFile: false,
          plugins: [['@babel/plugin-proposal-decorators', { legacy: true }]],
          sourceMaps: false,
        });
      },
    }],
    build: {
      outDir: outputDir, emptyOutDir: false, target: 'es2022',
      lib: { entry: input, name: `ButterflyNext_${name}`, formats: ['iife'], fileName: () => `${name}.min.js` },
    },
  });
}

async function build() {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const theme = parse(await readFile(path.join(root, 'theme.yaml'), 'utf8'));
  if (pkg.version !== theme.spec.version) throw new Error('package.json 和 theme.yaml 版本不一致');
  await rm(path.join(root, '.build'), { recursive: true, force: true });
  await mkdir(assets, { recursive: true });
  // Thymeleaf 的内联表达式包含注释。模板保持原文，不经过 HTML/JS 压缩器。
  await cp(path.join(root, 'src/html'), stage, { recursive: true });
  await cp(path.join(root, 'src/plugins'), path.join(assets, 'plugins'), {
    recursive: true, filter: source => !source.startsWith(path.join(root, 'src/plugins/loading')),
  });
  await cp(path.join(root, 'src/images'), path.join(assets, 'images'), { recursive: true });
  const icons = path.join(root, 'node_modules/@fortawesome/fontawesome-free');
  await mkdir(path.join(assets, 'plugins/fontawesome/css'), { recursive: true });
  await cp(path.join(icons, 'css/all.min.css'), path.join(assets, 'plugins/fontawesome/css/all.min.css'));
  await cp(path.join(icons, 'webfonts'), path.join(assets, 'plugins/fontawesome/webfonts'), { recursive: true });
  await cp(path.join(icons, 'LICENSE.txt'), path.join(assets, 'plugins/fontawesome/LICENSE.txt'));
  await mkdir(path.join(assets, 'licenses'), { recursive: true });
  const licensed = new Set();
  const readmeLicenses = new Set(['good-listener-1.2.2', 'delegate-3.2.0', 'select-1.1.2']);
  async function collectLicenses(dir) {
    dir = await realpath(dir);
    const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
    const name = `${pkg.name.replaceAll('/', '-')}-${pkg.version}`;
    if (licensed.has(name)) return;
    licensed.add(name);
    const entries = await readdir(dir);
    const files = entries.filter(file => /^(licen[sc]e|notice|copying)(?:\.|$)/i.test(file));
    if (!files.length && readmeLicenses.has(name) && pkg.license === 'MIT') {
      files.push(entries.find(file => /^readme/i.test(file)));
      await cp(path.join(root, 'third-party-licenses/zenorocha-MIT.txt'), path.join(assets, 'licenses/zenorocha-MIT.txt'));
    }
    if (!files.length || files.includes(undefined)) throw new Error(`依赖缺少许可证：${name}`);
    for (const file of files) await cp(path.join(dir, file), path.join(assets, 'licenses', name + '-' + file));
    if (entries.includes('licenses')) await cp(path.join(dir, 'licenses'), path.join(assets, 'licenses', name + '-additional'), { recursive: true });
    const require = createRequire(path.join(dir, 'package.json'));
    for (const dependency of Object.keys(pkg.dependencies || {})) {
      // 部分包不导出 package.json，从已解析的入口向上寻找其包目录。
      let cursor = path.dirname(require.resolve(dependency));
      while (true) {
        try {
          const metadata = JSON.parse(await readFile(path.join(cursor, 'package.json'), 'utf8'));
          if (metadata.name === dependency) break;
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
        const parent = path.dirname(cursor);
        if (parent === cursor) throw new Error(`无法定位依赖：${dependency}`);
        cursor = parent;
      }
      await collectLicenses(cursor);
    }
  }
  for (const name of ['@fancyapps/ui', 'animate.css', 'clipboard', 'echarts', 'jquery', 'tocbot', 'typed.js']) await collectLicenses(path.join(root, 'node_modules', name));
  await mkdir(path.join(assets, 'css'), { recursive: true });
  for (const file of (await readdir(path.join(root, 'src/scss/page'))).sort()) {
    if (!file.endsWith('.scss')) continue;
    const source = path.join(root, 'src/scss/page', file);
    const compiled = sass.compile(source, {
      style: 'compressed', loadPaths: [path.join(root, 'node_modules')],
      silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'legacy-js-api'],
    });
    const css = await postcss([postcssImport(), autoprefixer()]).process(compiled.css, { from: source });
    await writeFile(path.join(assets, 'css', file.replace('.scss', '.min.css')), css.css);
  }
  for (const file of (await readdir(path.join(root, 'src/js/page'))).sort()) {
    if (file.endsWith('.js')) await bundle(path.join(root, 'src/js/page', file), path.join(assets, 'js'));
  }
  for (const file of (await readdir(path.join(root, 'src/plugins/loading'))).sort()) {
    if (file.endsWith('.js')) await bundle(path.join(root, 'src/plugins/loading', file), path.join(assets, 'plugins/loading'));
  }
  await rm(path.join(root, 'templates'), { recursive: true, force: true });
  await rename(stage, path.join(root, 'templates'));
  const zip = new JSZip();
  const paths = ['theme.yaml', 'settings.yaml', 'annotation-setting.yaml', 'LICENSE'];
  paths.push(...(await filesUnder(path.join(root, 'templates'))).map(file => path.relative(root, file)));
  for (const file of paths.sort()) zip.file(file.replaceAll(path.sep, '/'), await readFile(path.join(root, file)), {
    date: new Date('1980-01-01T00:00:00Z'), createFolders: false,
  });
  await mkdir(path.join(root, 'dist'), { recursive: true });
  const target = path.join(root, 'dist', `${theme.metadata.name}-${pkg.version}.zip`);
  await writeFile(target, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }));
  console.log(`已构建 ${path.relative(root, target)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
  if (process.argv.includes('--watch')) {
    const { watch } = await import('chokidar');
    let timer;
    let queue = Promise.resolve();
    watch(['src', 'theme.yaml', 'settings.yaml', 'annotation-setting.yaml'], { cwd: root, ignoreInitial: true })
      .on('all', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          queue = queue.then(build).catch(error => console.error(error));
        }, 250);
      });
    console.log('正在监听主题源码');
  }
}
