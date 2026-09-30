/**
 * @date: 2024/6/19
 * @author: 小红
 * @fileName: categories
 * @Description: 分类
 */
import {useChart} from '../core/_util.ts';
import App from '../core/App.ts';
import * as echarts from 'echarts/core';

import {PieChart} from 'echarts/charts';
import {TitleComponent, TooltipComponent, GridComponent, DataZoomComponent, LegendComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';

// Use one ECharts type surface and register every option used by this page.
echarts.use([PieChart, TitleComponent, TooltipComponent, GridComponent, DataZoomComponent, LegendComponent, CanvasRenderer]);

class Categories {

  /**
   * 图表
   */
  run_chart() {
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
          text: '分类统计 📇',
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
            name: '分类统计',
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
}

App([])(Categories);
