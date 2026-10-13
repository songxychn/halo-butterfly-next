import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import { mermaidTheme } from '../core/body-renderer-data.ts';
import type { BodyRenderer } from '../core/body-renderer-data.ts';
let queue = Promise.resolve();
let sequence = 0;
const api: BodyRenderer = {
  render(output, request) {
    const task = queue.then(async () => {
      if (request.source.length > 50_000) throw new Error('图表源码过长');
      // Site configuration owns security. Author directives must not override it.
      if (/%%\s*\{|^\s*---/.test(request.source)) throw new Error('请在主题设置中配置图表，不使用 init 指令或配置 front matter');
      const allowed = new Set(['theme', 'flowchart', 'sequence']);
      if (Object.keys(request.params).some(key => !allowed.has(key))) throw new Error('不支持的 Mermaid 配置字段');
      const flowchart = request.params.flowchart as Record<string, unknown> | undefined;
      const sequenceConfig = request.params.sequence as Record<string, unknown> | undefined;
      if (flowchart && (typeof flowchart !== 'object' || Object.keys(flowchart).some(key => !['curve','useMaxWidth','nodeSpacing','rankSpacing'].includes(key)))) throw new Error('不支持的 flowchart 参数');
      if (sequenceConfig && (typeof sequenceConfig !== 'object' || Object.keys(sequenceConfig).some(key => !['showSequenceNumbers','mirrorActors','useMaxWidth'].includes(key)))) throw new Error('不支持的 sequence 参数');
      mermaid.initialize({ startOnLoad: false, htmlLabels: false, securityLevel: 'strict', suppressErrorRendering: true,
        theme: mermaidTheme(request.params.theme || request.theme, request.mode) as 'default', flowchart: { ...flowchart, htmlLabels: false }, sequence: sequenceConfig,
        secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'maxEdges', 'suppressErrorRendering', 'themeCSS', 'flowchart'],
      });
      const { svg } = await mermaid.render('theme-mermaid-' + (++sequence), request.source);
      output.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
      return () => { output.replaceChildren(); };
    });
    queue = task.then(() => {}, () => {});
    return task;
  },
};
(window.ThemeBodyRenderers ??= {}).mermaid = api;
