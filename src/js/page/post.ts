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
import { initializeShare } from '../core/share.ts';
import { initializePostEdit } from '../core/post-edit.ts';

class Post {
  run_reading() {
    initializeShare();
  }
  run_postEdit() {
    void initializePostEdit();
  }
}

App([Render, codeBlock, AmplifyImg])(Post);
