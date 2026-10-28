# 导航与加载

当前主题使用浏览器原生整页导航。PJAX、预取、脚本重放和手工历史恢复已按 [DEC-10](parity/DEC-10-THEME-SCOPE.md) 删除；旧 `pjax` 和 `loading.instantpage` 配置不再生效。

保留菜单、分页链接、目录锚点及页面内滚动。文章和单页访问追踪交给 Halo。后退/前进使用浏览器自身行为。

`loading.enable` 控制加载效果；默认 `loading.mode: pace` 是非阻塞进度，选择 `animation` 使用 Loading 动画。Pace 资源失败时正文仍可阅读。减少动态效果偏好继续生效。

历史 PJAX 验证仅对应旧包，不是当前产品能力清单。
