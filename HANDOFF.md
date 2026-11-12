# HANDOFF · 盘搜增强任务交接

> 更新时间：2026-11-12（订阅追更实现/测试交接快照）
> 工作区：`G:\work\盘搜`  
> 主工程：`cloudsaver-pansou/`（基于 CloudSaver + PanSou）

---

## 当前任务快照（2026-11-12，接手先看本节）

### 1）当前项目位置

- Git 仓库根目录：G:\work\盘搜
- 主工程：G:\work\盘搜\cloudsaver-pansou
- 后端：G:\work\盘搜\cloudsaver-pansou\backend
- 前端：G:\work\盘搜\cloudsaver-pansou\frontend
- 当前分支：main
- 线上地址：https://sou.aiapi.cfd
- 线上部署目录：/opt/pansou115（服务器138.2.98.41，SSH用户ubuntu，Docker操作需要sudo）
- 服务器不是Git检出目录，过去通过上传修改文件、docker compose build/up发布；发布时保留远端现有配置，不覆盖生产环境变量。

### 2）当前用户任务与已确认规则

实现“关注影片 → 自动发现新集 → 只补缺集至指定115目录 → 通知OneStrm”。

**固定调度：每天北京时间18:00一次，时区Asia/Shanghai；不是每30分钟。**

- 先检查用户选定的115分享及源目录，必要时补充搜索。
- “续集”本期指同作品同季的新集，不自动跨季，不把电影第二部当本期自动追更。
- 每条订阅绑定实际115账号及目标目录ID；目标丢失或账号变更不回退根目录。
- 默认“仅后续新增”，首次完整检查只建立源目录基线；也可主动选“补齐缺集”。
- 已有集跳过，不删除、不覆盖、不自动重命名用户视频。
- 关闭网页后仍在服务端执行，保留立即检查、编辑、暂停/恢复、记录查看。
- 不擅自创建真实影片订阅；当前没有替用户关注任何影片，也没有进行本次新功能的真实视频转存。

### 3）一句话进度（务必区分实现/测试/上线）

**主体代码已在本地完成，22项后端回归测试通过，前端构建通过，lint为0错误/21条既有警告；模拟环境的PC/手机关键流程已验收。当前功能代码尚未提交、推送或部署；生产功能不能认定已启用。**

最新已提交的业务配置为2d06b38（25个免登录TG频道）；当前HEAD为5e9b05b（订阅追更设计文档）。本快照的文档提交会在其后新增；不要把文档提交误当作功能发布。

### 4）本地已经完成

- [x] 用户确认方案、每日18:00时间及书面设计。
- [x] 纯规则：北京时间调度、115域名/分享解析、无损大整数JSON处理、明确季集识别、作品/年份/版本要求及文件去重。
- [x] 独立115适配器：分享与目标目录分页、子目录遍历上限、fid/cid区分、单文件转存、返回目录一致性检查。
- [x] SQLite新增四表：subscriptions、subscription_runs、subscription_entries、subscription_leases。
- [x] 持久化执行租约、运行队列、同一订阅同一自然日自动任务去重、手动/自动互斥。
- [x] “仅新增”基线与水位、补齐缺集、未知视频阻止误判、每轮最多新增10集。
- [x] 写请求发出前持久化uncertain；超时后查目标核实，不盲目重发；崩溃恢复先保留/核实账本。
- [x] 账号或目标目录异常暂停；编辑时拒绝有在途任务/未核实写入；目标目录重复绑定限制。
- [x] 搜索补充采用严格匹配；“仅新增”模式的搜索结果缺少可靠发布时间或早于关注时间时待确认，不补旧资源。
- [x] 转存核实成功后通知OneStrm；通知结果单独记账，不当成STRM生成成功；通知失败不重存视频。
- [x] 用户隔离API：列表、保存、手动检查、状态切换和历史查询。
- [x] PC/手机共用“我的追更”页面，导航、搜索结果卡片/表格“关注追更”入口。
- [x] 目录选择器补齐分页和大整数ID保护；前端网络错误兼容无response对象。

### 5）测试结果与证据

2026-11-12最新重跑结果：

- npm run test:subscriptions：**22项通过、0失败**，该命令包含后端tsc。
- npm run build:frontend：**通过**（vue-tsc + Vite + PWA生成）。
- npm run lint：**退出码0，0错误，21条既有warning**。
- git diff --check：无空白错误（Windows会提示LF/CRLF转换警告，不是构建失败）。

测试范围：18:00边界/UTC跨日、大整数ID、恶意分享域名、明确单集/合集/跨季、质量要求、同名续作、已有集、未知目标文件、仅新增基线、源读取失败、重复调度、权限隔离、并行租约、暂停、崩溃账本、转存超时实际成功/未成功、OneStrm失败不重复写盘、每轮10集上限、特殊字符标题、其他剧/季水位隔离、搜索发布时间不明。

模拟UI已验证：创建订阅 → 进入测试剧/Season 01 → 选择目录ID101 → 保存 → 显示北京时间18:00 → 立即检查 → 暂停后按钮禁用 → 恢复 → 查看检查记录。所有数据只在本地mock内存，不涉及真实115。

- 模拟服务：http://127.0.0.1:18088
- 启动命令（主工程下）：node frontend/tests/subscriptions-preview.cjs
- 模拟服务不能对外暴露，也不能当成生产后端使用。交接时已停止本轮mock服务；继续测试时用上述命令重启。
- 电脑测试：1280宽，无横向溢出。
- 手机测试：390×844，页面scrollWidth=390；编辑弹窗宽374px，无横向溢出。
- 截图位于C:\Users\admin\.codex\visualizations\2026\10\16\01a142ce-71f1-7361-a94f-0dd2f29407a5\subscriptions-desktop-test.png和subscriptions-mobile-test.png（模拟数据，非线上验收）。

### 6）当前卡住/尚未闭环

1. **没有发布，而非功能已上线**：改动仍在工作树，新增模块/测试有untracked文件，后续要显式加入提交。
2. **真实115只读适配校验未取得有效结果**：SSH简单命令可连到服务器，Docker容器列表能读取；但“PowerShell多行脚本管道 → ssh bash -s → docker exec -i node”的只读探测长时间无输出，已停止本轮该SSH进程。未拿到真实/files、/share/snap结构核对结果，不能声称实际增量转存已验收。改用临时脚本文件上传后执行，避免嵌套stdin/heredoc问题。
3. **原生Chrome CDP检查未顺利建立会话**：check-deps提示Chrome可能等待授权；没有擅自同意权限。改用可用的应用内浏览器完成本地UI测试。跨轮旧tab句柄可能报browser.user unavailable，创建新的临时标签后可继续。
4. **完整后端启动/生产迁移未验收**：模型与引擎使用隔离SQLite跑过集成测试，但尚未做实际服务冷启动、全站旧接口兼容、生产备份/回滚演练及上线后的调度核验。
5. **不确定转存的人工处理入口尚未提供**：账本会阻止重发，安全但需核实真实目标；不能通过清表或删除账本“重试”。
6. **匹配偏保守**：源文件/路径缺作品名或明确季集、字幕版本信息不全时进入待确认；目前是记录提示，没有单条待确认资源的人工批准转存入口。不要宣传为任何命名都能自动追更。
7. **STRM仍待核实**：本期只可靠展示OneStrm通知结果；没有逐文件STRM生成/Emby播放确认，不复用旧全盘日志模糊匹配认定成功。
8. **工作树出现.cursor/未跟踪目录**：不是本轮订阅功能生成的已确认文件，不读取/覆盖/删除，不使用git add -A误提交。

### 7）接下来按顺序做

- [ ] 1. 复核新增文件与差异，重点检查真实115响应字段、分页完整性、分享子目录、目标目录验证；只读验证不改媒体。
- [ ] 2. 使用临时测试数据库启动完整Express服务，验证鉴权与订阅路由、错误状态、SQLite初始化和旧功能兼容。
- [ ] 3. 重跑22项回归、前后端构建、lint；新增修复必须补测试。必要时检查手机CSS最终构建后布局。
- [ ] 4. 对“结果待核实/待确认”明确保留限制；若要完善人工核实入口，先设计安全确认，不默认重发。
- [ ] 5. 显式git add本功能文件/文档/测试，排除.cursor/、临时脚本、数据库、Cookie和任何密钥；提交并推送。
- [ ] 6. 线上停止/控制写入并做一致性SQLite备份、保留旧镜像与源码归档，准备回滚；不覆盖现有docker-compose及账号设置。
- [ ] 7. 构建发布，确认订阅路由/四张新表/启动日志/下次Asia/Shanghai 18:00；验证现有搜索转存页面未损坏。
- [ ] 8. 线上只读验收空订阅页；不要自动创建用户真实关注。真实转存验收需要明确专用订阅与专用目录，或由用户选择第一部影片后验收。
- [ ] 9. 更新本节状态、提交号和部署验收结论；没有完成的项继续保留未勾选。

### 8）踩过的坑/接手注意

- Windows本地sqlite3缺node_sqlite3.node：最初集成测试无法加载，已通过npm rebuild sqlite3修好；必要时使用本机代理。测试必须设置NODE_ENV=test与临时DATABASE_PATH，不能打开生产数据库跑destroy测试。
- 曾因字符串替换中$&被当成替换占位符，污染英文标题转义逻辑。现改为callback返回转义字符串，新增特殊字符标题测试，22项重跑通过；不要再用含$&的普通replace字符串批量改代码。
- 季集匹配曾把“第23集”误当季数，把E01后2160p误当范围，均已修复并回归。仅从明确Season/Sxx/第x季识别季数，不靠配置强行补到所有源文件。
- 别的作品/季的高集数不能抬高“仅新增”水位；已加作品与季过滤。无发布时间的搜索补充不能当成“关注后新增”。
- 115长ID必须原样字符串；JSON.parse已经舍入后String无法恢复。新适配器先解析数字token，既有目录选择也接入了同样保护。
- 分享读取旧版只首20条、目录旧版首50/100条、转存旧版仅fids[0]。追更走独立分页与逐文件适配器，不把整合集重存作为补集。
- 新Subscription模型导入会进入sequelize.models；旧DatabaseService的sync({alter:true})可能额外改新表。已改为legacy表按模型sync，Subscription四表单独sync；必须做完整冷启动回归。
- 单元测试和mock浏览器流程不能替代实际115/API验收；OneStrm HTTP成功也不等于生成STRM成功。
- 不是Codex提醒/自动化任务：每天18:00由项目后端运行，当前尚未部署，不存在已生效的日调度。
- 单个订阅每轮最多写10集，超出留给下一次检查；每日18:00是开始排队时间，不保证所有订阅18:00同时完成。
- 进程在18:00停机不补跑整轮，下一日18:00继续；用户可立即检查。持久化排队/在途记录要先核实，不能盲目重发。
- 首次“仅后续新增”只建基线，不存已有集；用户需要补旧集必须主动选择“补齐缺集”。

### 9）关键文件（全部位于主工程，未提交文件也要保留）

后端：
- backend/src/subscriptions/rules.ts：分享/时间/季集/身份/去重纯函数。
- backend/src/subscriptions/drive.ts：115分页遍历与单文件转存。
- backend/src/subscriptions/models.ts：四表与初始化。
- backend/src/subscriptions/engine.ts：配置校验、排队、租约、基线、转存与OneStrm通知。
- backend/src/subscriptions/routes.ts：/subscriptions及用户隔离接口。
- backend/src/app.ts：挂载路由、初始化表和调度启动。
- backend/src/services/DatabaseService.ts：避免legacy alter新表。
- backend/src/services/Cloud115Service.ts：目录选择分页及ID保护。
- backend/src/services/OneStrmService.ts：校验Webhook响应success。
- backend/tests/subscriptions.test.cjs：22项隔离测试。

前端：
- frontend/src/views/Subscriptions.vue：共用PC/手机追更页。
- frontend/src/api/subscriptions.ts、frontend/src/components/FollowButton.vue。
- frontend/src/components/Home/ResourceCard.vue、ResourceTable.vue和components/mobile/ResourceCard.vue：关注按钮。
- frontend/src/components/AsideMenu.vue、views/mobile/Home.vue、router/pc-routes.ts、router/mobile-routes.ts：入口/路由。
- frontend/tests/subscriptions-preview.cjs：只用模拟数据的预览服务。
- frontend/src/utils/request.ts：网络异常无response保护。

设计与计划：
- G:\work\盘搜\docs\superpowers\specs\2026-11-12-subscription-auto-sync-design.md
- G:\work\盘搜\docs\plans\2026-11-12-subscription-auto-sync.md

后续执行命令（在G:\work\盘搜\cloudsaver-pansou）：

    npm run test:subscriptions
    npm run build:backend
    npm run build:frontend
    npm run lint

**不要清理这些未提交/未跟踪功能文件；不要把本地mock服务或截图当成线上已发布证据。**

---

## 历史记录说明

以下原有章节保留供溯源，部分早期“当前任务”“待实测”状态已过时，当前工作以文首2026-11-12快照为准。

## 1. 历史需求记录（以文首最新快照为准）

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
- [x] **转存/115 离线任务中心**：任务状态、失败原因、重试
  - [x] 115 离线任务页仅展示本站提交记录（PC/移动端）
  - [x] 本地提交历史、失败原因与失败任务重试
- [x] **115 Cookie 过期检测**：设置页提供实时授权检测，失效时提示重新扫码
- [x] **图片代理安全限制**：域名白名单和内网地址拦截已完成

### P1：OneStrm 联动

- [ ] **转存成功确认**：记录分享、目标目录、转存结果
- [x] **OneStrm 联动方式配置**：已配置 FRP 地址、随机 Webhook Token、扫描路径 `/emby`，并开启第三方 Webhook 与本站自动触发
- [x] **OneStrm STRM 生成状态展示**：离线任务页显示最近 STRM 记录和匹配结果
- [ ] **转存后提示 OneStrm 待处理状态**
- [x] **离线任务与 OneStrm STRM 生成状态关联**（标题启发式匹配）
- [x] **转存 / 离线任务支持自定义名称与事后改名**
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
- [x] 7. 115 离线任务页仅展示本站提交记录（PC/移动端）

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


---

## 11. OneStrm STRM 状态联动（2026-10-19）

- 设置页新增 **OneStrm 管理账号 / 管理密码**，用于登录 OneStrm 管理后台读取日志（不是 Webhook Token）。
- 新增后端接口 `GET /api/onestrm/status`：
  - 自动登录 OneStrm，缓存 session Cookie；
  - 调用 `/get_log_updates?log_type=strm` 读取 STRM 日志；
  - 解析最近 `创建Strm 文件成功`、`完成生成Strm 文件`、`最终执行路径` 等日志。
- 115 离线任务页（PC / 移动端）新增：
  - OneStrm 连接状态、最近扫描、最近任务结果；
  - 最近 30 条 STRM 生成记录；
  - 每条本站离线记录显示 **STRM 已生成 / 待生成**，并按标题做启发式匹配。
- 注意：STRM 与离线任务目前是**按标题关键词匹配**，不是 115 taskId 精确关联；如果标题差异较大，可能显示“待生成”，但可以在“最近 STRM 生成记录”里直接确认。


---

## 12. 转存 / 离线任务改名（2026-10-19）

- 115 转存弹窗新增 **保存名称（可修改广告名）**：
  - 转存成功后按名称找到刚保存的文件/文件夹；
  - 调用 115 `/files/batch_rename` 重命名；
  - 改名失败不影响转存，会在返回结果里给出失败原因。
- 115 离线下载弹窗新增 **保存名称**：
  - 提交时保存到本地记录的 `renameTo`；
  - 任务完成后可在离线任务页点 **改名** 执行重命名。
- 115 离线任务页（PC / 移动端）新增 **改名** 按钮：
  - 后端新增 `POST /api/cloud115/lixian/rename`；
  - 会先查 115 离线任务状态，未完成会提示当前状态；
  - 完成后在目标目录按任务原名找到文件/文件夹并重命名；
  - 成功后同步更新本站记录名称。
- 保存到根目录时，自动兼容 115 默认的「云下载」目录。
- 数据库 `lixian_task_records` 新增 `renameTo`、`renameApplied`。

---

## 13. 影片订阅追更（2026-11-12，历史设计阶段；最新状态见文首）

用户已确认：固定分享优先、搜索补充，只补同作品同季的新集，保存到绑定的115目录，再通知OneStrm。

**调度：每天北京时间18:00一次，时区Asia/Shanghai；不启用每30分钟轮询。保留手动立即检查。**

书面设计：`docs/superpowers/specs/2026-11-12-subscription-auto-sync-design.md`。

- [x] 检查现有转存/目录/任务实现。
- [x] 确认方案与每日18:00调度。
- [x] 编写并自审设计规格。
- [ ] 用户复核书面规格。
- [ ] 实现订阅、目录绑定、增量识别和持久化去重。
- [ ] 实现每日调度、执行锁、异常恢复和手动检查。
- [ ] 实现PC/手机页面、OneStrm通知结果区分。
- [ ] 自动化测试与受控线上验收。
- [ ] GitHub提交推送及发布上线。

当前未创建用户影片订阅，未部署或启动自动追更，不将设计完成标记为功能完成。