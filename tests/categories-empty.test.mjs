import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'bun:test';
import vm from 'node:vm';
import { t } from '../src/js/core/i18n.ts';

const transpiler = new Bun.Transpiler({loader: 'ts', target: 'browser'});

// Execute the page method with only its external browser/chart dependencies mocked.
const charts = await readFile(new URL('../src/js/page/charts.ts', import.meta.url), 'utf8');
const source = transpiler.transformSync(charts.slice(charts.indexOf('function renderCategories()'), charts.indexOf('function renderTags(')));

function run(chartDom, MainApp, useChart) {
  const component = {};
  vm.runInNewContext(`${source}\nrenderCategories();`, {
    MainApp, useChart, t,
    document: {querySelector: () => chartDom},
    echarts: {use() {}},
    PieChart: component, TitleComponent: component, TooltipComponent: component,
    GridComponent: component, DataZoomComponent: component, LegendComponent: component, CanvasRenderer: component,
  });
}

test('empty categories do not read chart data or initialize an absent element', () => {
  run(null, {get data() {throw new Error('Empty state must not consume chart data');}}, () => {
    assert.fail('Empty state must not initialize a chart or ResizeObserver');
  });
});

test('populated categories retain counts and labels in the chart', () => {
  const element = {};
  let calls = 0;
  run(element, {data: [
    {postCount: 3, spec: {displayName: '开发'}},
    {postCount: 0, spec: {displayName: '生活'}},
  ]}, (actualElement, options) => {
    calls++;
    assert.equal(actualElement, element);
    const series = options().series[0];
    assert.equal(series.type, 'pie');
    assert.deepEqual(JSON.parse(JSON.stringify(series.data)), [
      {value: 3, name: '开发'}, {value: 0, name: '生活'},
    ]);
  });
  assert.equal(calls, 1);
});
