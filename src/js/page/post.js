/**
 * @date: 2024/3/17
 * @author: 小红
 * @fileName: post
 * @Description: 文章
 */

import App from '../core/App';
import codeBlock from '../modules/CodeBlock';
import Render from '../modules/Render';
import AmplifyImg from '../modules/AmplifyImg';

@App([Render, codeBlock, AmplifyImg])
class Post {
  // 字数/时长由服务端 postMeta fragment 渲染，避免客户端覆盖。
}
