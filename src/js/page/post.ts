/**
 * @date: 2024/3/17
 * @author: 小红
 * @fileName: post
 * @Description: 文章
 */

import App from '../core/App.ts';
import codeBlock from '../modules/CodeBlock.ts';
import Render from '../modules/Render.ts';
import AmplifyImg from '../modules/AmplifyImg.ts';

class Post {
  // 字数/时长由服务端 postMeta fragment 渲染，避免客户端覆盖。
}

App([Render, codeBlock, AmplifyImg])(Post);
