/**
 * @date: 2024/5/23
 * @author: 小红
 * @fileName: tags
 * @Description: 标签
 */

import App from '../core/App.ts';
import { initializeTagCloud } from '../core/listing-options.ts';
import { applyTagColors } from '../core/tag-cloud-colors.ts';
import { loadPageChart } from '../core/chart-loader.ts';

class Tags {
  run_equinox() {
    const container = document.querySelector<HTMLElement>('[data-tag-cloud]');
    if (!container) return;
    const customizedFont = container.dataset.minFont !== '12' || container.dataset.maxFont !== '21' || container.dataset.unit !== 'px';
    const items = initializeTagCloud(container, MainApp.conf.appearance?.tag_ui !== 'chart' || customizedFont);
    if (!items.length) return;

    const source: [string, number][] = Array.from(items, (dom) => [
      dom.innerText,
      Number(dom.getAttribute('data-postCount') || 0),
    ]);

    applyTagColors([...items], MainApp.conf.appearance?.tag_custom_colors, true, false);
    void loadPageChart('tags', source);
  }
}
App([])(Tags);
