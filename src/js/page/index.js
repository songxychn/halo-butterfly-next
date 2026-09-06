/**
 * @date: 2023/10/8
 * @author: 小红
 * @fileName: index
 * @Description: 首页
 */
import $ from 'jquery';
import Typed from 'typed.js';
import App from '../core/App';
import Pagination from '../modules/Pagination';
import { runSubtitle } from '../modules/subtitle.mjs';

@App([Pagination])
class Index {
  /**
   * 打字机
   */
  run_typewriter() {
    return runSubtitle({
      element: document.querySelector('.above-subtitle--text'),
      config: MainApp.conf,
      createTyped: (element, options) => new Typed(element, options),
      requestRandom: url => new Promise((resolve, reject) => {
        $.ajax({
          url,
          type: 'get',
          // Treat external responses as data, including script-like content types.
          dataType: 'text',
          timeout: 5000,
          success: (body, _status, xhr) => resolve({ body, contentType: xhr.getResponseHeader('Content-Type') || '' }),
          error: () => reject(new Error('Random subtitle request failed')),
        });
      }),
    });
  }
}
