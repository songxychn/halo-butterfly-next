import { t } from '../core/i18n';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import { mermaidTheme } from '../core/body-renderer-data.ts';
import type { BodyRenderer } from '../core/body-renderer-data.ts';
let queue = Promise.resolve();
let sequence = 0;
const api: BodyRenderer = {
  render(output, request) {
    const task = queue.then(async () => {
      if (request.source.length > 50_000) throw new Error(t('ui.errorDiagramSize'));
      // Site configuration owns security. Author directives must not override it.
      if (/%%\s*\{|^\s*---/.test(request.source)) throw new Error(t('ui.errorDiagramConfig'));
      const allowed = new Set(['theme', 'flowchart', 'sequence']);
      if (Object.keys(request.params).some(key => !allowed.has(key))) throw new Error(t('ui.errorMermaidKey'));
      const flowchart = request.params.flowchart as Record<string, unknown> | undefined;
      const sequenceConfig = request.params.sequence as Record<string, unknown> | undefined;
      if (flowchart && (typeof flowchart !== 'object' || Object.keys(flowchart).some(key => !['curve','useMaxWidth','nodeSpacing','rankSpacing'].includes(key)))) throw new Error(t('ui.errorFlowchart'));
      if (sequenceConfig && (typeof sequenceConfig !== 'object' || Object.keys(sequenceConfig).some(key => !['showSequenceNumbers','mirrorActors','useMaxWidth'].includes(key)))) throw new Error(t('ui.errorSequence'));
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
