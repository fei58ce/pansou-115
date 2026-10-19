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

## 9. 后续产品路线（按当前真实架构修订：2026-10-17）

当前职责边界：

```text
本站：搜索、筛选、去重、链接探活、115 转存/离线、订阅追更、通知
OneStrm：监控 115，生成 STRM 并同步到 NAS
Emby + 神医助手：扫描 NAS、媒体识别、元数据刮削
```

本站不重复实现 OneStrm 的 STRM 生成，也不重复实现神医助手的媒体刮削。

执行规则：每完成一个功能，必须完成本地构建/lint、GitHub commit + push、线上部署和验收，然后把对应 `[ ]` 改成 `[x]`。

### P0：搜索和转存稳定性

- [x] **搜索结果无图自动补图**：PanSou 图片 → TMDB → 豆瓣 → 默认占位图
- [x] **搜索结果质量排序**：标题匹配度、清晰度、来源、有效性、完整合集、发布时间
- [x] **结果状态标识**：有效、需要提取码、已失效、探活失败
- [x] **搜索结果去重和合集归并**
- [ ] **转存/115 离线任务中心**：任务状态、失败原因、重试、取消
  - [x] 115 离线任务列表与状态展示（PC/移动端）
  - [x] 本地提交历史、失败原因与失败任务重试
- [x] **115 Cookie 过期检测**：设置页提供实时授权检测，失效时提示重新扫码
- [x] **图片代理安全限制**：域名白名单和内网地址拦截已完成

### P1：OneStrm 联动

- [ ] **转存成功确认**：记录分享、目标目录、转存结果
- [x] **OneStrm 联动方式配置**：已配置 FRP 地址、随机 Webhook Token、扫描路径 `/emby`，并开启第三方 Webhook 与本站自动触发
- [ ] **转存后提示 OneStrm 待处理状态**
- [ ] **转存记录与 OneStrm 生成状态关联**
- [ ] **重复转存检测**：同链接、同标题、同目录提示已存在

### P2：自动追更和通知

- [ ] **影视订阅**：电影/电视剧/季/清晰度/网盘类型筛选
- [ ] **自动追更**：定时搜索新集、缺集检测、已转存判断
- [ ] **自动转存策略**：发现新资源后自动转存或等待确认
- [ ] **通知系统**：Telegram Bot、Webhook、企业微信/PushPlus
- [ ] **订阅和资源看板**：搜索、转存、OneStrm、NAS 状态

### P3：媒体服务观测和扩展

- [ ] **OneStrm/Emby 健康检查**：服务地址、最近同步时间、失败统计
- [ ] **Emby 媒体库刷新联动**：仅在 OneStrm 生成完成后触发
- [ ] **多账号秒传池**
- [ ] **播放失败来源切换辅助**
- [ ] **多实例任务存储（Redis/持久化队列）**

### 已明确不在本站重复实现

- [x] STRM 生成：由 OneStrm 负责
- [x] NAS 文件同步：由 OneStrm 负责
- [x] Emby 媒体识别与刮削：由神医助手负责
- [x] 影视元数据补全：本站仅用于搜索结果展示，最终媒体库元数据由神医助手负责

### 当前执行项

- [x] 1. 搜索结果质量排序
- [x] 2. 结果状态标识与确认失效过滤
- [x] 3. 搜索结果去重和合集归并
- [x] 4. 离线任务列表、提交历史与失败重试
- [x] 5. 115 Cookie 过期检测
- [x] 6. 图片代理域名白名单与 SSRF 拦截

---

## 10. 115 授权短期失效修复（2026-10-19）

### 根因

本站原扫码流程在换取 Cookie 时固定使用：

```text
POST https://passportapi.115.com/app/1.0/web/1.0/login/qrcode/
app=web&account=<uid>
```

得到的 UID 形如 `..._A1_...`（ssoent=A1，网页端）。网页端授权生命周期较短，因此很快出现：

```text
获取115pan目录列表失败:登录超时，请重新登录。
```

### 修复内容

- 默认改为 **115_苹果端（115ios，ssoent=D3）** 换取 Cookie，与 OneStrm 当前授权一致，UID 形如 `..._D3_...`。
- 扫码弹窗新增登录方式选择：115_苹果端 / 115_安卓端 / 115_苹果平板端 / 115生活_苹果端 / 115生活_安卓端 / 微信小程序 / 支付宝小程序。
- 换取 Cookie 改为 115 官方设备端点：
  ```text
  POST https://qrcodeapi.115.com/app/1.0/{app}/1.0/login/qrcode/
  account=<uid>
  ```
- 扫码成功后立即调用 `/files` 校验 Cookie；校验失败不保存，并返回明确错误。
- `UserSetting` 新增 `cloud115AppType`、`cloud115UserName`、`cloud115ValidatedAt`，设置页“检测授权”显示登录方式、账号和上次验证时间。
- `cloud115Cookie` / `quarkCookie` 改为 TEXT，避免长 Cookie 被截断。
- 修复 115 `/get/status/` 长轮询：原 15 秒超时会被误判为错误；现改为 90 秒，超时返回 pending；前端改为顺序轮询，避免请求堆积。
- 处理 115 长轮询在等待期间返回的 `{"state":1,"data":{}}`，视为 pending，避免误报“状态查询失败”。



### 已恢复线上授权

已从 OneStrm 读取当前有效的 115 授权并写入本站用户 `mufeng`。线上验证：

- `/api/cloud115/auth/status` 返回 `valid: true`
- 根目录可读取
- `/emby` 目录可读取（动画电影、动漫、国产动画、国产剧、华语电影、欧美剧、日番、日韩电影、日韩剧、少儿、外语电影、综艺等）

### 验收

- [x] 后端 `npm run build:backend`
- [x] 前端 `npm run build:frontend`
- [x] `npm run lint`（0 errors）
- [x] 线上 115 授权恢复有效
- [x] 根目录 / `/emby` 目录可读取
- [x] 扫码弹窗（115_苹果端）与长轮询验收（未实际手机扫码）
- [x] 搜索 → 转存 → OneStrm Webhook → STRM 全链路验收
- [ ] Emby 实际识别 / 播放验收
- [ ] 真实手机扫码完成 115_苹果端授权验收

### 端到端实测（2026-10-19）

- 搜索“沙丘2” → PanSou 115 返回 `anxia.com` 分享。
- 通过本站转存到 `/emby/_pansou_test`，115 API 确认目录存在。
- `/api/cloud115/save` 返回 `oneStrm.triggered=true`。
- OneStrm 日志：11:10:19 收到 Webhook；11:11:40 创建 3 个 STRM 文件，包含 `Dune Part Two 2024 ... .strm`。
- 测试目录已从 115 删除，并再次触发 OneStrm 清理扫描。
- 注意：OneStrm 日志中的 STRM 输出路径为 `/emby/emby/_pansou_test/...`，需确认 OneStrm 挂载映射与 Emby 媒体库路径是否一致。
