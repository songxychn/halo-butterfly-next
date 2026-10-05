import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { checkSite } from './check.mjs';

const site = fileURLToPath(new URL('.', import.meta.url));
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function renderArticle(markdown, relativeFile, fileUrls, routes) {
  const headings = new Map();
  const resolveLink = href => {
    if (/^https?:\/\//.test(href)) {
      const url = new URL(href);
      if (url.username || url.password) throw new Error('Credentials in content URL');
      return href;
    }
    if (href.startsWith('/') && !href.startsWith('//') && Object.values(routes).includes(href.split(/[?#]/)[0])) return href;
    if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) throw new Error(`Unsupported content URL ${href}`);
    const relative = path.posix.normalize(path.posix.join(path.posix.dirname(relativeFile), href));
    const target = fileUrls[relative];
    if (!target || !target.startsWith('/') || target.startsWith('//')) throw new Error(`Unresolved content link ${relative}`);
    return target;
  };
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading(token) {
        const base = token.text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section';
        const count = (headings.get(base) ?? 0) + 1;
        headings.set(base, count);
        return `<h${token.depth} id="${escape(base + (count > 1 ? '-' + count : ''))}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
      },
      html(token) { return escape(token.text); },
    },
    walkTokens(token) {
      if (token.type === 'link' || token.type === 'image') token.href = resolveLink(token.href);
    },
  });
  return marked.parse(markdown.replace(/^# [^\n]+\n+/, ''));
}

export async function compile(mapping = {}) {
  await checkSite();
  const manifest = JSON.parse(await readFile(path.join(site, 'manifest.json'), 'utf8'));
  const fileUrls = {};
  const assets = JSON.parse(await readFile(path.join(site, manifest.assetsManifest), 'utf8'));
  for (const asset of assets.assets) fileUrls[asset.file] = `/site-assets/${asset.id}-${asset.sha256.slice(0, 16)}${path.posix.extname(asset.file)}`;
  for (const item of manifest.content) {
    if (!mapping[item.id]) throw new Error(`Missing Halo permalink for ${item.id}`);
    fileUrls[item.file] = mapping[item.id];
  }
  const content = [];
  for (const item of manifest.content) content.push({ id: item.id, html: renderArticle(await readFile(path.join(site, item.file), 'utf8'), item.file, fileUrls, manifest.routes) });
  return { content, fileUrls };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const mapping = JSON.parse(await readFile(process.argv[2], 'utf8'));
    console.log(JSON.stringify(await compile(mapping)));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
