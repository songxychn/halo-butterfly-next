import { t } from '../core/i18n';
import * as echarts from 'echarts/core';
import {PieChart, BarChart, LineChart} from 'echarts/charts';
import {TitleComponent, TooltipComponent, GridComponent, DataZoomComponent, LegendComponent, DatasetComponent, TransformComponent, MarkPointComponent, MarkLineComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
import {pageListen, onPageCleanup} from '../core/page-lifecycle.ts';
import {useThrottle} from '../core/_util.ts';
echarts.use([PieChart, BarChart, LineChart, TitleComponent, TooltipComponent, GridComponent, DataZoomComponent, LegendComponent, DatasetComponent, TransformComponent, MarkPointComponent, MarkLineComponent, CanvasRenderer]);
/**
 *  图表渲染 支持浅色暗色
 * @param dom
 * @param getOption
 */
export function useChart(dom: HTMLElement, getOption: () => echarts.EChartsCoreOption) {
  const options = getOption();

  let es: echarts.ECharts | null = null;
  let alive = true;

  const fallback = dom.parentElement?.querySelector<HTMLElement>('.chart-fallback');
  const render = () => {
    if (!alive || !dom.isConnected) return;
    try {
      es?.dispose();
      es = echarts.init(dom, MainApp.useTheme.getMode());
      es.setOption(options);
      if (fallback) fallback.hidden = true;
    } catch {
      es?.dispose(); es = null;
      dom.hidden = true;
      if (fallback) fallback.hidden = false;
    }
  };
  const observer = new ResizeObserver(entries => {
    if (entries.some(entry => entry.contentRect.width > 0)) { render(); observer.disconnect(); }
  });
  observer.observe(dom);
  onPageCleanup(() => { alive = false; observer.disconnect(); es?.dispose(); });
  MainApp.useTheme.change(render);

  pageListen(window, 'resize', useThrottle(() => {
    es?.resize();
  }, 500));
}

function renderCategories() {
    const chartDom = document.querySelector<HTMLElement>('section.content > .chart');
    if (!chartDom) return;

    const categories = MainApp.data as import('../types.ts').Category[];
    const data: {value: number; name: string}[] = [];

    for (let i = 0; i < categories.length; i++) {

      const item = categories[i];

      data.push({value: item.postCount, name: item.spec.displayName});
    }

    useChart( chartDom, () => {
      return {
        backgroundColor: '',
        title: {
          text: t('ui.categoryChartTitle'),
          x: 'center',
        },
        tooltip: {
          formatter: '{a} <br/>{b} : {c} ({d}%)',
        },
        grid: {
          containLabel: true,
          bottom: '0%',
          left: '5%',
          right: '5%',
        },
        legend: {
          icon: 'circle',
          y: '95%',
          bottom: 'center',
        },
        series: [
          {
            name: t('ui.categoriesChart'),
            type: 'pie',
            radius: [40, 150],
            center: ['50%', '48%'],
            roseType: 'area',
            itemStyle: {
              borderRadius: 8,
            },
            label: {
              formatter: '{b} : {c} ({d}%)',
            },
            data,
          },
        ],
      };

    });
  }
function renderTags(source: [string, number][]) {

    const chartDom = document.querySelector<HTMLElement>('.tags .content > .chart');

    if(!chartDom) return;

    source = source.sort((a, b) => b[1] - a[1]);

    source = source.length >= 10 ? source.slice(0, 10) : source;

    useChart(chartDom, () => {
      return {
        color: 'null',
        backgroundColor: '',
        grid: {
          left: '5%', // 调整左边距
          right: '5%', // 调整右边距
        },
        title: {
          text: t('ui.tagChartTitle'),
          x: 'center',
        },
        dataset: [
          {
            dimensions: ['name', 'count'],
            source,
          }, {
            transform: {
              type: 'sort',
              config: {
                dimension: 'count',
                order: 'desc',
              },
            },
          },
        ],
        tooltip: {},
        xAxis: {
          type: 'category',
        },
        yAxis: {
          name: t('ui.postNumber'),
          type: 'value',
          splitLine: {
            show: !1,
          },
          axisTick: {
            show: !1,
          },
          axisLine: {
            show: !0,
          },
        },
        series: {
          name: t('ui.tagsChart'),
          type: 'bar',
          encode: {
            x: 'name',
            y: 'count',
          },
          datasetIndex: 1,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              {
                offset: 0,
                color: '#83bff6',
              }, {
                offset: .5,
                color: '#188df0',
              }, {
                offset: 1,
                color: '#188df0',
              },
            ]),
          },
          emphasis: {
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color: '#2378f7',
                }, {
                  offset: .7,
                  color: '#2378f7',
                }, {
                  offset: 1,
                  color: '#83bff6',
                },
              ]),
            },
          },
          markPoint: {
            symbolSize: 45,
            data: [
              {
                type: 'max',
                itemStyle: {
                  color: '#425aef',
                },
                name: t('ui.maximum'),
              }, {
                type: 'min',
                itemStyle: {
                  color: '#425aef',
                },
                name: t('ui.minimum'),
              },
            ],
          },
          markLine: {
            itemStyle: {
              color: '#425aef',
            },
            data: [
              {
                type: 'average',
                name: t('ui.average'),
              },
            ],
          },
        },
      };
    });
  }
function renderArchives() {
    const chartDom = document.querySelector<HTMLElement>('.archives .content > .chart');

    if(!chartDom) return;

    useChart( chartDom, () => {
      const data = [];

      for (let year of (MainApp.data as import('../types.ts').ArchiveYear[])) {
        for (let months of year['months']) {
          data.push([
            `${year['year']}-${months['month']}`,
            months['posts'].length,
          ]);
        }
      }

      return {
        color: ['#425aef'],
        title: {
          text: t('ui.archiveChart'),
          x: 'center',
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow',
            shadowStyle: {
              color: 'rgba(66,90,239,0.3)',
            },
          },
        },
        grid: {
          left: '5%', // 调整左边距
          right: '5%', // 调整右边距
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
        },
        yAxis: {
          name: t('ui.postUnit'),
          axisLine: {
            show: true,
          },
        },
        series: [
          {
            zlevel: 0,
            z: 2,
            name: t('ui.postNumber'),
            type: 'line',
            smooth: true,
            symbol: 'none',
            lineStyle: {
              color: '#425aef',
              width: 1,
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  {
                    offset: 0,
                    color: '#425aef', // 0% 处的颜色
                  },
                  {
                    offset: 1,
                    color: '#FFFFFF', // 100% 处的颜色
                  },
                ],
                global: false, // 缺省为 false
              },
            },
            data, // 这里需要填入实际的数据
          },
        ],
      };
    });
  }
window.themeCharts = {renderCategories, renderTags, renderArchives};
