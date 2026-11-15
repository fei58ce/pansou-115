# HANDOFF · 盘搜增强任务交接

> 更新时间：2026-11-15（订阅追更、搜索图片修复、豆瓣榜单超时修复、搜索分组排序、搜索提速、UI改版、115资源汇总置顶、温柔线描UI改版、115汇总补海报修复、温柔线描可访问性精修、图片轻动效与生图素材均已上线）
> 工作区：`G:\work\盘搜`  
> 主工程：`cloudsaver-pansou/`（基于 CloudSaver + PanSou）

---

## 当前任务快照（2026-11-13，接手先看本节）

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

**订阅追更与搜索图片修复已提交、推送，并于2026-11-12 08:54Z（北京时间16:54）部署上线；启动日志、四张新表、旧表行数、接口鉴权、白名单外图床图片均已在线上核验。线上目前0条订阅，尚未做真实115转存验收；没有订阅时18:00调度不会转存任何内容。登录后的页面验收待用户确认。**

同日09:41Z（北京时间17:41）第二次上线：豆瓣榜单超时修复，以及搜索分组排序（PanSou · 115网盘在最前，PanSou · 磁力链接在最后），线上已核验，见第5节。

同日12:26Z（北京时间20:26）第三次上线：搜索提速、TG频道「加载更多」修复、静态资源gzip与缓存头、豆瓣Cookie改为环境变量并修好豆瓣补海报。核验时发现115探活超时被设成12秒，线上探活慢时会被截断、坏链漏过滤；13:09Z（北京时间21:09）第四次上线，把探活超时恢复为30秒。两次均已在线上核验，见第5节。

同日15:09Z（北京时间23:09）第五次上线：UI改版（方案B：统一设计变量，重做搜索、豆瓣、登录和布局）、Element Plus按需加载、删掉3.3MB无用图片和socket.io-client、补上PWA图标；优化清单5–9（115探活按链接缓存、TG频道顺序与5分钟分页缓存、豆瓣榜单启动预热、tini与优雅停机、镜像从559MB瘦身到217MB）。已在线上核验，见第5节。用户随后提出：搜索结果和搜索页默认展示都要让115资源靠前，见第7节第11项。

同日16:17Z（北京时间11月13日00:17）第六次上线：115资源汇总置顶（用户选方案C）。搜索结果和搜索页默认展示的最上面多一组「115 资源汇总」：PanSou的115结果在前，后面是各TG频道里带115链接的消息（按发布时间新→旧），按分享码去重并标出来源；原来单独的「PanSou · 115网盘」分组并入汇总。顺带修掉频道标签显示成「##」的问题。只改前端，已在线上核验，见第5节；规则和限制见第6节第14项。

2026-11-13 09:43Z（北京时间17:43）第七次上线：温柔线描UI改版。用moe-ui-skill的风格6「温柔线描」重做全站皮肤：暖白底、细线描边、略带手绘感的不对称圆角和胶囊按钮，配22张手绘webp素材（吉祥物、登录/空状态/追更插画、手机端标签栏和输入框图标）。电脑端的搜索、空状态、追更、豆瓣、设置、登录，手机端的首页、搜索结果、资源卡片、登录、豆瓣、TMDB、离线任务都换了皮。用户先确认了设计稿和素材（「按这套继续」），看过改前/改后/设计稿三栏对照后选「提交并部署」。只改前端的样式、模板和图片，接口与交互不变。已在线上核验，见第5节；和设计稿不一样的地方见第6节第15项。

同日10:26Z（北京时间18:26）第八次上线：115资源汇总补海报修复。用户问「115资源汇总的为啥没有图」：汇总里没图的是PanSou的115结果（频道消息都有图）。这些结果本身多半不带海报，后端先把标题洗成片名再去TMDB/豆瓣补；原来的洗法把「庆余年.全46集.4K.国语中字.60.25GB【国产剧】」洗成「庆余年. . .国语中字.60.25GB」这类串，TMDB一条也查不到。用户选方案A「修洗标题规则」，规则见第4节；只改后端一个函数和测试，已在线上核验，见第5节；仍有的限制见第6节第16项。

2026-11-14 17:58Z（北京时间11月15日01:58）第九次上线：温柔线描 UI 精修。依据已安装的 `moe-ui-skill` 和“温柔线描”预览，在保留现有插画、导航和业务接口的前提下，补充 `--primary-foreground` 令牌；移动端退出登录、最近搜索、清空和刷新改为原生按钮并补焦点样式；全局尊重 `prefers-reduced-motion`。本地构建、前端6项测试、lint、桌面/移动 Playwright 预览通过；线上首页、登录页、容器启动和公开 `/login` 已核验。回滚镜像为 `pansou115-cloudsaver:rollback-pre-moeui-refine-20261115-0158`，源码备份为 `/opt/pansou115/deploy-backups/moeui-refine-20261115-0158/`。

2026-11-15 01:53Z（北京时间09:53）第十次上线：温柔线描图片轻动效。用户反馈上一版插画是静态的；在现有 WebP 上增加轻漂浮与轻呼吸，不引入 GIF/视频依赖，系统开启 reduced-motion 时完全停用。桌面/移动登录页线上验证动画名和时间变化均通过。回滚镜像为 `pansou115-cloudsaver:rollback-pre-moeui-motion-20261115-0951`，源码备份为 `/opt/pansou115/deploy-backups/moeui-motion-20261115-0951/`。

2026-11-15 02:24Z（北京时间10:24）第十一次上线：用户反馈仍看不到新的图片；使用内置生图模型生成宽幅云朵搜索助手主视觉与透明背景搜索栏吉祥物，复制为 WebP 接入桌面/移动登录页、资源空状态和桌面搜索栏。公开 `https://sou.aiapi.cfd/login` 的桌面 1440×960、移动 390×844 页面均已看到新主视觉，线上动画验证通过。回滚镜像为 `pansou115-cloudsaver:rollback-pre-moeui-generated-20261115-1020`，源码备份为 `/opt/pansou115/deploy-backups/moeui-generated-20261115-1020/`。原始生成 PNG 留在 `C:\Users\admin\.codex\generated_images\01a1da0b-6bcd-7001-81c3-07699b9467bd\`。

功能提交：55e70fe（每日115订阅追更）、bb6c697（搜索结果中白名单外图床图片加载失败）、862ba65（图片代理跳转到内网的测试，仅测试代码）、4d372ce（豆瓣榜单缓存与卡住重试）、5c7fa71（搜索分组排序）、d7e7af1（搜索提速、加载更多、gzip、豆瓣Cookie改环境变量）、003889d（115探活超时恢复30秒）、dabf8c7（115探活按链接缓存、TG频道顺序与分页缓存、豆瓣预热）、3f17bd2（tini、优雅停机、镜像瘦身）、49a718d（删无用图片与socket.io-client、PWA图标）、499b172（UI改版、Element Plus按需加载）、f865f27（115资源汇总置顶）、0d6cc4a（频道标签只显示一个#）、4e75c50（温柔线描UI改版）、64dcb77（PanSou补海报前洗标题）、33b4be3（精修设计规格与执行日志）、3728620（温柔线描可访问性精修）、2bfd506（图片动效设计规格）、c9b9835（图片轻动效实现）、9f8c97d（生图温柔线描素材接入）。线上镜像由 9f8c97d 构建。服务器源码目录的内容与 9f8c97d 的前端相关文件一致；第五至十一次替换的文件是 LF 换行，从未经发布替换过的旧文件可能仍是 CRLF。

### 4）已经完成

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
- [x] 真实115只读核验：目录/文件字段、按count截止的分页（防115翻页回绕重复）、错误目录保护、分享内子目录遍历均与代码一致，未改动媒体。
- [x] 115风控：请求间隔至少1秒；遇405风控页单独提示，本轮停止但不暂停订阅，同批其余检查冷却30分钟后再跑；转存中途遇风控不再发后续集。
- [x] OneStrm：只有明确返回success=false才判通知失败，避免误判已验收的“转存→OneStrm”旧链路。
- [x] 搜索图片加载失败：图片代理原只允许6个图床，接入PanSou和公开频道后约20个新图床被拒（400）。现保留原白名单，另外只放行本站搜索24小时内返回过的图片地址（内存记录，最多5万条）；这类地址走独立受限客户端：拒绝内网/保留地址（含DNS解析与跳转）、不走全局代理、最多3次跳转、单张≤10MB、只转发按文件头识别的JPEG/PNG/GIF/WebP/AVIF并加nosniff。顺带修复图片地址被多解码一次。前端未改。
- [x] 数据库路径可用DATABASE_PATH覆盖（默认仍为./data/database.sqlite）；Sequelize不再逐条打印SQL——订阅队列每5秒轮询一次，保留会刷屏docker日志。
- [x] 豆瓣榜单超时：服务器到豆瓣的线路会间歇卡住（实测约1/6请求无响应，其余1–7秒）。旧代码后端只请求一次、超时30秒，前端16秒就先放弃，提示「网络请求超时或不可达」。改动如下：
  - 每个榜单缓存30分钟，最多缓存100个榜单；过期后先返回旧数据并在后台刷新，刷新失败就保留旧数据。
  - 单次请求8秒超时，最多3次；同一榜单的并发请求合并成一次。
  - 前端榜单请求等待30秒；搜索补海报时查豆瓣最多6秒（原30秒）。
  - 豆瓣报错日志只记错误原因；旧代码会把含Cookie的请求头写进日志。
- [x] 搜索分组排序：综合搜索结果的分组顺序，由「磁力、115、TG频道」改为「PanSou · 115网盘、TG频道（原顺序）、PanSou · 磁力链接」。前端默认展开第一组，所以现在默认展开的是115结果。
- [x] 搜索提速（d7e7af1）：PanSou结果先去重，补海报和115探活改为同时进行（旧代码是先补海报再探活）。
  - 补海报最多等5秒，没查完的在后台继续，查到后写入缓存，下次搜同一部直接命中。缓存最多2000条：查到的保留24小时，没查到的过30分钟重查。
  - 115探活等30秒，与旧版相同。d7e7af1曾设为12秒，线上探活慢时被截断，003889d已恢复，见第5节。探活失败或超时就不标状态，结果照常保留。
  - 前端搜索请求等待60秒。
- [x] TG频道「加载更多」（d7e7af1）：请求带lastMessageId时，后端只翻对应TG频道，不再并行查PanSou；前端按频道ID合并、按messageId去重，没有新结果时提示「没有更多了」。PanSou分组一次就返回全部结果，不再显示「加载更多」。
- [x] 静态资源（d7e7af1，容器内nginx.conf）：
  - 开启gzip。宿主机nginx用HTTP/1.0转发，所以要设gzip_http_version 1.0。
  - /assets/下带哈希的文件缓存一年（immutable）；index.html、sw.js、registerSW.js、manifest.webmanifest不缓存；/assets/下不存在的文件返回404，不再回落到index.html。
- [x] 豆瓣（d7e7af1）：
  - 代码里不再写死Cookie，改为可选环境变量DOUBAN_COOKIE。服务器实测不带Cookie时榜单和补海报都正常，线上没有配置。
  - 补海报改读subject_suggest返回的img字段。旧代码读不存在的pic字段，豆瓣补海报一直没生效。
- [x] PanSou补海报前洗标题（64dcb77，PansouSearcher.extractMediaTitle）：
  - 括号、点号、竖线、斜杠、冒号、&、➕都当分隔；点号夹在两个数字中间时不算，保住60.25GB、5.1。
  - 去掉开头的emoji和「电视剧｜」「【国产剧】」「动画电影｜」「4K」这类分类、画质标签。
  - 从第一个发布信息起截掉：年份、第X季/集、全N集、S01E01、V2版、1080P/4K、文件大小、WEB-DL/H.265等英文标签、国语/中字等、纯净版、各版本。开头就是年份的算片名（如《1917》）。英文标签只按整词匹配，不再把Inferno切成「I erno」。
  - 有中文名时只取第一个含汉字的词（「庆余年 Joy of Life」→「庆余年」，「流浪地球2：再次冒险」→「流浪地球2」）。
  - 没有说明的链接（标题是「网盘分享 分享码」）不去查。TMDB/豆瓣的查询方式、补图最多等5秒、缓存时长都没改。

### 5）测试结果与证据

2026-11-13第八次上线前（代码为64dcb77，只改后端）：

- npm run test:search：**8项通过、0失败**（原6项，加洗标题23个样例、没图的条目用洗过的片名只查一次海报且「网盘分享」不查）。
- 后端其余测试douban、image-proxy、subscriptions一起跑：**41项通过、0失败**。
- npm run lint：**0错误，18条warning**（与第七次相同）。
- 上线前在线上容器里加载新编译的PansouSearcher（不替换线上代码），对8个关键词（庆余年、流浪地球、繁花、狂飙、漫长的季节、奥本海默、沙丘、哪吒）的70条PanSou 115结果比对：没图的6条，旧规则洗出的标题TMDB全部查不到，新规则6条都查到且对得上（庆余年2019×2、流浪地球2019×2、沙丘2021、哪吒之魔童降世2019）。
- 前端没改，没有重跑前端构建和前端测试。

2026-11-13全量重跑结果（第七次上线前，代码为4e75c50）：

- npm run test:subscriptions：**26项通过、0失败**，该命令包含后端tsc。
- npm run test:images：**7项通过、0失败**（白名单与搜索返回过的地址放行、非默认端口与带凭据地址拒绝、内网直连与跳转拦截、文件头识别）。
- npm run test:douban：**8项通过、0失败**（卡住后重试并缓存、3次失败给出明确提示、过期后台刷新且失败时保留旧数据、并发合并、缓存上限100、海报查询6秒超时，另有启动预热2项）。
- npm run test:search：**6项通过、0失败**（115在最前、TG频道顺序不变、磁力在最后；没有115结果时磁力仍在最后；加载更多只翻对应TG频道，不再查PanSou；另有TG频道顺序与分页缓存、115探活缓存）。
- npm run build:frontend：**通过**（vue-tsc + Vite + PWA生成，预缓存128项）。
- 前端 npm test（frontend目录，node --test直接跑.ts，本机Node 24）：**6项通过、0失败**（115汇总的排序、去重和来源、重复调用结果不变、没有115时不建汇总、加载更多原地追加、工具栏计数不重复、标签只显示一个#）。
- npm run lint：**退出码0，0错误，18条warning**（lint只查.js/.ts，不查.vue/.scss）。
- git diff --check：无空白错误（Windows会提示LF/CRLF转换警告，不是构建失败）。
- 完整服务冷启动（临时数据库、生产模式；2026-11-12做的，第七次只改前端，没有重跑）连续3次正常：鉴权、订阅接口、错误提示、旧接口、四张新表、重启、模拟旧库升级（保留用户）均通过。
- 第七次另做：本次改动的文件过了prettier检查（只剩Tmdb.vue里一处el-radio-group长行，改版前就有）；本机预览服务（只用模拟数据）下按1440×960和390×844截了改前/改后，与设计稿逐页对照。

测试范围：18:00边界/UTC跨日、大整数ID、恶意分享域名、明确单集/合集/跨季、质量要求、同名续作、已有集、未知目标文件、仅新增基线、源读取失败、重复调度、权限隔离、并行租约、暂停、崩溃账本、转存超时实际成功/未成功、OneStrm失败不重复写盘、每轮10集上限、特殊字符标题、其他剧/季水位隔离、搜索发布时间不明。

模拟UI已验证：创建订阅 → 进入测试剧/Season 01 → 选择目录ID101 → 保存 → 显示北京时间18:00 → 立即检查 → 暂停后按钮禁用 → 恢复 → 查看检查记录。所有数据只在本地mock内存，不涉及真实115。

- 模拟服务：http://127.0.0.1:18088
- 启动命令（主工程下）：node frontend/tests/subscriptions-preview.cjs
- 模拟服务不能对外暴露，也不能当成生产后端使用。交接时已停止本轮mock服务；继续测试时用上述命令重启。
- 电脑测试：1280宽，无横向溢出。
- 手机测试：390×844，页面scrollWidth=390；编辑弹窗宽374px，无横向溢出。
- 截图位于C:\Users\admin\.codex\visualizations\2026\10\16\01a142ce-71f1-7361-a94f-0dd2f29407a5\subscriptions-desktop-test.png和subscriptions-mobile-test.png（模拟数据，非线上验收）。

线上部署验收（2026-11-12，备份时间戓20261112-0852）：

- 发布前服务器源码与提交逐个比对一致（177/177），发布后与bb6c697一致（189/189），无多余文件；docker-compose.yml、数据目录、115账号与OneStrm设置未改。
- 备份：回滚镜像pansou115-cloudsaver:rollback-pre-subscription-20261112-0852；源码归档/opt/pansou115/cloudsaver-pansou-src.bak-20261112-0852.tgz；停机后复制的数据库data/cloudsaver/data/database.sqlite.bak-20261112-0852（库为delete日志模式，停机复制一致）。
- 启动日志：数据库初始化成功；订阅调度已启动：每天18:00 Asia/Shanghai；服务器启动成功。
- 接口：首页200；未登录访问/api/subscriptions与/api/search均为401。
- 数据：旧表行数不变（global_settings 1、lixian_task_records 4、user_settings 1、users 2）；subscriptions、subscription_runs、subscription_entries为0，subscription_leases只有worker一行。
- 图片：用4个关键词的真实搜索结果抽查20个白名单外图床共37张图，32张可代理；其余5张是源站问题（wsrv.nl 404、pic1.zykpic.com域名失效、p5.ssl.qhimgs1.com 403防盗链）。直连169.254.169.254、localhost:8009、pansou:8888均被拒；公网跳转测试服务对服务器一律403，跳转拦截改由本地测试覆盖。
- 页面：内置浏览器未登录，没有代用户登录；登录后的搜索图片和空“追更”页需用户确认。
- 回滚（无需重建）：cd /opt/pansou115 → sudo docker compose stop cloudsaver → sudo docker tag pansou115-cloudsaver:rollback-pre-subscription-20261112-0852 pansou115-cloudsaver:latest → sudo docker compose up -d --no-deps cloudsaver；源码用tgz还原，避免以后重建带上新代码。旧版本不使用四张新表，数据库一般不用还原；只有数据损坏才用备份覆盖（会丢上线后写入的记录，覆盖前先另存当前库）。

线上部署验收（2026-11-12第二次，备份时间戳20261112-0937）：

- 内容：4d372ce（豆瓣榜单）与5c7fa71（搜索分组排序），共替换6个文件。
  - 替换前逐个核对服务器旧文件与862ba65一致。其中DoubanService.ts、frontend/src/api/douban.ts在服务器上是CRLF换行，内容相同。
  - 替换后6个文件的md5与提交一致。
  - docker-compose.yml、数据目录、账号设置未改。
- 备份：
  - 回滚镜像pansou115-cloudsaver:rollback-pre-douban-order-20261112-0937，即上一版镜像8a2b9dffeebf。
  - 源码归档/opt/pansou115/cloudsaver-pansou-src.bak-20261112-0937.tgz。
  - 停机后复制的数据库data/cloudsaver/data/database.sqlite.bak-20261112-0937。
  - 上一轮的rollback-pre-subscription-20261112-0852镜像与备份仍保留。
- 切换：新镜像latest=1dd9d63e1eb6，09:41Z切换，停机约15秒。启动日志正常：数据库初始化成功、订阅调度已启动、服务器启动成功。
- 接口：首页200；未登录访问/api/search与/api/douban/hot均为401。
- 数据：8张表的行数与停机备份完全一致，quick_check=ok。启动后库文件变大，是启动时的表维护，不是数据变化。
- 豆瓣：在容器内用新代码请求了三个榜单。
  - 热门电影第1次8秒超时，自动重试后成功，共9.5秒拿到20条。
  - 热门电视剧1.6秒、热门综艺1.2秒，各20条。
  - 新日志只有错误原因，不含请求头。旧容器连同其中带Cookie的旧日志，已在重建时删除。
- 排序：新镜像dist/controllers/resource.js中，115组用unshift放到最前，磁力组用push放到最后。登录后的页面需用户确认。
- 回滚（无需重建）：
  1. cd /opt/pansou115
  2. sudo docker compose stop cloudsaver
  3. sudo docker tag pansou115-cloudsaver:rollback-pre-douban-order-20261112-0937 pansou115-cloudsaver:latest
  4. sudo docker compose up -d --no-deps cloudsaver
  5. 源码用20261112-0937的tgz还原。
  - 这次没有改数据库结构，一般不用还原数据库。

线上部署验收（2026-11-12第三次，备份时间戳20261112-1225）：

- 内容：d7e7af1，共替换11个文件。
  - 主工程nginx.conf、.env.example。
  - 后端config/index.ts、controllers/resource.ts、services/DoubanService.ts、services/PansouSearcher.ts、tests/search-order.test.cjs。
  - 前端api/resource.ts、stores/resource.ts、components/Home/ResourceCard.vue、ResourceTable.vue。
  - 替换前逐个核对与a7a4a18一致，替换后md5与提交一致。docker-compose.yml、数据目录、账号设置未改；服务器上没有配置DOUBAN_COOKIE。
- 备份：
  - 回滚镜像pansou115-cloudsaver:rollback-pre-opt14-20261112-1225，即上一版镜像1dd9d63e1eb6。
  - 源码归档/opt/pansou115/cloudsaver-pansou-src.bak-20261112-1225.tgz。
  - 停机后复制的数据库data/cloudsaver/data/database.sqlite.bak-20261112-1225。
- 切换：新镜像7358f79e2392，12:26Z切换，切换前nginx -t通过。部署后容器日志14行，没有错误。
- 静态资源（在服务器上请求线上域名）：
  - 首页和sw.js返回no-cache，且为gzip。
  - main.js从1119125字节压到362077字节，main.css从402666字节压到82186字节。
  - /assets/下的文件带public, max-age=31536000, immutable；不存在的/assets/文件返回404。
- 接口：未登录访问/api/search与/api/douban/hot仍为401。
- 容器内用新代码实测：
  - 豆瓣：热门电影20条4.9秒，热门电视剧20条0.9秒；豆瓣补海报能查到，img字段修复生效。
  - 加载更多：搜「三体」，baicaoZY频道第一页20条；加载更多0.23秒，只返回该频道，新增2条。
  - 115探活：搜「庆余年」得到5条115结果。12:42Z连续两次探活都超过12秒被截断，5条都没标状态，坏链没过滤。12:49Z同样5条探活只用2.3秒，过滤掉2条坏链，保留2条加密、1条正常；再搜一次0.16秒（PanSou缓存了探活结果）。因此第四次上线把探活超时恢复为30秒。

线上部署验收（2026-11-12第四次，备份时间戳20261112-1309）：

- 内容：003889d，只替换backend/src/services/PansouSearcher.ts（探活超时12秒改回30秒）。替换前核对与d7e7af1一致，替换后md5一致。
- 备份：
  - 回滚镜像pansou115-cloudsaver:rollback-pre-linkcheck-20261112-1309，即第三次的镜像7358f79e2392。
  - 源码归档/opt/pansou115/cloudsaver-pansou-src.bak-20261112-1309.tgz。
  - 停机后复制的数据库data/cloudsaver/data/database.sqlite.bak-20261112-1309。
  - 前几次的回滚镜像和备份都还保留。
- 切换：新镜像3e2fce9e7b3b，13:09Z切换，切换前nginx -t通过。启动后日志11行，没有错误；首页200，未登录访问/api/search为401。
- 实测：
  - 容器内PansouSearcher.js的LINK_CHECK_TIMEOUT为30000。
  - 用新代码搜「繁花」，10条115链接过滤掉7条坏链，保留3条正常。
  - 搜「庆余年」，5条里过滤掉2条坏链，保留2条加密、1条正常。
  - 这两次探活都命中了PanSou缓存（几毫秒），所以没有测到探活慢时的30秒等待。
- 回滚（无需重建）：
  1. cd /opt/pansou115
  2. sudo docker compose stop cloudsaver
  3. sudo docker tag pansou115-cloudsaver:rollback-pre-linkcheck-20261112-1309 pansou115-cloudsaver:latest（回到第三次；要回到第二次，改用rollback-pre-opt14-20261112-1225）
  4. sudo docker compose up -d --no-deps cloudsaver
  5. 源码用对应时间戳的tgz还原，避免以后重建时带上新代码。
  - 这两次都没有改数据库结构，一般不用还原数据库。

线上部署验收（2026-11-12第五次，备份时间戓20261112-1504）：

- 内容：dabf8c7、3f17bd2、49a718d、499b172。服务器上更新40个文件，删除5张旧图（frontend/logo-1.png、frontend/logo.svg，以及frontend/src/assets/images/下的logo-1.png、login-bg.jpg、mobile-login-bg.png）。
  - 替换前核对：要改、要删的39个旧文件与333bc83一致（部分只差在CRLF）。
  - 替换后核对：40个文件与提交逐字节一致，docker-entrypoint.sh里没有CR。
- 备份：
  - 回滚镜像pansou115-cloudsaver:rollback-pre-ui-20261112-1504，即第四次的镜像3e2fce9e7b3b（559MB）。
  - 源码归档/opt/pansou115/cloudsaver-pansou-src.bak-20261112-1504.tgz（不含node_modules）。
  - 停机后复制的数据库data/cloudsaver/data/database.sqlite.bak-20261112-1504（数据库没有-wal/-journal文件）。
- 切换前测试：新镜像先在临时容器里跑（空数据库、不开端口）。
  - nginx -t通过，1号进程是tini。
  - 首页、logo-192/512、manifest返回200；不存在的/assets/文件返回404；未登录搜索返回401。
  - 豆瓣4个榜单启动后4秒内预热完。
  - docker stop 1秒退出、退出码0（旧镜像要等10秒被强杀）。
- 切换：新镜像7b1741e524da（217MB），15:09Z切换，停机约11秒。
- 线上核验：
  - 首页、logo-192.png、manifest返回200；未登录访问/api/search、/api/douban/hot返回401。
  - 主JS 149kB（gzip 58kB，改版前约361kB），主CSS gzip 43kB（改版前约81kB）。
  - 数据库各表行数与备份一致，quick_check=ok。
  - 容器内带登录态搜「庆余年」，连搜两次：
    - 第一次9.3秒。PanSou · 115网盘3条（2条加密、1条正常），后面是25个TG频道，最后是磁力组。
    - 第二次1.6秒。115状态直接来自探活缓存，TG频道顺序与第一次相同。
- 回滚（无需重建）：
  1. cd /opt/pansou115
  2. sudo docker compose stop cloudsaver
  3. sudo docker tag pansou115-cloudsaver:rollback-pre-ui-20261112-1504 pansou115-cloudsaver:latest
  4. sudo docker compose up -d --no-deps cloudsaver
  5. 源码用cloudsaver-pansou-src.bak-20261112-1504.tgz还原，避免以后重建时带上新代码。
  - 这次没有改数据库结构，一般不用还原数据库。

线上部署验收（2026-11-12第六次，备份时间戳20261112-1615）：

- 内容：f865f27（115资源汇总置顶）、0d6cc4a（频道标签只显示一个#）。只改前端：服务器上替换9个文件，新增frontend/tests/resource-summary.test.ts。
  - 替换前核对：要改的9个旧文件与499b172一致（按git blob哈希比对，忽略CR；实际都是LF）。
  - 替换后核对：10个文件与0d6cc4a逐字节一致。
- 备份：
  - 回滚镜像pansou115-cloudsaver:rollback-pre-115summary-20261112-1615，即第五次的镜像7b1741e524da（217MB）。
  - 源码归档/opt/pansou115/cloudsaver-pansou-src.bak-20261112-1615.tgz（不含node_modules，12.5MB；比之前的小，是因为第五次删了几张大图）。
  - 停机后复制的数据库data/cloudsaver/data/database.sqlite.bak-20261112-1615（数据库没有-wal/-journal文件）。
- 构建：约1分钟，后端各层全部命中缓存；前端主JS 148.65kB（gzip 57.87kB）。
- 切换前测试：新镜像3db755ea8f41先在临时容器里跑（空数据库、不开端口、随机JWT密钥）。
  - nginx -t通过，1号进程是tini。
  - 首页（no-cache）、logo-192/512、manifest、sw.js返回200；不存在的/assets/文件返回404；未登录访问/api/search、/api/douban/hot返回401。
  - 构建产物resource-BiKmH1e0.js里有summary_115、「115 资源汇总」和标签去重用的/^#+/。
  - 日志12行，没有错误；docker stop 1.2秒退出、退出码0。
- 切换：16:17Z，停机约13秒（停容器1.3秒，新容器启动到接口返回401约11秒）。
- 线上核验：
  - 容器跑在3db755ea8f41上；启动日志9行，没有错误（数据库初始化成功、订阅调度已启动、服务器启动成功）。
  - 容器内和宿主机请求首页、logo、manifest返回200；未登录访问/api/search、/api/douban/hot返回401；线上产物里有新代码。
  - 数据库8张表的行数与停机备份一致，quick_check=ok。
  - 容器内带登录态搜「庆余年」：7.6秒，接口返回27组173条，仍是PanSou · 115网盘在最前（3条）、25个TG频道、磁力在最后（22条）。按页面规则，115汇总会有18条：PanSou 3条，加上2个频道里的15条。
  - 空关键词（搜索页默认展示）：1.5秒，25个TG频道共403条；115汇总会有71条，来自6个频道。
  - 登录后的页面需用户确认。
- 回滚（无需重建）：
  1. cd /opt/pansou115
  2. sudo docker compose stop cloudsaver
  3. sudo docker tag pansou115-cloudsaver:rollback-pre-115summary-20261112-1615 pansou115-cloudsaver:latest
  4. sudo docker compose up -d --no-deps cloudsaver
  5. 源码用cloudsaver-pansou-src.bak-20261112-1615.tgz还原，避免以后重建时带上新代码。
  - 这次没有改数据库结构，一般不用还原数据库。

线上部署验收（2026-11-13第七次，备份时间戳20261113-0942）：

- 内容：4e75c50（温柔线描UI改版）。只改前端：服务器上替换24个文件，新增23个（frontend/src/styles/theme.scss和frontend/src/assets/moe/下22张webp）。
  - 替换前核对：要改的24个旧文件与0d6cc4a一致（按md5比对，忽略CR），要新增的23个原本不存在。
  - 替换后核对：47个文件与4e75c50逐字节一致。
- 备份：
  - 回滚镜像pansou115-cloudsaver:rollback-pre-moeui-20261113-0942，即第六次的镜像3db755ea8f41（217MB）。
  - 源码归档/opt/pansou115/cloudsaver-pansou-src.bak-20261113-0942.tgz（不含node_modules，12MB）。
  - 停机后复制的数据库data/cloudsaver/data/database.sqlite.bak-20261113-0942（数据库没有-wal/-journal文件）。
- 构建：27秒，新镜像fa892030f8bf（217MB）；前端主JS 149.06kB（gzip 58.09kB），PWA预缓存128项（1769.50KiB）。
- 切换前测试：新镜像先在临时容器里跑（空数据库、不开端口）。
  - nginx -t通过；镜像里有6个mascot-/scene-开头的插画文件。
  - 首页、sw.js、manifest、logo-192返回200；不存在的/assets/文件返回404；未登录访问/api/search、/api/douban/hot返回401；新侧栏插画/assets/mascot-sidebar-DwvUySPL.webp返回200。
  - 日志12行，没有错误。
- 切换：09:43Z（北京时间17:43），停机约3秒（从停容器算到新容器的/api/search返回401）。
- 线上核验：
  - 容器跑在fa892030f8bf上，挂载/app/data和/app/config；启动日志10行，没有错误。
  - 容器内请求结果与切换前测试相同：首页、sw.js、manifest、logo-192返回200，不存在的/assets/文件404，未登录接口401，新插画200。
  - 数据库8张表的行数与停机备份一致，quick_check=ok。
  - 从本机经代理访问线上站点：首页200，theme-color是#fbf8f4；线上CSS里是新的--radius-sketch-pill；主JS和sw.js返回200，sw.js预缓存了新插画；mascot-sidebar与提交里的文件逐字节一致；未登录访问/api/search返回401。
  - 外网截图：未登录时的电脑和手机登录页都已是新版（截图只在本机.tmp-ui-preview/，未提交）。
  - 登录后的页面需用户确认。
- 回滚（无需重建）：
  1. cd /opt/pansou115
  2. sudo docker compose stop cloudsaver
  3. sudo docker tag pansou115-cloudsaver:rollback-pre-moeui-20261113-0942 pansou115-cloudsaver:latest
  4. sudo docker compose up -d --no-deps cloudsaver
  5. 源码用cloudsaver-pansou-src.bak-20261113-0942.tgz还原，再删掉这次新增的frontend/src/assets/moe/和frontend/src/styles/theme.scss（解压旧归档不会删掉新增的文件），避免以后重建时带上新代码。
  - 这次没有改数据库结构，一般不用还原数据库。

线上部署验收（2026-11-13第八次，备份时间戳20261113-1025）：

- 内容：64dcb77（PanSou补海报前洗标题）。只改后端：服务器上替换backend/src/services/PansouSearcher.ts和backend/tests/search-order.test.cjs。
  - 替换前核对：两个旧文件与4e75c50一致（按md5比对，忽略CR）；替换后与64dcb77逐字节一致。
- 备份：
  - 回滚镜像pansou115-cloudsaver:rollback-pre-poster-20261113-1025，即第七次的镜像fa892030f8bf。
  - 源码归档/opt/pansou115/cloudsaver-pansou-src.bak-20261113-1025.tgz（不含node_modules，13MB）。
  - 停机后复制的数据库data/cloudsaver/data/database.sqlite.bak-20261113-1025。
- 构建：12秒，新镜像f1bfddd19229。镜像里编译后的PansouSearcher.js含新规则（RELEASE_INFO等名字旧镜像0处、新镜像6处）。
- 切换前测试：临时容器里nginx -t通过，6个插画文件都在；首页、sw.js、manifest、logo-192返回200，不存在的/assets/文件404，未登录访问/api/search、/api/douban/hot返回401，侧栏插画200；日志12行，没有错误。
- 切换：10:26Z（北京时间18:26），停机约15秒（从停容器算到新容器的/api/search返回401）。
- 线上核验：
  - 容器跑在f1bfddd19229上，挂载/app/data和/app/config；启动日志11行，没有错误；容器内请求结果与切换前测试相同。
  - 数据库8张表的行数与停机备份一致，quick_check=ok。
  - 带登录态搜索庆余年、流浪地球、沙丘、哪吒，每个搜两次：PanSou 115共28条，没图0条，其中5条用的是TMDB海报；重启后第一次搜就补上了。经站内图片代理取这些TMDB海报，3次都是200 image/jpeg。
  - 从本机经代理访问线上站点：首页、CSS、主JS、sw.js、manifest、logo-192返回200，侧栏插画与提交里的文件一致，未登录访问/api/search返回401。
  - 登录后的页面需用户确认。
- 回滚（无需重建）：
  1. cd /opt/pansou115
  2. sudo docker compose stop cloudsaver
  3. sudo docker tag pansou115-cloudsaver:rollback-pre-poster-20261113-1025 pansou115-cloudsaver:latest
  4. sudo docker compose up -d --no-deps cloudsaver
  5. 源码用cloudsaver-pansou-src.bak-20261113-1025.tgz还原（这次没有新增文件，解压即可），避免以后重建时带上新代码。
  - 这次没有改数据库结构，一般不用还原数据库。

### 6）当前卡住/尚未闭环

1. **已上线但未做真实转存验收**：线上0条订阅；需要用户选定第一部影片和专用115目录后，再验收增量转存、OneStrm通知和STRM。
2. **115风控**：核验时连续请求曾触发115分享接口临时风控（405，北京时间16:30复查已恢复，账号未受影响），现已节流；订阅多时一轮检查会更慢，属预期。远程探测要上传脚本文件后执行，不用“PowerShell多行脚本管道 → ssh bash -s → docker exec -i node”这类嵌套stdin/heredoc。
3. **原生Chrome CDP检查未顺利建立会话**：check-deps提示Chrome可能等待授权；没有擅自同意权限。改用可用的应用内浏览器完成本地UI测试。跨轮旧tab句柄可能报browser.user unavailable，创建新的临时标签后可继续。
4. **18:00调度尚无真实运行记录**：上线当天没有订阅，调度不会写入；有订阅后看subscription_runs与页面“检查记录”。
5. **不确定转存的人工处理入口尚未提供**：账本会阻止重发，安全但需核实真实目标；不能通过清表或删除账本“重试”。
6. **匹配偏保守**：源文件/路径缺作品名或明确季集、字幕版本信息不全时进入待确认；目前是记录提示，没有单条待确认资源的人工批准转存入口。不要宣传为任何命名都能自动追更。
7. **STRM仍待核实**：本期只可靠展示OneStrm通知结果；没有逐文件STRM生成/Emby播放确认，不复用旧全盘日志模糊匹配认定成功。
8. **工作树出现.cursor/未跟踪目录**：不是本轮订阅功能生成的已确认文件，不读取/覆盖/删除，不使用git add -A误提交。
9. **图片代理限制**：白名单外的图片地址只记在内存，服务重启后，重启前搜到的这类图片要重新搜索才能加载；非默认端口、带账号密码的图片地址不代理；源站404/403/域名失效的图无法修复。
10. **已知匹配限制**：同一集拆成Part1/Part2时只转第一段；目标目录有E00、特别篇等识别不出集号的文件时，订阅停在“待确认”，不自动写入。
11. **TG频道「加载更多」已修复（d7e7af1）**：
    - 原来加载更多时后端仍并行搜PanSou，前端按返回的第一组合并，导致PanSou组被重复追加、TG频道的新一页丢失。
    - 现在只返回对应TG频道，前端按频道合并去重，线上已核验，见第5节。
12. **豆瓣Cookie仍在Git历史中**：
    - 代码里已删除（d7e7af1），改为可选环境变量DOUBAN_COOKIE，线上没有配置。
    - 旧值仍在Git历史里。仓库若公开，建议先在豆瓣退出登录使它失效。
    - 交接文档、日志、回复里都不要复述它的值。
13. **115探活耗时不稳定（已改进，dabf8c7，第五次上线）**：
    - 同样是5条链接，有时2秒，有时超过12秒。
    - 现在按链接缓存探活结果（正常、加密缓存1小时，失效缓存12小时，最多5000条），只把没缓存的链接发给PanSou；同一链接再搜不用再等。
    - 最多等30秒；超时先返回结果（不标状态），后台继续探完写进缓存，下一次搜索就能过滤坏链。服务重启后缓存清空。
14. **115资源汇总（f865f27，第六次上线）**：
    - 汇总只在前端拼，后端返回的分组没变。PanSou · 115网盘的结果在前，后面是各TG频道里带115链接的消息（按发布时间新→旧），按115分享码去重，每条标「来自 xxx」；不再单独列「PanSou · 115网盘」分组。频道分组里原来的条目不动，汇总里放的是副本。
    - 汇总本身不翻页；频道「加载更多」翻出的新115条目接到汇总末尾。工具栏的来源数和总条数不把汇总重复计算，另显示「115 有 N 条」。本地缓存不存汇总组，恢复时重新拼。
    - 频道消息的cloudType只取第一个识别到的网盘，同时带夸克和115链接的消息可能标成夸克，所以汇总按链接判断是否含115。
    - 默认页数据多时汇总很长（上线时默认页71条），电脑端默认展开。要折叠或分页，改frontend/src/utils/resource.ts（withSummary115、appendToSummary115、resourceStats）和两个ResourceList视图。
15. **温柔线描UI改版（4e75c50，第七次上线）**：
    - 和设计稿有意不同的地方（用户看过三栏对照后同意上线）：「立即检查」保持原来的按钮层级，「关注影片」不染色；没有加「运行中断」高亮；二维码保留白底；夸克仍是紫色；设置页输入框前缀图标没换；页面密度按现有布局（设计稿是放大画的）；手机登录页另加了插画；theme-color改为#fbf8f4，浏览器标签页和PWA图标没换。
    - 改颜色、线条、圆角先改frontend/src/styles/tokens.scss的变量；Element Plus/Vant组件的线描皮肤在theme.scss；页面里只写布局和局部样式。
    - 素材是用图像生成接口出图后挑选、压成webp的，放在frontend/src/assets/moe/；设计稿和三栏对照页只在本机.tmp-ui-preview/（未提交）。
16. **115汇总补海报（64dcb77，第八次上线）**：
    - 只补PanSou结果里没带图的条目；频道消息的图来自TG，不经过这里。补图最多等5秒，没赶上的后台查完写缓存（查到的存24小时，没查到的过30分钟再查），下次搜同一部就有图。
    - 洗标题后只取中文名的第一个词，副标题和「第二部」这类信息会丢，可能配到系列或第一部的海报（如「沙丘：预言」洗成「沙丘」，拿到2021年电影的海报）。标题里完全没有片名的条目仍然没图。
    - 豆瓣补海报从服务器访问常超时（实测4次有3次8秒没返回），实际主要靠TMDB；TMDB Key在设置页配置。
    - 要调规则改backend/src/services/PansouSearcher.ts顶部的RELEASE_INFO、LEADING_TAG、TITLE_SEPARATOR，样例加在backend/tests/search-order.test.cjs的洗标题测试里。

### 7）接下来按顺序做

- [x] 1. 复核新增文件与差异，重点检查真实115响应字段、分页完整性、分享子目录、目标目录验证；只读验证不改媒体。（字段、分页、子目录、目标目录保护均一致；顺带修复风控节流与OneStrm判定）
- [x] 2. 使用临时测试数据库启动完整Express服务，验证鉴权与订阅路由、错误状态、SQLite初始化和旧功能兼容。（连续3次冷启动通过）
- [x] 3. 重跑22项回归、前后端构建、lint；新增修复必须补测试。必要时检查手机CSS最终构建后布局。（订阅回归现为26项，另有图片代理7项，均通过）
- [x] 4. 对“结果待核实/待确认”明确保留限制；若要完善人工核实入口，先设计安全确认，不默认重发。（限制保留，见第6节）
- [x] 5. 显式git add本功能文件/文档/测试，排除.cursor/、临时脚本、数据库、Cookie和任何密钥；提交并推送。（55e70fe、bb6c697、862ba65）
- [x] 6. 线上停止/控制写入并做一致性SQLite备份、保留旧镜像与源码归档，准备回滚；不覆盖现有docker-compose及账号设置。（时间戳20261112-0852，见第5节）
- [x] 7. 构建发布，确认订阅路由/四张新表/启动日志/下次Asia/Shanghai 18:00；验证现有搜索转存页面未损坏。（接口与真实搜索结果图片已核验；登录后的页面检查并入第8项）
- [ ] 8. 线上只读验收空订阅页；不要自动创建用户真实关注。真实转存验收需要明确专用订阅与专用目录，或由用户选择第一部影片后验收。（数据库已确认0条订阅；页面需用户登录后确认）
- [x] 9. 更新本节状态、提交号和部署验收结论；没有完成的项继续保留未勾选。
- [x] 10. UI改版（方案B：统一视觉规范并重做关键页面），连同优化清单5–9（进程信号与入口脚本、TG缓存与顺序、豆瓣预热、前端瘦身、Dockerfile瘦身）和115探活按链接缓存。用户看过改前/改后截图并确认。（dabf8c7、3f17bd2、49a718d、499b172；第五次上线，见第5节）
- [x] 11. 115资源靠前（用户2026-11-12提出：主要用115资源；搜索结果和搜索页默认展示都要115优先）。用户选方案C「115汇总成一组置顶」，看过改前/改后截图（模拟数据）后确认。（f865f27、0d6cc4a；第六次上线，见第5节；规则与限制见第6节第14项）
- [x] 12. 温柔线描UI改版：用户要求用moe-ui-skill改版，选了风格6「温柔线描」；设计稿和22张素材经用户确认（「按这套继续」），看过改前/改后/设计稿三栏对照后选「提交并部署」。（4e75c50；第七次上线，见第5节；和设计稿的取舍见第6节第15项）
- [x] 13. 115资源汇总没图：用户问「115资源汇总的为啥没有图」，查明是PanSou结果补海报前洗标题出错，用户选方案A「修洗标题规则」。（64dcb77；第八次上线，见第5节；限制见第6节第16项）
- [x] 14. 温柔线描可访问性精修：补主按钮前景色令牌、移动端原生按钮语义/焦点、`prefers-reduced-motion` 支持；本地和线上均已核验。（3728620；第九次上线，见第5节；设计规格与逐步日志见 `docs/superpowers/specs/2026-11-15-moe-ui-gentle-line-refinement-design.md`、`docs/EXECUTION_LOG.md`）
- [x] 15. 温柔线描图片轻动效：现有 WebP 接入轻漂浮/轻呼吸 CSS 动画；reduced-motion 下关闭；桌面/移动线上验证通过。（c9b9835；第十次上线，见第5节；设计规格见 `docs/superpowers/specs/2026-11-15-moe-ui-image-motion-design.md`）

### 8）踩过的坑/接手注意

- Windows本地sqlite3缺node_sqlite3.node：最初集成测试无法加载，已通过npm rebuild sqlite3修好；必要时使用本机代理。测试必须设置NODE_ENV=test与临时DATABASE_PATH，不能打开生产数据库跑destroy测试。
- 曾因字符串替换中$&被当成替换占位符，污染英文标题转义逻辑。现改为callback返回转义字符串，新增特殊字符标题测试，22项重跑通过；不要再用含$&的普通replace字符串批量改代码。
- 季集匹配曾把“第23集”误当季数，把E01后2160p误当范围，均已修复并回归。仅从明确Season/Sxx/第x季识别季数，不靠配置强行补到所有源文件。
- 别的作品/季的高集数不能抬高“仅新增”水位；已加作品与季过滤。无发布时间的搜索补充不能当成“关注后新增”。
- 115长ID必须原样字符串；JSON.parse已经舍入后String无法恢复。新适配器先解析数字token，既有目录选择也接入了同样保护。
- 分享读取旧版只首20条、目录旧版首50/100条、转存旧版仅fids[0]。追更走独立分页与逐文件适配器，不把整合集重存作为补集。
- 新Subscription模型导入会进入sequelize.models；旧DatabaseService的sync({alter:true})可能额外改新表。已改为legacy表按模型sync，Subscription四表单独sync；必须做完整冷启动回归。
- 单元测试和mock浏览器流程不能替代实际115/API验收；OneStrm HTTP成功也不等于生成STRM成功。
- 不是Codex提醒/自动化任务：每天18:00由项目后端运行；2026-11-12已部署，调度已生效（没有订阅时不做任何转存）。
- 单个订阅每轮最多写10集，超出留给下一次检查；每日18:00是开始排队时间，不保证所有订阅18:00同时完成。
- 进程在18:00停机不补跑整轮，下一日18:00继续；用户可立即检查。持久化排队/在途记录要先核实，不能盲目重发。
- 首次“仅后续新增”只建基线，不存已有集；用户需要补旧集必须主动选择“补齐缺集”。
- 服务器源码里从未经发布替换过的旧文件是CRLF换行（最初从Windows工作区上传），按git blob（LF）算的md5会对不上。发布前核对时，要先比较CRLF版本的md5，确认只是换行差异再覆盖。
- 服务器到豆瓣的线路会间歇卡住。排查豆瓣问题时先看是不是超时，不要直接判断为被封。
- 从服务器访问豆瓣榜单（search_subjects）和补海报（subject_suggest）都不需要Cookie。subject_suggest返回的海报字段是img，不是pic。
- 宿主机nginx 1.18用HTTP/1.0转发到容器，容器内nginx要设gzip_http_version 1.0才会压缩。
- 115探活（PanSou的/api/check/links）耗时波动大，PanSou会缓存探活结果。探活超时不要低于30秒，否则探活慢时坏链会漏过滤。
- 从本机直连服务器的SSH很慢，常握手超时或被断开（2026-11-12晚，上传常要重试2–3次）。做法：
  - 走本机代理就正常了（5秒内连上）：ssh/scp加-o "ProxyCommand=C:\PROGRA~1\Git\mingw64\bin\connect.exe -H 127.0.0.1:7897 %h %p"，7897是本机系统代理端口。
  - 脚本先上传到/tmp，由带ConnectTimeout、ServerAlive和重试的后台运行器执行。
  - PowerShell 5把带双引号的参数传给ssh时会拆错，远程命令里不要写双引号；复杂命令写成脚本上传后执行。
  - 构建等耗时步骤在服务器上用nohup后台跑并写日志，再轮询日志；不要让一次SSH会话撑完整个构建。
  - SSH要指定密钥：-i %USERPROFILE%\.ssh\wb2api_vps138.key -o IdentitiesOnly=yes，不指定会Permission denied (publickey)。
  - 停容器、切换这类中途断开会让服务停着的步骤，用sudo setsid nohup在服务器上跑，SSH断了也会跑完。
- 本机git开了core.autocrlf=true，直接git archive会把文本文件转成CRLF（只有.gitattributes里的*.sh保持LF）。打发布包用git -c core.autocrlf=false archive，再逐个和git blob比对。
- nginx把/api/xxx改写成/xxx再转给后端8009。容器内验收走http://127.0.0.1:8008/api/search；直接请求8009的/api/search会匹配不到路由。
- 旧问题：backend/src/middleware/errorHandler.ts只有3个参数，Express把它当普通中间件。访问不存在的后端路径时会报“res.status is not a function”并返回500（不是404）。middleware/requestLogger.ts把对象传给logger.info，控制台只显示“info: [object Object]”。两个都未修。
- 容器内带登录态验收搜索：在容器里用/app/dist/config的jwtSecret给现有用户签一个5分钟的JWT，脚本用完即删，不打印令牌和用户信息。
- 手绘不对称圆角不要写成255px 16px 225px 16px这类大小悬殊的值：元素矮时浏览器会把四个角按同一比例缩小，结果几乎成了方角。胶囊形用--radius-sketch-pill（每个半径都远大于元素高度，任何高度都是胶囊）。
- 本机构建会改写frontend/components.d.ts和frontend/auto-imports.d.ts（曾删掉仍在用的ElMenu等声明）。这两个生成文件不要随功能提交，提交前用git checkout还原。
- 本机PowerShell 5按ANSI读没有BOM的.ps1，脚本里的中文会乱码：脚本只写ASCII，正则里的中文写成\uXXXX。用-File传数组参数会变成一个字符串，要在脚本里按逗号拆。
- Python的re把中文也算作单词字符，\b在中文和数字之间不成立。给输出打码时，IP要用(?<!\d)和(?!\d)这类前后断言，不能用\b，否则紧跟在中文后面的IP会漏掉。
- PowerShell 5里git commit -m的内容带双引号会被拆成多个参数（报pathspec不匹配）。提交说明写进文件，用git commit -F。
- backend/tests/*.test.cjs不是prettier格式（单引号、长行），lint也不查.cjs，不要对它们跑prettier --write，否则整文件重排。
- scp上传偶尔卡住，留下0字节的文件。超时后先只读核对服务器上文件的大小和md5，再只重传缺的。
- 想在不动线上的情况下试新后端代码：把本机编译的dist文件传进容器，用Module._compile按/app/dist/services下的路径加载，并先把require.cache里的TmdbService/DoubanService换成空类，免得加载数据库模型。

### 9）关键文件（全部位于主工程）

后端：
- backend/src/subscriptions/rules.ts：分享/时间/季集/身份/去重纯函数。
- backend/src/subscriptions/drive.ts：115分页遍历与单文件转存。
- backend/src/subscriptions/models.ts：四表与初始化。
- backend/src/subscriptions/engine.ts：配置校验、排队、租约、基线、转存与OneStrm通知。
- backend/src/subscriptions/routes.ts：/subscriptions及用户隔离接口。
- backend/src/app.ts：挂载路由、初始化表和调度启动。
- backend/src/services/DatabaseService.ts：避免legacy alter新表。
- backend/src/utils/imageSources.ts：记住搜索返回的图片地址、内网/保留地址判定、受控DNS解析、按文件头识别图片。
- backend/src/services/ImageService.ts：白名单外图床走独立受限客户端（不走全局代理、最多3次跳转、10MB上限）。
- backend/src/controllers/teleImages.ts：/tele-images放行规则（白名单优先，其余只放行搜索返回过的地址）。
- backend/src/controllers/resource.ts：综合搜索的分组顺序（115最前、TG居中、磁力最后）；带lastMessageId的加载更多只翻对应TG频道；返回前记下频道头像与资源图片地址。
- backend/src/services/PansouSearcher.ts：PanSou搜索与去重；补海报（最多等5秒，结果缓存）和115探活同时进行。补海报前用extractMediaTitle把资源名洗成片名（规则在文件顶部的RELEASE_INFO、LEADING_TAG、TITLE_SEPARATOR）。探活按链接缓存（正常/加密1小时、失效12小时），最多等30秒，超时后台探完写缓存。
- backend/src/services/Searcher.ts：TG频道按配置顺序返回；同一关键词的频道分页缓存5分钟（最多300条），失败的不缓存。
- docker-entrypoint.sh、Dockerfile（主工程根目录）：tini做1号进程；入口脚本转发停止信号，nginx或node任一退出就退出；后端npm prune --omit=dev，最终镜像不带编译工具。backend/src/app.ts收到SIGTERM/SIGINT先停接新请求，8秒内退出。
- backend/tests/image-proxy.test.cjs：图片代理7项测试（npm run test:images）。
- backend/src/services/DoubanService.ts：启动后预热菜单里的4个榜单（没取到的10分钟后重试）；豆瓣榜单缓存、卡住重试、并发合并；海报查询6秒超时，读subject_suggest的img字段；Cookie只从可选环境变量DOUBAN_COOKIE读取。
- backend/tests/douban.test.cjs：豆瓣8项测试，含预热2项（npm run test:douban）。
- backend/tests/search-order.test.cjs：搜索分组排序、加载更多、TG频道顺序与分页缓存、115探活缓存、补海报洗标题8项测试（npm run test:search）。
- nginx.conf（主工程根目录，打进镜像）：容器内nginx的gzip、静态资源缓存头和/api反代。
- 仓库根目录docker-compose.yml：cloudsaver可选DOUBAN_COOKIE。服务器上的compose文件含生产配置，不要用仓库版本覆盖。
- backend/src/services/Cloud115Service.ts：目录选择分页及ID保护。
- backend/src/services/OneStrmService.ts：校验Webhook响应success。
- backend/tests/subscriptions.test.cjs：26项隔离测试。

前端：
- frontend/src/views/Subscriptions.vue：共用PC/手机追更页。
- frontend/src/api/subscriptions.ts、frontend/src/components/FollowButton.vue。
- frontend/src/components/Home/ResourceCard.vue、ResourceTable.vue和components/mobile/ResourceCard.vue：关注按钮。
- frontend/src/components/AsideMenu.vue、views/mobile/Home.vue、router/pc-routes.ts、router/mobile-routes.ts：入口/路由。
- frontend/tests/subscriptions-preview.cjs：只用模拟数据的预览服务。
- frontend/src/utils/request.ts：网络异常无response保护。
- frontend/src/api/douban.ts：榜单请求单独等待30秒（全局为16秒）。
- frontend/src/api/resource.ts：搜索请求单独等待60秒。
- frontend/src/stores/resource.ts：加载更多按频道ID合并、按messageId去重；PanSou分组和115汇总不翻页；搜索结果和本地缓存恢复都经过withSummary115，存本地缓存时去掉汇总组。手机端监听resources引用变化会把当前标签页重置到第一个，所以加载更多只能原地改汇总，不能换数组。
- frontend/src/utils/resource.ts：115汇总（withSummary115、appendToSummary115、resourceStats）、isTelegramGroup（只有TG频道能翻页、有频道主页）、tagLabel（频道标签自带#，只显示一个）。对应测试frontend/tests/resource-summary.test.ts。
- frontend/src/components/Home/ResourceCard.vue、ResourceTable.vue：PanSou分组不显示「加载更多」。
- frontend/src/styles/tokens.scss：设计变量（颜色、圆角、阴影、间距），旧的--theme-*变量和Element Plus/Vant变量都映射到这里。global.scss通过@use注入每个文件，不能输出CSS。
- frontend/src/main.ts、components.d.ts：Element Plus按需加载。ElMessage/ElMessageBox和Vant的notify/dialog/toast是函数式调用，样式要在main.ts里手动引入。
- frontend/src/utils/resource.ts、frontend/src/constants/douban.ts：PC和手机共用的网盘类型工具和豆瓣榜单菜单。
- frontend/src/styles/theme.scss：温柔线描的全局皮肤（Element Plus和Vant组件的描边、圆角、按钮、标签、输入框），main.ts里紧跟tokens.scss引入。
- frontend/src/styles/tokens.scss里的线描变量：--line、--line-soft、--line-width（线条），--radius-sketch、--radius-sketch-sm、--radius-sketch-pill（手绘圆角），--surface（暖白底）。
- frontend/src/assets/moe/：22张手绘webp（吉祥物、登录/空状态/追更插画、手机端标签栏与输入框图标）。

设计与计划：
- G:\work\盘搜\docs\superpowers\specs\2026-11-12-subscription-auto-sync-design.md
- G:\work\盘搜\docs\plans\2026-11-12-subscription-auto-sync.md

后续执行命令（在G:\work\盘搜\cloudsaver-pansou）：

    npm run test:subscriptions
    npm run test:images
    npm run test:douban
    npm run test:search
    npm run build:backend
    npm run build:frontend
    npm --prefix frontend test
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

当前未创建用户影片订阅；自动追更已于2026-11-12部署上线（见“当前任务快照”），真实转存尚未验收。
