/**
 * @date: 2023/10/8
 * @author: 小红
 * @fileName: index
 * @Description: 首页
 */
import Typed from 'typed.js';
import type { TypedOptions } from 'typed.js';
import App from '../core/App.ts';
import Pagination from '../modules/Pagination.ts';
import { runSubtitle } from '../modules/subtitle.ts';

class Index {
  /**
   * 打字机
   */
  run_typewriter() {
    return runSubtitle({
      element: document.querySelector('.above-subtitle--text'),
      config: MainApp.conf,
      createTyped: (element, options) => new Typed(element, options as TypedOptions),
    });
  }
}

App([Pagination])(Index);
