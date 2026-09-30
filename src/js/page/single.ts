/**
 * @date: 2024/6/21
 * @author: 小红
 * @fileName: single
 * @Description: 自定义页面
 */

import App from '../core/App.ts';
import codeBlock from '../modules/CodeBlock.ts';
import Render from '../modules/Render.ts';
import AmplifyImg from '../modules/AmplifyImg.ts';

class Single {

}

App([Render, codeBlock, AmplifyImg])(Single);
