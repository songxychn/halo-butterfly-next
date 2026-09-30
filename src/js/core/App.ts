/**
 * @date: 2024/3/30
 * @author: 小红
 * @fileName: App
 * @Description: 注册应用
 */

import {useClearPage} from '../core/_util.ts';
import Message from './_message.ts';
import Theme from './theme.ts';
import Scroll from './scroll.ts';
import Common from './common.ts';
/**
 * @desc: 注册应用
 * @returns function(*): *
 * @param modules
 */
export default function App(modules: (new () => import('../types.ts').ThemeModule)[] = []) {
  return function<T extends object>(target: new () => T) {
    Object.assign(window.MainApp, {
      useTheme: new Theme(), //主题
      useCommon: new Common(), // 公用逻辑
      useScroll: new Scroll(), //滚动导航侧边
      useMessage: new Message(), //滚动导航侧边
    });

    const ins = new target();

    const fns = Reflect.ownKeys(target.prototype);

    for (const key of fns) {
      if (typeof key !== 'string' || !key.startsWith('run_')) continue;
      const run = Reflect.get(ins, key) as unknown;
      if (typeof run === 'function') run.call(ins);
    }

    for (let i = 0; i < modules.length; i++) {
      const mods = new modules[i]();
      window.MainApp.modules[mods.name] = mods;
    }

    useClearPage();

    return ins;
  };
}
