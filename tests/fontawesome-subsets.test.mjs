import { test, expect } from 'bun:test';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { appendIconSubsets } from '../scripts/fontawesome-subsets.mjs';

const upstream = path.resolve('node_modules/@fortawesome/fontawesome-free');
const subsets = path.resolve('src/fonts/fontawesome-subsets');

test('packaged small fonts retain complete original CSS and full-font failure paths', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'butterfly-icons-'));
  try {
    await mkdir(path.join(temporary, 'css')); await mkdir(path.join(temporary, 'webfonts'));
    await appendIconSubsets(upstream, subsets, temporary);
    const original = await readFile(path.join(upstream, 'css/all.min.css'), 'utf8');
    const css = await readFile(path.join(temporary, 'css/all.min.css'), 'utf8');
    expect(css.startsWith(original + '\n')).toBe(true);
    for (const [style, weight] of [['solid', 900], ['regular', 400], ['brands', 400]]) {
      expect(css).toContain(`src:url("../webfonts/butterfly-${style}.woff2") format("woff2"),url("../webfonts/fa-${style}-${weight}.woff2") format("woff2")`);
      expect(css).toContain(`url("../webfonts/fa-${style}-${weight}.woff2") format("woff2"),url("../webfonts/fa-${style}-${weight}.ttf") format("truetype")`);
      expect(await readFile(path.join(temporary, 'webfonts', `butterfly-${style}.woff2`))).toEqual(await readFile(path.join(subsets, `butterfly-${style}.woff2`)));
    }
    expect(css).toContain('font-family:var(--fa-style-family,"Butterfly Icons Free")');
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('a changed subset is rejected before it can silently enter a release', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'butterfly-icons-tamper-'));
  try {
    const copy = path.join(temporary, 'subsets'), dest = path.join(temporary, 'output');
    await cp(subsets, copy, { recursive: true });
    await mkdir(path.join(dest, 'css'), { recursive: true }); await mkdir(path.join(dest, 'webfonts'));
    await writeFile(path.join(copy, 'butterfly-solid.woff2'), 'invalid font');
    await expect(appendIconSubsets(upstream, copy, dest)).rejects.toThrow('FontAwesome subset changed');
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
