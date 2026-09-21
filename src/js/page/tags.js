/**
 * @date: 2024/5/23
 * @author: 小红
 * @fileName: tags
 * @Description: 标签
 */

import App from '../core/App';
import * as echarts from 'echarts';
import {useChart} from '../core/_util';
import {tagCloudColors} from '../core/tag-cloud-colors.mjs';
import {LineChart, GaugeChart} from 'echarts/charts';
import {CanvasRenderer} from 'echarts/renderers';
import {TitleComponent, TooltipComponent, GridComponent, DataZoomComponent} from 'echarts/components';

// 注册所需的组件和渲染器
echarts.use([
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  CanvasRenderer,
  GaugeChart,
]);

@App([])
class Tags {

  // 渲染标签
  run_equinox() {
    const items = document.querySelectorAll('.tags .equinox  a.link');

    if(!items.length) return;

    const source = [];

    for (let i = 0; i < items.length; i++) {

      const dom = items[i];

      const count = Number(dom.getAttribute('data-postCount') || 0);

      const colors = tagCloudColors(i);
      dom.style.setProperty('--tag-color-light', colors.light);
      dom.style.setProperty('--tag-color-dark', colors.dark);

      source.push([dom.innerText, count]);
    }

    this.chart(source);
  }

  /***
   * @desc: 图表
   */
  chart(source) {

    const chartDom = document.querySelector('.tags .content > .chart');

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
          text: 'Top 10 标签统计 📌',
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
          name: '文章篇数',
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
          name: '标签统计',
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
                name: '最大值',
              }, {
                type: 'min',
                itemStyle: {
                  color: '#425aef',
                },
                name: '最小值',
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
                name: '平均值',
              },
            ],
          },
        },
      };
    });
  }
}
