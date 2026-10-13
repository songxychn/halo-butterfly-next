#!/usr/bin/env bun
/** Gallery-only DEC-02 offline conversion. Never parse Hexo tags in the theme. */
import { marked } from 'marked';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
function safeUrl(value) {
  const url = new URL(value, 'https://gallery.example.invalid/');
  if (!value || /[\u0000-\u0020\\]/.test(value) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('Invalid gallery URL');
  return value;
}
function groupArgs(value) {
  const tokens = value.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s]+/g) || [];
  if (tokens.length !== 4) throw Error('galleryGroup requires name, description, link and image (quote spaces)');
  return tokens.map(token => /^['"]/.test(token) ? token.slice(1, -1).replace(/\\(['"\\])/g, '$1') : token);
}
export function convertGallery(source) {
  if (Buffer.byteLength(source) > 4 * 1024 * 1024) throw Error('Input exceeds 4 MiB');
  // A documented tag inside a fenced code example is content, not a gallery.
  const protectedBlocks = [];
  let offset = 0;
  for (const token of marked.lexer(source)) {
    const index = source.indexOf(token.raw, offset);
    if (index < 0) continue;
    if (token.type === 'code') protectedBlocks.push({start:index,end:index+token.raw.length,raw:token.raw});
    offset = index + token.raw.length;
  }
  let masked = source;
  const prefix = '\u0000GALLERY_CODE_';
  if (source.includes(prefix)) throw Error('Invalid conversion input');
  protectedBlocks.forEach((block,i)=>{
    // Apply below in reverse order so offsets still refer to the original input.
    block.placeholder = prefix+i+'\u0000';
  });
  for(const block of [...protectedBlocks].reverse()) masked = masked.slice(0,block.start)+block.placeholder+masked.slice(block.end);
  const converted = masked.replace(/{%\s*(galleryGroup|gallery)\b([^]*?)%}([^]*?)(?={%\s*(?:galleryGroup|gallery)\b|$)/g, (whole, kind, argumentsText, tail) => {
    if (kind === 'galleryGroup') {
      const [name, description, href, image] = groupArgs(argumentsText.trim());
      return `<figure class="gallery-group"><img class="gallery-group-img no-lightbox" src="${escape(safeUrl(image))}" alt="${escape(name)}"><figcaption><div class="gallery-group-name">${escape(name)}</div><p>${escape(description)}</p><a href="${escape(safeUrl(href))}" aria-label="${escape(name || '查看相册')}"></a></figcaption></figure>` + tail;
    }
    const closing = /{%\s*endgallery\s*%}/.exec(tail);
    if (!closing) throw Error('gallery is missing endgallery');
    const content = tail.slice(0, closing.index);
    const remaining = tail.slice(closing.index + closing[0].length);
    const params = argumentsText.trim().split(',').map(x => x.trim());
    const remote = params[0] === 'url';
    if (remote) params.shift();
    const url = remote ? safeUrl(params.shift() || '') : '';
    const [button = 'false', limit = '10', first = '10'] = params;
    if (params.length > 3 || !['true', 'false', ''].includes(button) || !/^\d+$/.test(limit) || !/^\d+$/.test(first) || +limit < 1 || +first < 1 || +limit > 200 || +first > 200) throw Error('Invalid gallery button/limit/first arguments');
    const images = [];
    marked.walkTokens(marked.lexer(content), token => {
      if (token.type === 'image') images.push({url: safeUrl(token.href), alt: token.text || '', title: token.title || ''});
    });
    const data = remote ? url : JSON.stringify(images);
    return `<div class="gallery-container" data-type="${remote ? 'url' : 'data'}" data-button="${button || 'false'}" data-limit="${limit}" data-first="${first}"><div class="gallery-items">${escape(data)}</div></div>` + remaining;
  });
  return converted.replace(/\u0000GALLERY_CODE_(\d+)\u0000/g,(_,i)=>protectedBlocks[+i].raw);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output, ...rest] = process.argv.slice(2);
  if (!input || !output || rest.length) throw Error('Usage: bun scripts/gallery/convert.mjs INPUT OUTPUT (new file)');
  const html = convertGallery(await readFile(input, 'utf8'));
  await writeFile(output, html, {flag: 'wx', mode: 0o600});
  console.log('Gallery fragments converted; other Markdown/Hexo tags are preserved.');
}
