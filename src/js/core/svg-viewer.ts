import { t } from './i18n';
export function zoomViewBox(box: number[], factor: number, x = .5, y = .5) {
  return [box[0] + box[2] * x * (1 - factor), box[1] + box[3] * y * (1 - factor), box[2] * factor, box[3] * factor];
}
/** SVG controls use native buttons and pointer capture; zoom is bounded. */
export function bindSvgViewer(svg: SVGSVGElement, controls: HTMLElement) {
  const initial = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (initial.length !== 4 || initial.some(n => !Number.isFinite(n)) || initial[2] <= 0 || initial[3] <= 0) return () => {};
  let box = initial.slice();
  const ac = new AbortController();
  const listeners = { signal: ac.signal };
  const pointers = new Map<number, { x: number; y: number }>();
  const apply = () => svg.setAttribute('viewBox', box.join(' '));
  const zoom = (factor: number, x = .5, y = .5) => {
    const nextWidth = box[2] * factor;
    if (nextWidth < initial[2] / 10 || nextWidth > initial[2] * 10) return;
    box = zoomViewBox(box, factor, x, y); apply();
  };
  const button = (label: string, action: () => void) => {
    const node = svg.ownerDocument.createElement('button');
    node.type = 'button'; node.textContent = label;
    node.addEventListener('click', action, listeners); controls.append(node);
  };
  button(t('ui.zoomIn'), () => zoom(.8)); button(t('ui.zoomOut'), () => zoom(1.25));
  button(t('ui.resetView'), () => { box = initial.slice(); apply(); });
  svg.classList.add('theme-svg-interactive'); svg.setAttribute('tabindex', '0');
  svg.setAttribute('aria-label', (svg.getAttribute('aria-label') || t('ui.mermaid')) + t('ui.svgKeys'));
  svg.addEventListener('keydown', event => {
    const moves: Record<string, number[]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[event.key]) { event.preventDefault(); box[0] += moves[event.key][0] * box[2] * .1; box[1] += moves[event.key][1] * box[3] * .1; apply(); }
    else if (['+', '=', '-','Home'].includes(event.key)) { event.preventDefault(); if (event.key === 'Home') { box = initial.slice(); apply(); } else zoom(event.key === '-' ? 1.25 : .8); }
  }, listeners);
  svg.addEventListener('wheel', event => {
    // Ordinary wheel scrolling stays available to readers; Ctrl/Meta-wheel zooms.
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault(); const rect = svg.getBoundingClientRect();
    zoom(event.deltaY > 0 ? 1.1 : 1 / 1.1, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  }, { ...listeners, passive: false });
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); svg.setPointerCapture(event.pointerId);
  }, listeners);
  svg.addEventListener('pointermove', event => {
    const old = pointers.get(event.pointerId); if (!old) return;
    const rect = svg.getBoundingClientRect();
    const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
    if (other) {
      const before = Math.hypot(old.x - other.x, old.y - other.y), after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (after > 0) zoom(before / after);
    } else { box[0] -= (event.clientX - old.x) * box[2] / rect.width; box[1] -= (event.clientY - old.y) * box[3] / rect.height; apply(); }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }, listeners);
  const release = (event: PointerEvent) => { pointers.delete(event.pointerId); if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId); };
  svg.addEventListener('pointerup', release, listeners); svg.addEventListener('pointercancel', release, listeners);
  return () => { for (const id of pointers.keys()) if (svg.hasPointerCapture(id)) svg.releasePointerCapture(id); pointers.clear(); ac.abort(); };
}
