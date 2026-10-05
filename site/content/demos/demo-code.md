# 代码展示与交互

适用：Halo Butterfly Next 0.1.0-alpha.3 预览内容。以下示例用于观察代码排版，不涉及服务器操作。

## 短代码

这段 JavaScript 根据数组生成一行文字。观察关键字、字符串、注释与行号；如果复制功能已启用，复制后应得到完整代码，而不带行号。

```javascript
// 用最少的内容观察不同语法颜色。
const sections = ['开始使用', '外观配置', '功能演示'];
const summary = sections.map((name, index) => `${index + 1}. ${name}`);
console.log(summary.join(' / '));
```

## 结构化数据

JSON 示例用于检查缩进与标点。这里是演示内容，不是可以直接导入 Halo 的配置文件。

```json
{
  "title": "湖边的一天",
  "published": false,
  "topics": ["阅读", "图片"],
  "cover": {
    "description": "蓝色山脊与湖面",
    "orientation": "landscape"
  }
}
```

## 较长的代码

下面按分类统计文章。检查展开或滚动后是否能看到最后的输出语句，复制时是否包含全部内容。

```javascript
const posts = [
  { title: '第一次使用主题', category: '使用文档' },
  { title: '首页配置', category: '使用文档' },
  { title: '导航配置', category: '使用文档' },
  { title: '正文排版', category: '功能演示' },
  { title: '图片阅读', category: '功能演示' },
  { title: '代码交互', category: '功能演示' },
];

function countByCategory(items) {
  const counts = new Map();
  for (const item of items) {
    const current = counts.get(item.category) ?? 0;
    counts.set(item.category, current + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count);
}

const result = countByCategory(posts);
for (const { category, count } of result) {
  console.log(`${category}：${count} 篇`);
}
```

## 长行

关闭自动换行时，尝试横向查看整行；开启时，检查折行是否影响阅读。这里没有远程请求。

```javascript
const note = '这是一条用于检查代码块长行表现的演示文字：让读者在手机上能够查看完整内容，同时保留语言标题、复制入口和清晰的键盘焦点，而不是把整个文章页面撑宽。';
console.log(note);
```

## Shell 文本

下面的命令只打印两行文字。它不安装软件，也不修改文件。

```bash
printf '%s\n' 'Halo Butterfly Next' '阅读、配置与演示'
```

## 对照设置

工具栏上的操作由主题配置决定；没有开启的功能不会因为文章里存在代码就自动出现。完整配置方法见[代码高亮与工具栏](../tutorials/code-blocks.md)。

测试复制时，先粘贴到临时编辑器观察；使用键盘移动到工具栏，确认焦点可见。切换深浅色后，再检查注释和字符串的对比度。
