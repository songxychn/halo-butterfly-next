/**
 * @date: 2024/5/23
 * @author: 小红
 * @fileName: tags
 * @Description: 标签
 */

import App from '../core/App.ts';
import {applyTagColors, tagCloudColors} from '../core/tag-cloud-colors.ts';
import {loadPageChart} from '../core/chart-loader.ts';

class Tags {

  // 渲染标签
  run_equinox() {
    const items = document.querySelectorAll<HTMLElement>('.tags .equinox  a.link');

    if(!items.length) return;

    const source: [string, number][] = [];

    for (let i = 0; i < items.length; i++) {

      const dom = items[i];

      const count = Number(dom.getAttribute('data-postCount') || 0);

      const colors = tagCloudColors(i);
      dom.style.setProperty('--tag-color-light', colors.light);
      dom.style.setProperty('--tag-color-dark', colors.dark);

      source.push([dom.innerText, count]);
    }

    applyTagColors([...items], MainApp.conf.appearance?.tag_custom_colors, true, MainApp.conf.appearance?.tag_ui !== 'chart');
    void loadPageChart('tags', source);
  }

}
App([])(Tags);
