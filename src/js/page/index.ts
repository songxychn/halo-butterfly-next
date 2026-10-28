import { pageScope } from '../core/page-lifecycle.ts';
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
    const scope = pageScope();
    return runSubtitle({
      element: document.querySelector('.above-subtitle--text'),
      config: MainApp.conf,
      isActive: () => scope.active,
      createTyped: (element, options) => {
        if (!scope.active) return;
        const typed = new Typed(element, options as TypedOptions);
        scope.add(() => typed.destroy());
        return typed;
      },
    });
  }
}

App([Pagination])(Index);
