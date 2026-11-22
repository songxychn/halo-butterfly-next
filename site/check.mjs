import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';

const repository = await realpath(fileURLToPath(new URL('../', import.meta.url)));

/** Validate site manifest, links, assets, and theme-profile against settings.yaml. */
export async function checkSite(directory = path.join(repository, 'site')) {
  const site = await realpath(directory);
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  const json = async file => JSON.parse(await readFile(file, 'utf8'));
  const within = (base, file) => file === base || file.startsWith(base + path.sep);

  async function local(base, relative) {
    if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error(`Invalid local path: ${relative}`);
    const resolved = await realpath(path.resolve(base, relative));
    if (!within(base, resolved) || !(await stat(resolved)).isFile()) throw new Error(`File outside scope: ${relative}`);
    return resolved;
  }

  function unique(items, field, label) {
    const values = items.map(item => item[field]);
    expect(values.every(value => typeof value === 'string' && value.length > 0), `${label}: missing ${field}`);
    expect(new Set(values).size === values.length, `${label}: duplicate ${field}`);
  }

  const manifest = await json(await local(site, 'manifest.json'));
  const profile = await json(await local(site, manifest.themeProfile));
  const assets = await json(await local(site, manifest.assetsManifest));
  const pkg = await json(path.join(repository, 'package.json'));
  const theme = parse(await readFile(path.join(repository, 'theme.yaml'), 'utf8'));
  const settings = parse(await readFile(path.join(repository, 'settings.yaml'), 'utf8'));

  expect(manifest.baseline.themeId === theme.metadata.name, 'Theme identity differs from theme.yaml');
  expect(pkg.version === theme.spec.version, 'package.json and theme.yaml version mismatch');
  expect(profile.themeId === theme.metadata.name, 'Profile theme identity mismatch');

  for (const [label, entries] of [['content', manifest.content], ['categories', manifest.categories], ['tags', manifest.tags], ['assets', assets.assets]]) {
    unique(entries, 'id', label);
    if (label !== 'assets') unique(entries, 'slug', label);
  }
  unique(manifest.content, 'file', 'content');
  unique(assets.assets, 'file', 'assets');
  unique([...manifest.categories, ...manifest.tags], 'resourceName', 'taxonomy resources');

  const contentById = new Map(manifest.content.map(item => [item.id, item]));
  const categoryIds = new Set(manifest.categories.map(item => item.id));
  const tagIds = new Set(manifest.tags.map(item => item.id));
  const assetIds = new Set(assets.assets.map(item => item.id));
  const declaredFiles = new Set();
  const routePaths = new Set(Object.values(manifest.routes));
  for (const value of routePaths) expect(typeof value === 'string' && /^\/(?!\/)[^?#]*$/.test(value), `Invalid route: ${value}`);
  for (const item of [...manifest.content, ...assets.assets]) declaredFiles.add(await local(site, item.file));

  for (const asset of assets.assets) {
    const bytes = await readFile(await local(site, asset.file));
    if (asset.sha256) {
      expect(createHash('sha256').update(bytes).digest('hex') === asset.sha256, `${asset.id}: asset digest differs`);
    }
  }

  let links = 0;
  for (const item of manifest.content) {
    const file = await local(site, item.file);
    const markdown = await readFile(file, 'utf8');
    expect(markdown.startsWith(`# ${item.title}\n`), `${item.id}: title differs from manifest`);
    expect(/^hbn-site-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug), `${item.id}: invalid identity`);
    expect(['tutorials', 'demos', 'pages'].includes(item.section), `${item.id}: invalid section`);
    expect(item.kind === (item.section === 'pages' ? 'SinglePage' : 'Post'), `${item.id}: kind differs from section`);
    expect(typeof item.excerpt === 'string' && item.excerpt.length > 0, `${item.id}: missing excerpt`);
    expect(assetIds.has(item.coverAsset), `${item.id}: unknown cover`);
    for (const id of item.categories) expect(categoryIds.has(id), `${item.id}: unknown category ${id}`);
    for (const id of item.tags) expect(tagIds.has(id), `${item.id}: unknown tag ${id}`);
    const prose = markdown.replace(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm, '').replace(/`[^`\n]+`/g, '');
    expect(!/^```/m.test(prose), `${item.id}: unclosed code fence`);
    for (const match of prose.matchAll(/!?\[[^\]\n]*\]\(([^\s)]+)\)/g)) {
      links++;
      const target = match[1];
      if (/^https?:\/\//.test(target)) {
        const url = new URL(target);
        expect(!url.username && !url.password, `${item.id}: credentials in URL`);
      } else if (target.startsWith('/') && !target.startsWith('//')) {
        expect(routePaths.has(target.split(/[?#]/)[0]), `${item.id}: undeclared route ${target}`);
      } else if (!/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.startsWith('//')) {
        const clean = target.split(/[?#]/)[0];
        const linkedFile = await local(site, path.relative(site, path.resolve(path.dirname(file), clean)));
        expect(declaredFiles.has(linkedFile), `${item.id}: link is not managed content or asset: ${target}`);
      } else {
        errors.push(`${item.id}: unsupported URL ${target}`);
      }
    }
  }

  async function walk(dir) {
    const result = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlink not allowed: ${full}`);
      if (entry.isDirectory()) result.push(...await walk(full));
      else result.push(full);
    }
    return result;
  }
  for (const file of await walk(path.join(site, 'content'))) expect(declaredFiles.has(file), `Unlisted content file: ${path.relative(site, file)}`);

  function targetExists(target) {
    return target.type === 'content' ? contentById.has(target.key)
      : target.type === 'route' ? Object.hasOwn(manifest.routes, target.key)
      : target.type === 'category' ? categoryIds.has(target.key)
      : target.type === 'asset' ? assetIds.has(target.key)
      : target.type === 'manifest' ? target.key === 'footer'
      : target.type === 'publication' ? Object.hasOwn(manifest.publication, target.key) : false;
  }

  for (const item of [...manifest.navigation, ...manifest.footer]) {
    expect(Boolean(item.label) && typeof item.enabled === 'boolean' && targetExists(item.target), 'Invalid menu item');
    if (item.enabled && item.target.type === 'publication') {
      expect(/^https?:\/\//.test(manifest.publication[item.target.key] ?? ''), `${item.label}: missing public URL`);
    }
  }

  function validateFields(values, nodes, prefix) {
    for (const [key, value] of Object.entries(values)) {
      const node = nodes.find(field => field.name === key);
      if (!node) { errors.push(`Unknown theme setting ${prefix}.${key}`); continue; }
      if (node.$formkit === 'group') validateFields(value, node.children, `${prefix}.${key}`);
      else if (node.$formkit === 'repeater') {
        expect(Array.isArray(value), `${prefix}.${key}: expected array`);
        if (Array.isArray(value)) value.forEach(item => validateFields(item, node.children, `${prefix}.${key}`));
      } else if (Array.isArray(node.options)) {
        expect(node.options.some(option => option.value === value), `${prefix}.${key}: invalid option or type`);
      } else if (node.$formkit === 'checkbox') expect(typeof value === 'boolean', `${prefix}.${key}: expected boolean`);
      else if (node.$formkit === 'number') expect(typeof value === 'number' && Number.isFinite(value), `${prefix}.${key}: expected number`);
      else expect(typeof value === 'string', `${prefix}.${key}: expected string`);
    }
  }

  for (const [group, values] of Object.entries(profile.settings)) {
    const form = settings.spec.forms.find(item => item.group === group);
    if (form) validateFields(values, form.formSchema, group);
    else errors.push(`Unknown theme settings group ${group}`);
  }
  for (const binding of profile.bindings) {
    const [group, ...parts] = binding.path.split('.');
    let children = settings.spec.forms.find(item => item.group === group)?.formSchema;
    let field;
    for (const key of parts) { field = children?.find(item => item.name === key); children = field?.children; }
    expect(parts.length > 0 && Boolean(field) && targetExists(binding.target), `Invalid binding ${binding.path}`);
  }

  if (errors.length) throw new Error(errors.join('\n'));
  return { content: manifest.content.length, assets: assets.assets.length, links };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await checkSite(process.argv[2]), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
