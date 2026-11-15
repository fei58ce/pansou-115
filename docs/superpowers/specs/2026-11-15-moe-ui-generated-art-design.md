# 温柔线描生图素材接入设计

## 目标

为盘搜首页空状态和桌面搜索栏生成两张项目专用插画，让温柔线描视觉不只依赖 CSS 和既有素材，同时保留现有交互与动效节奏。

## 素材

- `cloudsaver-pansou/frontend/src/assets/moe/scene-empty-generated.webp`：宽幅空状态主视觉。暖白留白、棕色细线、灰粉/鼠尾草绿/杏色平涂，主体为拿放大镜的云朵助手、书堆和飘动纸张。
- `cloudsaver-pansou/frontend/src/assets/moe/mascot-search-generated.webp`：透明背景搜索栏吉祥物。云朵助手拿放大镜并挥手，适合 54px 高度展示。

两张素材由内置生图模型生成，再以 WebP 形式复制到项目；原始 PNG 保留在 Codex 生成目录，便于追溯。图片不包含文字、品牌标识或水印，页面文字仍由 Vue 组件渲染。

## 接入点

- 桌面资源页和移动资源页空状态使用新的宽幅主视觉。
- 桌面登录页右侧和移动登录页顶部使用新的宽幅主视觉，未登录用户也能直接看到本次生图素材。
- 桌面搜索栏使用新的透明吉祥物。
- 继续沿用 `moe-line-float` 动画和 `prefers-reduced-motion` 关闭策略。

## 验收与回退

- 本地构建、前端测试、lint、Playwright 桌面/移动视口通过。
- 线上页面应能加载两个新 WebP，空状态图片可见，搜索栏吉祥物不产生横向溢出。
- 回退时只需恢复三个 Vue 导入到原有 `scene-empty.webp` / `mascot-peek.webp`，删除新增 WebP，或切回发布前 Docker 镜像。
