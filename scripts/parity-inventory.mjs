import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { parseDocument, isMap, LineCounter } from 'yaml';
import { parseSync } from '@babel/core';

export const UPSTREAM_COMMIT = 'f223b1888b42b2b336068e6c959ed90a3cd7c8f3';
export const UPSTREAM_VERSION = '5.7.0';
export const UPSTREAM_URL = 'https://github.com/jerryc127/hexo-theme-butterfly';
export const sha256 = text => createHash('sha256').update(text).digest('hex');

export async function filesBelow(root, directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const files = await Promise.all(entries.sort((a, b) => a.name.localeCompare(b.name, 'en')).map(entry => {
    const name = path.posix.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(root, name) : [name];
  }));
  return files.flat().sort();
}

// Nulls and empty collections are intentional configurable leaves. Arrays are
// one configurable value; their documented object members are tracked separately.
export function yamlLeaves(text, file) {
  const lineCounter = new LineCounter();
  const document = parseDocument(text, { lineCounter, uniqueKeys: true });
  if (document.errors.length) throw new Error(`${file}: ${document.errors.join('; ')}`);
  const result = [];
  function visit(node, prefix, keyNode = node) {
    if (isMap(node) && node.items.length) {
      for (const item of node.items) visit(item.value, [...prefix, String(item.key.value)], item.key);
    } else {
      result.push({ key: prefix.join('.'), value: node?.toJSON?.() ?? null,
        file, line: lineCounter.linePos(keyNode?.range?.[0] ?? 0).line });
    }
  }
  visit(document.contents, []);
  return result;
}

function literal(node) {
  if (node.type === 'NullLiteral') return null;
  if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral'].includes(node.type)) return node.value;
  if (node.type === 'UnaryExpression' && node.operator === '-') return -literal(node.argument);
  if (node.type === 'ArrayExpression') return node.elements.map(literal);
  throw new Error(`Unexpected executable default configuration: ${node.type}`);
}

export function defaultLeaves(text) {
  const ast = parseSync(text, { babelrc: false, configFile: false });
  const assignment = ast.program.body.find(statement => statement.expression?.type === 'AssignmentExpression');
  const result = [];
  function visit(node, prefix) {
    if (node.type === 'ObjectExpression' && node.properties.length) {
      for (const property of node.properties) {
        if (property.type !== 'ObjectProperty' || property.computed) throw new Error('Unsupported default property');
        visit(property.value, [...prefix, property.key.name ?? property.key.value]);
      }
    } else result.push({ key: prefix.join('.'), value: node.type === 'ObjectExpression' ? {} : literal(node),
      file: 'scripts/common/default_config.js', line: node.loc.start.line });
  }
  if (!assignment || assignment.expression.left.object?.name !== 'module' || assignment.expression.left.property?.name !== 'exports') {
    throw new Error('Cannot locate static module.exports default configuration');
  }
  visit(assignment.expression.right, []);
  return result;
}

function documentedConfig(text) {
  const lines = text.split(/\r?\n/);
  const result = [];
  // These public schemas are comments, not active YAML. Parse only the named
  // sections so prose such as "Choose:" cannot become a phantom option.
  let section = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const top = line.match(/^([A-Za-z_][\w]*):/);
    if (top) section = top[1];
    if (/^# theme_color:/.test(line)) section = 'theme_color';
    if (section === 'theme_color') {
      const match = line.match(/^#   ([\w]+):\s*(.*)$/);
      if (match) result.push({ key: `theme_color.${match[1]}`, value: parseDocument(match[2]).toJSON(), file: '_config.yml', line: i + 1 });
    }
    if (section === 'Open_Graph_meta' || section === 'CDN') {
      const match = line.match(/^    # ([\w]+):\s*$/);
      if (match) result.push({ key: `${section}.option.${match[1]}`, value: null, file: '_config.yml', line: i + 1 });
    }
  }
  return result;
}

function lineOf(text, index) { return text.slice(0, index).split('\n').length; }

export async function inspectUpstream(root) {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (commit !== UPSTREAM_COMMIT) throw new Error(`Upstream must be ${UPSTREAM_COMMIT}, got ${commit}`);
  execFileSync('git', ['diff', '--quiet', 'HEAD', '--'], { cwd: root });
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (packageJson.version !== UPSTREAM_VERSION) throw new Error('Unexpected upstream package version');
  const fileNames = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().split('\n').sort();
  const contents = new Map(await Promise.all(fileNames.map(async file => [file, await readFile(path.join(root, file))])));
  const read = file => contents.get(file).toString('utf8');
  const configuration = yamlLeaves(read('_config.yml'), '_config.yml');
  const defaults = defaultLeaves(read('scripts/common/default_config.js'));
  const documented = documentedConfig(read('_config.yml'));
  const tags = [];
  const helpers = [];
  const registrations = [];
  const frontMatter = new Map();
  const siteConfiguration = new Map();
  const templateFiles = fileNames.filter(file => file.startsWith('layout/') && file.endsWith('.pug'));
  for (const file of fileNames.filter(file => /^(scripts|layout)\//.test(file) && /\.(js|pug)$/.test(file))) {
    const text = read(file);
    for (const match of text.matchAll(/hexo\.extend\.(tag|helper)\.register\(\s*['"]([^'"]+)['"]/g)) {
      (match[1] === 'tag' ? tags : helpers).push({ key: match[2], file, line: lineOf(text, match.index) });
    }
    for (const match of text.matchAll(/hexo\.extend\.(filter|generator)\.register\(\s*['"]([^'"]+)['"]/g)) {
      registrations.push({ key: `${file}#${match[1]}:${match[2]}`, registration: match[2], type: match[1], file, line: lineOf(text, match.index) });
    }
    for (const match of text.matchAll(/hexo\.on\(\s*['"]([^'"]+)['"]/g)) {
      registrations.push({ key: `${file}#event:${match[1]}`, registration: match[1], type: 'event', file, line: lineOf(text, match.index) });
    }
    for (const match of text.matchAll(/(?<![\w./'"-])(?:hexo\.)?config\.([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*)/g)) {
      const key = match[1];
      if (!siteConfiguration.has(key)) siteConfiguration.set(key, []);
      const references = siteConfiguration.get(key);
      if (!references.some(reference => reference.file === file)) references.push({ file, line: lineOf(text, match.index) });
    }
    for (const match of text.matchAll(/\{([^{}]+)\}\s*=\s*(?:hexo\.)?config(?:\.([\w.]+))?\b/g)) {
      for (const part of match[1].split(',')) {
        const field = part.trim().split(/[:=]/)[0].trim();
        if (!/^[A-Za-z_]\w*$/.test(field)) throw new Error(`Unsupported site config destructuring in ${file}`);
        const key = match[2] ? `${match[2]}.${field}` : field;
        if (!siteConfiguration.has(key)) siteConfiguration.set(key, []);
        const references = siteConfiguration.get(key);
        if (!references.some(reference => reference.file === file)) references.push({ file, line: lineOf(text, match.index) });
      }
    }
    // This deliberately includes Hexo-generated page properties. The matrix
    // distinguishes a data contract from an author-editable front-matter key.
    for (const match of text.matchAll(/(?<![\w./'"-])page\.([A-Za-z_][A-Za-z_0-9]*)/g)) {
      const key = match[1];
      if (!frontMatter.has(key)) frontMatter.set(key, []);
      const references = frontMatter.get(key);
      if (!references.some(reference => reference.file === file)) references.push({ file, line: lineOf(text, match.index) });
    }
    for (const match of text.matchAll(/\{([^{}]+)\}\s*=\s*page\b/g)) {
      for (const part of match[1].split(',')) {
        const key = part.trim().split(/[:=]/)[0].trim();
        if (!/^[A-Za-z_]\w*$/.test(key)) throw new Error(`Unsupported page destructuring in ${file}`);
        if (!frontMatter.has(key)) frontMatter.set(key, []);
        const references = frontMatter.get(key);
        if (!references.some(reference => reference.file === file)) references.push({ file, line: lineOf(text, match.index) });
      }
    }
  }
  const resources = yamlLeaves(read('plugins.yml'), 'plugins.yml');
  const pluginNames = [...new Set(resources.map(item => item.key.split('.')[0]))];
  const plugins = pluginNames.map(key => ({ key, file: 'plugins.yml', line: resources.find(item => item.key.startsWith(`${key}.`)).line,
    properties: Object.fromEntries(resources.filter(item => item.key.startsWith(`${key}.`)).map(item => [item.key.slice(key.length + 1), item.value])) }));
  return {
    schemaVersion: 1,
    upstream: { repository: UPSTREAM_URL, version: UPSTREAM_VERSION, commit },
    files: fileNames.map(file => ({ file, sha256: sha256(contents.get(file)), lines: read(file).split('\n').length })),
    configuration, defaults, documented,
    templates: templateFiles.map(file => ({ key: file.replace(/^layout\//, '').replace(/\.pug$/, ''), file, line: 1 })),
    tags: tags.sort((a, b) => a.key.localeCompare(b.key, 'en')),
    helpers: helpers.sort((a, b) => a.key.localeCompare(b.key, 'en')),
    registrations: registrations.sort((a, b) => a.key.localeCompare(b.key, 'en')),
    pageProperties: [...frontMatter].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, references]) => ({ key, references })),
    siteConfiguration: [...siteConfiguration].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, references]) => ({ key, references })),
    plugins,
    localResources: fileNames.filter(file => /^source\/(js|img)\//.test(file)).map(file => ({ key: file, file, line: 1 })),
    styles: fileNames.filter(file => /^source\/css\//.test(file)).map(file => ({ key: file, file, line: 1 })),
    languages: fileNames.filter(file => /^languages\/.*\.yml$/.test(file)).map(file => ({ key: path.basename(file, '.yml'), file, line: 1 })),
  };
}

export function requiredEntries(inventory) {
  const result = [];
  const add = (kind, item, sourceType) => result.push({ kind, key: item.key, sourceType,
    source: { file: item.file, line: item.line, ...(kind === 'config' ? { key: item.key, defaultValue: item.value } : {}) } });
  const configuration = new Map();
  for (const [sourceType, items] of [['yaml', inventory.configuration], ['default', inventory.defaults], ['documented', inventory.documented]]) {
    for (const item of items) if (!configuration.has(item.key)) configuration.set(item.key, { item, sourceType });
  }
  for (const { item, sourceType } of configuration.values()) add('config', item, sourceType);
  for (const [kind, property] of [['template', 'templates'], ['tag', 'tags'], ['helper', 'helpers'], ['lifecycle-hook', 'registrations'], ['resource', 'plugins'], ['asset', 'localResources'], ['style', 'styles'], ['language', 'languages']]) {
    for (const item of inventory[property]) add(kind, item, property);
  }
  for (const item of inventory.pageProperties) result.push({ kind: 'page-data', key: item.key, sourceType: 'pageProperties', source: { ...item.references[0], key: `page.${item.key}` } });
  for (const item of inventory.siteConfiguration) result.push({ kind: 'site-config', key: item.key, sourceType: 'siteConfiguration', source: { ...item.references[0], key: `config.${item.key}` } });
  return result;
}

export const entryId = (kind, key) => `${kind}:${key}`;
