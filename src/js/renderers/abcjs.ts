import { t } from '../core/i18n';
import { renderAbc } from 'abcjs';
import DOMPurify from 'dompurify';
import type { AbcVisualParams } from 'abcjs';
import type { BodyRenderer } from '../core/body-renderer-data.ts';
const api: BodyRenderer = {
  async render(output, request) {
    if (request.source.length > 50_000 || !/^\s*[A-Ga-gzZXKTML]:|^[A-Ga-gzZ]/m.test(request.source)) throw new Error(t('ui.errorScoreSource'));
    const tunes = renderAbc(output, request.source, { ...request.params, add_classes: true, responsive: 'resize', foregroundColor: request.mode === 'dark' ? '#eee' : '#222' } as AbcVisualParams);
    if (!tunes.length || !output.querySelector('svg') || !output.querySelector('.abcjs-note,.abcjs-rest')) { output.replaceChildren(); throw new Error(t('ui.errorScoreEmpty')); }
    output.innerHTML = DOMPurify.sanitize(output.innerHTML, { USE_PROFILES: { svg: true, svgFilters: true } });
    for (const svg of output.querySelectorAll('svg')) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', t('ui.scoreLabel')); }
    return () => { output.replaceChildren(); };
  },
};
(window.ThemeBodyRenderers ??= {}).abcjs = api;
