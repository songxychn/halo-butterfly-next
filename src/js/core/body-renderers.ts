import { enabled, resolveResource } from './external-resource.ts';
import { copyMathText } from './math.ts';
import { parseRendererJson, mermaidTheme } from './body-renderer-data.ts';
import type { BodyRendererConfig, BodyRenderer, RendererKind, RenderRequest } from './body-renderer-data.ts';
import { bindSvgViewer } from './svg-viewer.ts';

const labels: Record<RendererKind, string> = { mermaid: 'Mermaid', chartjs: 'Chart.js', abcjs: 'ABC 乐谱' };
const files = { mermaid: 'mermaid', chartjs: 'chartjs', abcjs: 'abcjs' };
const keys = { mermaid: 'mermaid', chartjs: 'chartjs', abcjs: 'abcjs_basic_js' };
const loads = new WeakMap<Document, Map<string, Promise<BodyRenderer>>>();
async function loadRenderer(kind: RendererKind, doc: Document) {
  const win = doc.defaultView!;
  if (win.ThemeBodyRenderers?.[kind]) return win.ThemeBodyRenderers[kind]!;
  const local = (win.MainApp.conf.assets_link || '/themes/halo-butterfly-next/assets/') + 'renderers/' + files[kind] + '.min.js';
  const source = resolveResource(keys[kind], local, win.MainApp.resources, win.MainApp.version, 'renderers/' + files[kind] + '.min.js');
  let cache = loads.get(doc); if (!cache) { cache = new Map(); loads.set(doc, cache); }
  if (cache.has(kind)) return cache.get(kind)!;
  const attempt = (url: string) => new Promise<BodyRenderer>((resolve, reject) => {
    const script = doc.createElement('script'); script.async = true; script.dataset.themeRenderer = kind;
    const finish = (success: boolean) => {
      clearTimeout(timer); script.onload = script.onerror = null;
      const api = win.ThemeBodyRenderers?.[kind];
      if (success && api) resolve(api); else { script.remove(); reject(new Error('渲染器加载失败')); }
    };
    let done = false;
    const settle = (success: boolean) => { if (done) return; done = true; finish(success); };
    const timer = setTimeout(() => settle(false), 12_000);
    script.onload = () => settle(true); script.onerror = () => settle(false); script.src = url; doc.head.append(script);
  });
  const promise = attempt(source).catch(error => source !== local ? attempt(local) : Promise.reject(error));
  cache.set(kind, promise);
  promise.catch(() => cache!.delete(kind));
  return promise;
}
interface RecordEntry {
  kind: RendererKind; shell: HTMLElement; source: HTMLElement; raw: string; output: HTMLElement;
  controls: HTMLElement; status: HTMLElement; details: HTMLDetailsElement; retry: HTMLButtonElement;
  params: string; hiddenDatasets: Set<number>; dispose?: () => void;
}
const bindings = new WeakMap<HTMLElement, () => void>();

/** Only explicit source containers in Post/SinglePage content are owned here. */
export function enhanceBodyRenderers(article: HTMLElement, config: BodyRendererConfig = {}) {
  if (bindings.has(article)) return bindings.get(article)!;
  const doc = article.ownerDocument, win = doc.defaultView!;
  let active = true, generation = 0;
  let queue = Promise.resolve();
  const records: RecordEntry[] = [], urls = new Set<string>();
  const ac = new AbortController();
  const add = (kind: RendererKind, shell: HTMLElement, source: HTMLElement, params = '') => {
    if (shell.querySelector('svg,canvas') || shell.closest('[data-theme-renderer]')) return;
    shell.dataset.themeRenderer = kind; shell.classList.add('theme-render-block');
    // Disabled and failed enhancements must expose even upstream hidden sources.
    const raw = source.textContent || ''; source.hidden = false; source.replaceChildren(doc.createTextNode(raw)); source.classList.add('theme-render-source', kind === 'mermaid' ? 'mermaid-src' : kind === 'chartjs' ? 'chartjs-src' : 'abcjs-src');
    const details = doc.createElement('details'); details.open = true;
    const summary = doc.createElement('summary'); summary.textContent = '查看 ' + labels[kind] + ' 源码';
    source.before(details); details.append(summary, source);
    const output = doc.createElement('div'); output.className = 'theme-render-output';
    const controls = doc.createElement('div'); controls.className = 'theme-render-controls';
    const status = doc.createElement('p'); status.className = 'theme-render-status'; status.setAttribute('role', 'status');
    const copy = doc.createElement('button'); copy.type = 'button'; copy.textContent = '复制源码';
    copy.addEventListener('click', async () => { const ok = await copyMathText(raw, doc); if (active) status.textContent = ok ? '已复制' : '复制失败，请选中源码复制'; }, { signal: ac.signal });
    const retry = doc.createElement('button'); retry.type = 'button'; retry.textContent = '重试'; retry.hidden = true;
    controls.append(copy, retry); shell.append(output, controls, status);
    const record: RecordEntry = { kind, shell, source, raw, output, controls, status, details, retry, params, hiddenDatasets: new Set() };
    records.push(record);
    retry.addEventListener('click', () => schedule(), { signal: ac.signal });
  };
  for (const kind of ['mermaid','chartjs','abcjs'] as const) {
    const selector = kind === 'mermaid' ? '.mermaid-wrap' : kind === 'chartjs' ? '.chartjs-container' : '.abc-music-sheet';
    for (const shell of article.querySelectorAll<HTMLElement>(selector)) {
      if (shell.closest('pre,code') || shell.querySelector('svg,canvas')) continue;
      let source = kind === 'abcjs' ? shell : shell.querySelector<HTMLElement>(':scope > pre.' + (kind === 'mermaid' ? 'mermaid-src' : 'chartjs-src'));
      if (!source) continue;
      const params = kind === 'mermaid' ? source.dataset.config || '' : shell.dataset.params || '';
      if (source === shell) { const raw = shell.textContent || ''; source = doc.createElement('pre'); source.textContent = raw; shell.replaceChildren(source); }
      add(kind, shell, source, params);
    }
    for (const code of article.querySelectorAll<HTMLElement>('pre > code.language-' + (kind === 'abcjs' ? 'abc' : kind) + (kind === 'mermaid' ? ',pre > code.mermaid' : ''))) {
      if (kind === 'mermaid' && !enabled(config.mermaid?.code_write)) continue;
      const pre = code.parentElement!;
      if (pre.closest('[data-theme-renderer]')) continue;
      const shell = doc.createElement('div'); shell.className = selector.slice(1);
      // Halo Shiki wraps code on the server and renders a shadow tree.
      // Detach only the renderer-owned input from that highlighter host.
      const shiki = pre.parentElement?.tagName === 'SHIKI-CODE' ? pre.parentElement : undefined;
      (shiki || pre).before(shell); shell.append(pre); shiki?.remove(); add(kind, shell, pre);
    }
  }
  const request = (record: RecordEntry): RenderRequest => {
    const mode = doc.documentElement.dataset.colorScheme === 'dark' ? 'dark' : 'light';
    const chart = config.chartjs;
    return { source: record.raw, params: record.params ? parseRendererJson(record.params) : {}, mode,
      theme: mermaidTheme(config.mermaid?.theme?.[mode], mode), hiddenDatasets: record.hiddenDatasets,
      colors: { font: chart?.fontColor?.[mode] || (mode === 'dark' ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.8)'),
        border: chart?.borderColor?.[mode] || (mode === 'dark' ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.1)'), backdrop: chart?.scale_ticks_backdropColor?.[mode] || 'transparent' },
    };
  };
  const render = async (record: RecordEntry, revision: number) => {
    if (!active || revision !== generation || !article.contains(record.shell)) return;
    record.dispose?.(); record.dispose = undefined;
    record.output.replaceChildren(); record.controls.querySelectorAll('[data-render-action]').forEach(node => node.remove());
    record.retry.hidden = true;
    if (!enabled(config[record.kind]?.enable)) { record.details.open = true; record.status.textContent = labels[record.kind] + ' 渲染已关闭'; record.shell.dataset.renderState = 'disabled'; return; }
    record.status.textContent = '正在渲染 ' + labels[record.kind] + '…'; record.shell.dataset.renderState = 'loading';
    let dispose: (() => void) | undefined;
    try {
      const options = request(record), api = await loadRenderer(record.kind, doc);
      if (!active || revision !== generation) return;
      dispose = await api.render(record.output, options);
      if (!active || revision !== generation) { dispose(); return; }
      const cleanups = [dispose];
      const renderUrls = new Set<string>();
      cleanups.push(() => { for (const url of renderUrls) { win.URL.revokeObjectURL(url); urls.delete(url); } });
      const svg = record.output.querySelector<SVGSVGElement>('svg');
      const actionControls = doc.createElement('span'); actionControls.dataset.renderAction = '';
      if (svg && record.kind === 'mermaid' && enabled(config.mermaid?.zoom_pan)) cleanups.push(bindSvgViewer(svg, actionControls));
      if (svg) {
        const exportButton = doc.createElement('button'); exportButton.type = 'button'; exportButton.textContent = '下载 SVG';
        const blobUrl = () => { const clone = svg.cloneNode(true) as SVGSVGElement; clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); const url = win.URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' })); urls.add(url); renderUrls.add(url); return url; };
        exportButton.addEventListener('click', () => { const a = doc.createElement('a'); a.href = blobUrl(); a.download = record.kind + '.svg'; a.click(); }, { signal: ac.signal }); actionControls.append(exportButton);
        if (record.kind === 'mermaid' && enabled(config.mermaid?.open_in_new_tab)) {
          const open = doc.createElement('a'); open.textContent = '新页查看'; open.target = '_blank'; open.rel = 'noopener noreferrer';
          open.href = blobUrl(); actionControls.append(open);
        }
      }
      record.controls.append(actionControls);
      record.dispose = () => { cleanups.reverse().forEach(fn => fn()); actionControls.remove(); };
      const width = record.shell.dataset.width;
      if (record.kind === 'chartjs' && width && /^\d+(?:\.\d+)?%$/.test(width) && parseFloat(width) > 0 && parseFloat(width) <= 100) record.output.style.width = width;
      if (!record.shell.dataset.renderedOnce) record.details.open = false;
      record.shell.dataset.renderedOnce = 'true'; record.status.textContent = ''; record.shell.dataset.renderState = 'rendered';
    } catch (error) {
      dispose?.(); record.output.replaceChildren();
      if (!active || revision !== generation) return;
      record.details.open = true; record.retry.hidden = false;
      record.status.textContent = labels[record.kind] + ' 渲染失败，源码已保留。' + (error instanceof Error ? error.message : '');
      record.shell.dataset.renderState = 'failed';
    }
  };
  function schedule() {
    const revision = ++generation;
    queue = queue.then(async () => { for (const record of records) await render(record, revision); }).catch(() => {});
  }
  const observer = new MutationObserver(() => schedule());
  if (records.length) { observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-color-scheme'] }); schedule(); }
  const cleanup = () => {
    active = false; ++generation; observer.disconnect(); ac.abort();
    for (const record of records) { record.dispose?.(); record.output.remove(); record.controls.remove(); record.status.remove(); record.details.before(record.source); record.details.remove(); delete record.shell.dataset.themeRenderer; delete record.shell.dataset.renderState; delete record.shell.dataset.renderedOnce; }
    for (const url of urls) win.URL.revokeObjectURL(url); urls.clear(); bindings.delete(article);
  };
  bindings.set(article, cleanup); return cleanup;
}
