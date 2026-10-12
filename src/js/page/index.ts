import { pageScope } from '../core/page-lifecycle.ts';
/**
 * @date: 2023/10/8
 * @author: 小红
 * @fileName: index
 * @Description: 首页
 */
import $ from 'jquery';
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
      createTyped: (element, options) => {
        if (!scope.active) return;
        const typed = new Typed(element, options as TypedOptions);
        scope.add(() => typed.destroy());
        return typed;
      },
      requestRandom: (url, source) => new Promise((resolve, reject) => {
        $.ajax({
          url,
          type: 'get',
          // Treat external responses as data, including script-like content types.
          dataType: 'text',
          timeout: 5000,
          xhrFields: { withCredentials: source?.withCredentials === true },
          success: (body, _status, xhr) => resolve({ body, contentType: xhr.getResponseHeader('Content-Type') || '' }),
          error: () => reject(new Error('Random subtitle request failed')),
        });
      }),
    });
  }
}

App([Pagination])(Index);
