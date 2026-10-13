import {pageScope} from './page-lifecycle.ts';
import {loadManagedResource, resolveResource} from './external-resource.ts';
export async function loadPageChart(kind: 'categories' | 'tags' | 'archives', data: [string, number][] = []) {
  const dom = document.querySelector<HTMLElement>('section.content > .chart');
  if (!dom) return false;
  const scope = pageScope();
  const file = 'js/charts.min.js';
  const local = (MainApp.conf.assets_link || '') + file + (MainApp.resources?.version === false ? '' : '?v=' + MainApp.version);
  const source = resolveResource('charts', local, MainApp.resources, MainApp.version, file);
  const loaded = window.themeCharts || await loadManagedResource(source, local, {attributes: {'data-theme-script':'charts','data-resource-key':'charts','data-resource-file':file},valid: () => Boolean(window.themeCharts)});
  if (!scope.active || !dom.isConnected) return false;
  if (!loaded || !window.themeCharts) { dom.hidden = true; return false; }
  try {
    if (kind === 'categories') window.themeCharts.renderCategories();
    else if (kind === 'tags') window.themeCharts.renderTags(data);
    else window.themeCharts.renderArchives();
    return true;
  } catch { dom.hidden = true; return false; }
}
