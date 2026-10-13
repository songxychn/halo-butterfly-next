import Chart from 'chart.js/auto';
import type { ChartConfiguration } from 'chart.js';
import { parseRendererJson, resolveChartTheme } from '../core/body-renderer-data.ts';
import type { BodyRenderer } from '../core/body-renderer-data.ts';
const api: BodyRenderer = {
  async render(output, request) {
    const config = resolveChartTheme(parseRendererJson(request.source), request.mode) as ChartConfiguration;
    if (!['bar','line','pie','doughnut','radar','polarArea','scatter','bubble'].includes(config.type) || !config.data || !Array.isArray(config.data.datasets) || !config.data.datasets.every(d => d && Array.isArray(d.data))) throw new Error('图表类型或数据格式无效');
    Chart.defaults.color = request.colors.font; Chart.defaults.borderColor = request.colors.border;
    Chart.defaults.scale.ticks.backdropColor = request.colors.backdrop;
    config.options = { ...config.options, responsive: true, animation: false };
    const wrap = output.ownerDocument.createElement('div'); wrap.className = 'chartjs-wrap';
    const canvas = output.ownerDocument.createElement('canvas'); canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', typeof request.params.title === 'string' ? request.params.title : '正文图表，数据见下方表格');
    wrap.append(canvas); output.append(wrap);
    const rows = Math.max(config.data.labels?.length || 0, ...config.data.datasets.map(d => d.data.length));
    if (rows * (config.data.datasets.length + 1) > 20_000) throw new Error('图表数据表过大');
    let chart: Chart;
    try { chart = new Chart(canvas, config); }
    catch (error) { Chart.getChart(canvas)?.destroy(); output.replaceChildren(); throw error; }
    try {
    const controls = output.ownerDocument.createElement('div'); controls.className = 'theme-render-controls';
    const table = output.ownerDocument.createElement('table');
    const caption = table.createCaption(); caption.textContent = '图表数据';
    const head = table.createTHead().insertRow();
    for (const text of ['项目', ...config.data.datasets.map((d, i) => d.label || '数据 ' + (i + 1))]) { const th = output.ownerDocument.createElement('th'); th.textContent = text; th.scope = 'col'; head.append(th); }
    const tbody = table.createTBody();
    for (let i = 0; i < rows; i++) {
      const row = tbody.insertRow(), label = output.ownerDocument.createElement('th'); label.scope = 'row';
      label.textContent = String(config.data.labels?.[i] ?? i + 1); row.append(label);
      for (const data of config.data.datasets) { const cell = row.insertCell(); const value = data.data[i]; cell.textContent = value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—'); }
    }
    for (let i = 0; i < config.data.datasets.length; i++) {
      const button = output.ownerDocument.createElement('button'); button.type = 'button';
      button.textContent = config.data.datasets[i].label || '数据 ' + (i + 1);
      if (request.hiddenDatasets.has(i)) chart.setDatasetVisibility(i, false);
      button.setAttribute('aria-pressed', String(chart.isDatasetVisible(i)));
      button.onclick = () => {
        const visible = !chart.isDatasetVisible(i); chart.setDatasetVisibility(i, visible);
        if (visible) request.hiddenDatasets.delete(i); else request.hiddenDatasets.add(i);
        button.setAttribute('aria-pressed', String(visible)); chart.update('none');
      };
      controls.append(button);
    }
    // Keep native canvas legend clicks and the accessible controls in sync.
    if (chart.options.plugins?.legend) {
      const original = chart.options.plugins?.legend?.onClick;
      if (chart.options.plugins?.legend) chart.options.plugins.legend.onClick = function(event, item, legend) {
        original?.call(this, event, item, legend);
        config.data.datasets.forEach((_, i) => { const visible = chart.isDatasetVisible(i); if (visible) request.hiddenDatasets.delete(i); else request.hiddenDatasets.add(i); controls.children[i].setAttribute('aria-pressed', String(visible)); });
      };
    }
    chart.update('none');
    const details = output.ownerDocument.createElement('details'), summary = output.ownerDocument.createElement('summary');
    summary.textContent = '查看图表数据'; details.append(summary, table); output.append(controls, details);
    return () => { chart.destroy(); output.replaceChildren(); };
    } catch (error) { chart.destroy(); output.replaceChildren(); throw error; }
  },
};
(window.ThemeBodyRenderers ??= {}).chartjs = api;
