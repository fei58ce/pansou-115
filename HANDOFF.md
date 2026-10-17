# HANDOFF · 盘搜增强任务交接

> 更新时间：2026-10-17（本轮续作后）  
> 工作区：`G:\work\盘搜`  
> 主工程：`cloudsaver-pansou/`（基于 CloudSaver + PanSou）

---

## 1. 当前任务（用户需求）

| # | 需求 | 状态 |
|---|------|------|
| 1 | **115 网盘授权改成二维码扫码** | ✅ 代码完成，待真实 App 扫码验收 |
| 2 | **榜单增加 TMDB** | ✅ 代码完成，需配置 `TMDB_API_KEY` |
| 3 | **搜索带出磁力 + 复制 / 115 离线** | ✅ 代码完成（含选目录），待联调 |

参考仓库结论：

| 项目 | 结论 |
|------|------|
| [PanSou](https://github.com/fish2018/pansou) | ✅ 已集成；官方支持 `magnet`/`ed2k` |
| [CloudSaver](https://github.com/jiangrui1994/CloudSaver) | 本仓库基底，已扩展扫码/TMDB/离线 |
| [panhub](https://github.com/wu529778790/panhub.shenzjd.com) | ❌ 不必再接，与 PanSou 能力重叠 |

---

## 2. 已完成内容

### 2.1 115 扫码登录

- 后端：`Cloud115QrcodeService`（正确接口 `qrcodeapi.115.com` + `passportapi.115.com`）
- 路由：`POST /api/cloud115/qrcode/init`、`GET /api/cloud115/qrcode/check`
- 前端：`Cloud115QrcodeLogin.vue`；PC / 移动端设置页均有入口
- 确认后自动写入 `UserSetting.cloud115Cookie`
- **本轮**：已 `npm install qrcode` + `@types/qrcode`；`tsc --noEmit` 通过

### 2.2 TMDB 榜单

- 后端 `TmdbService` / `TmdbController` + 环境变量
- 前端 PC/移动页面、菜单、点击标题跳转搜索
- **本轮修复**：详情 URL 错误（曾拼成 `/movie/movie-123`）→ 现为 `/movie/123`；`normalizeItem` 兼容 `all`

### 2.3 磁力搜索 + 115 离线

- PanSou 并行搜 `115` + `magnet`；TG 正则提取磁力
- TG 纯磁力消息过滤已放行（`cloudLinks || magnet || ed2k`）
- `Cloud115LixianService`：sign/time → `add_task_url`
- 前端「复制磁力」「115离线」按钮
- **本轮新增**：115 离线支持**选保存目录**
  - PC：`ResourceList.vue` 弹窗 + `FolderSelect`（可「根目录」或选中目录）
  - 移动：`mobile/ResourceList.vue` 底部弹层同样流程
  - 卡片/表格改为 `emit('lixian')`，由父组件统一提交

### 2.4 文档

- 根目录 `README.md` 已更新（扫码 / TMDB / 磁力离线）
- 本文件持续维护

---

## 3. 卡住 / 未闭环（接手优先看这里）

| 优先级 | 问题 | 说明 |
|--------|------|------|
| **P0** | 扫码登录未实测 | 需用真实 115 App 扫一遍，确认 Cookie 含 UID/CID/SEID，转存可用 |
| **P0** | 115 离线未实测 | 接口按公开实现写的，可能因风控/变更失败 |
| **P0** | 磁力搜索未实测 | 依赖 `pansou` 健康 + 出网；国内可能要给 PanSou 配 `PROXY` |
| **P1** | `TMDB_API_KEY` 为空 | `docker-compose.yml` 仍是 `""`，不配则榜单空 |
| **P1** | 扫码会话在内存 Map | 多副本/重启会「会话已失效」；单机 Docker 一般够用 |
| **P2** | 无离线任务列表页 | 后端已有 `GET /api/cloud115/lixian/tasks`，前端未做 |
| **P2** | 前端未跑完整 build | 本轮只验证了后端 `tsc`；前端改动需 `docker compose build` 或本地 vite 验证 |

---

## 4. 下一步计划（建议顺序）

```text
1. 填 TMDB_API_KEY → docker compose up -d --build
2. 设置页扫码登录 → 再测一次 115 转存
3. 搜索片名 → 看「PanSou · 磁力链接」→ 复制磁力 / 115离线选目录
4. 失败则看后端日志：扫码 token/status/passport；离线 sign/UID/error_msg
5. 可选：离线任务列表页；扫码会话改 Redis/文件（多实例时）
```

### 验收清单

- [ ] 扫码成功，设置页 Cookie 自动出现
- [ ] 用扫码 Cookie 转存 115 分享成功
- [ ] 搜索出现磁力分组，复制磁力成功
- [ ] 115 离线选目录后，115 网页离线列表出现任务
- [ ] TMDB 榜单有数据，点击跳转搜索

---

## 5. 踩过的坑

1. **115 扫码接口**：旧实现 `qrcode.115.com/...` 错误；正确为 `qrcodeapi.115.com` token + status，`passportapi.115.com` 换 cookie。状态：`0` 等待 / `1` 已扫 / `2` 确认 / `-1` 过期 / `-2` 取消。
2. **`BaseController` 必须 `return { data }`**，否则前端 `data` 为 `undefined`。
3. **前端 `request` 已解包一层**：业务拿到 `{ code, data, message }`，扫码 API 用 `assertOk`。
4. **类型名**：PanSou `115` ↔ 前端 `pan115`，store 内已映射。
5. **磁力双来源**：`item.magnet[]` 与 `cloudLinks` 中的 `magnet:`，统一用 `extractMagnets()`。
6. **Cookie 不能挂服务单例**，用 `getCookieFromRequest`。
7. **TMDB URL** 不要拼 `type-id` 双重前缀。
8. **依赖**：后端需要 `qrcode`；改后要重新 build 镜像。
9. **Windows PowerShell**：不支持 `&&`，用 `;` 或分两条命令。
10. **PC FolderSelect**：进入子目录才 `emit('select')`；根目录请点「保存到根目录」按钮。

---

## 6. 本轮改动文件（续作）

```
backend/src/services/TmdbService.ts          # URL + normalizeItem
backend/src/controllers/cloud115Qrcode.ts    # check 返回类型
backend/package.json / node_modules          # qrcode 依赖已装
frontend/src/components/Home/ResourceCard.vue
frontend/src/components/Home/ResourceTable.vue
frontend/src/components/mobile/ResourceCard.vue
frontend/src/views/ResourceList.vue          # 离线选目录弹窗
frontend/src/views/mobile/ResourceList.vue   # 移动端离线选目录
README.md                                    # 功能说明更新
HANDOFF.md                                   # 本文件
```

---

## 7. 关键文件速查

```
cloudsaver-pansou/backend/src/
  services/Cloud115QrcodeService.ts
  services/Cloud115LixianService.ts
  services/TmdbService.ts
  services/PansouSearcher.ts
  services/Searcher.ts
  controllers/cloud115Qrcode.ts | tmdb.ts | resource.ts
  routes/api.ts
  config/index.ts

cloudsaver-pansou/frontend/src/
  components/Cloud115QrcodeLogin.vue
  utils/magnet.ts
  views/Tmdb.vue | mobile/Tmdb.vue
  views/Setting.vue | mobile/Setting.vue
  views/ResourceList.vue | mobile/ResourceList.vue
  stores/resource.ts | tmdb.ts

docker-compose.yml
```

---

## 8. 一句话状态

**三项需求代码已齐（含 115 离线选目录、README、后端 tsc 通过）。接手只需：配 TMDB Key → rebuild → 用真实账号验收扫码 / 磁力 / 离线。**

---

## 9. 后续产品路线（2026-10-17 起）

执行规则：每完成一个功能，必须完成本地构建/lint、GitHub commit + push、线上部署和验收，然后把对应 `[ ]` 改成 `[x]`。

### P0：先把当前搜索器打磨稳定

- [ ] **搜索结果无图自动补图**：PanSou 图片 → TMDB → 豆瓣 → 默认占位图
- [ ] **搜索结果质量排序**：标题匹配度、清晰度、来源、有效性、完整合集、发布时间
- [ ] **结果状态标识**：有效、需要提取码、已失效、探活失败
- [ ] **转存/115 离线任务中心**：任务状态、进度、失败原因、重试、取消
- [ ] **115 Cookie 过期检测**：自动提示重新扫码或授权
- [ ] **图片代理安全限制**：域名白名单、内网地址拦截、响应大小限制、请求限流

### P1：影视库自动化

- [ ] **115 文件扫描与影视识别**：电影/电视剧/季/集/年份/清晰度
- [ ] **自动整理**：重命名、创建目录、移动文件、整理历史、失败重试
- [ ] **元数据下载**：海报、背景图、简介、演员、字幕语言
- [ ] **Emby/Jellyfin 刷新**：整理完成后自动刷新媒体库
- [ ] **115 STRM 生成**：支持分享链接、文件 ID、播放地址和路径替换

### P2：自动追更和通知

- [ ] **影视订阅**：电影/电视剧/季/清晰度/网盘类型筛选
- [ ] **自动追更**：定时搜索新集、缺集检测、已转存判断
- [ ] **自动转存策略**：发现新资源后自动转存或等待确认
- [ ] **通知系统**：Telegram Bot、Webhook、企业微信/PushPlus
- [ ] **订阅和资源看板**：入库状态、缺集状态、转存状态、失败任务

### P3：媒体服务增强

- [ ] **Emby 302/反代播放辅助**
- [ ] **预缓存和播放缓存**
- [ ] **多账号秒传池**
- [ ] **播放失败自动切换来源**
- [ ] **多实例任务存储（Redis/持久化队列）**

### 本轮执行项

- [ ] 1. 搜索结果无图自动补图（TMDB 优先，豆瓣兜底）
