/**
 * @date: 2024/6/19
 * @author: 小红
 * @fileName: categories
 * @Description: 分类
 */
import {useChart} from '../core/_util';
import App from '../core/App';
import * as echarts from 'echarts';
import {PieChart} from 'echarts/charts';
import {TitleComponent, TooltipComponent, GridComponent, DataZoomComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';

// 注册所需的组件和渲染器
echarts.use([
  PieChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

@App([])
class Categories {

  /**
   * 图表
   */
  run_chart() {
    const chartDom = document.querySelector('section.content > .chart');
    if (!chartDom) return;

    const data = [];
    
    for (let i = 0; i < MainApp.data.length; i++) {

      const item = MainApp.data[i];

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
 
 
