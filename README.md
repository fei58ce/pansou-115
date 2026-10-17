# 盘搜 · 115 网盘搜索与转存

基于 [CloudSaver](https://github.com/jiangrui1994/CloudSaver) + [PanSou](https://github.com/fish2018/pansou) 整合的一站式影视资源搜索与转存方案。

## 功能

- **搜索**：聚合 PanSou 的 110+ Telegram 频道（含 115 专属频道），自动按网盘类型归类
- **磁力**：搜索结果同步带出磁力链；支持一键复制，或提交到 **115 离线下载**（可选保存目录）
- **转存**：115 / 夸克网盘目录浏览与一键转存
- **115 扫码登录**：设置页生成二维码，用 115 App 扫码即可写入 Cookie（也可手动粘贴）
- **榜单**：豆瓣热门 + **TMDB**（趋势 / 流行 / 高分 / 上映），点击标题可跳转搜索
- **一体化部署**：`docker compose up -d` 同时启动搜索后端和 Web 前端

## 架构

```
CloudSaver (Web UI + 转存/离线)  ←→  PanSou (搜索 API, :8888)
        │
        └── Telegram 公开频道 + TMDB API
```

- `cloudsaver-pansou/`：CloudSaver 源码定制（PansouSearcher、扫码、TMDB、115 离线）
- `docker-compose.yml`：编排 PanSou + CloudSaver
- `HANDOFF.md`：开发交接说明（需求进度 / 坑点 / 下一步）

## 快速开始

### 前置要求

- Docker + Docker Compose

### 启动

```bash
docker compose up -d --build
```

| 服务 | 地址 |
|------|------|
| CloudSaver Web | http://localhost:8008 |
| PanSou API | http://localhost:8888 |

### 配置 115（推荐扫码）

1. 打开 http://localhost:8008 → 注册/登录 → **设置**
2. 点击 **扫码登录**，用 115 App 扫码并确认
3. Cookie 会自动写入；也可仍手动从浏览器复制 Cookie 粘贴

### 配置 TMDB 榜单（可选）

1. 在 [TMDB API 设置页](https://www.themoviedb.org/settings/api) 申请 API Key
2. 写入 `docker-compose.yml` 的 `TMDB_API_KEY`（或环境变量）
3. 重新 `docker compose up -d` 后，侧边栏 / 底部栏进入 **TMDB榜单**

### 使用流程

1. 搜索电影/剧集名，或从豆瓣 / TMDB 榜单点标题搜索
2. 结果中找「PanSou · 115网盘」或「PanSou · 磁力链接」
3. **网盘**：转存 → 选目录 → 确认  
4. **磁力**：复制磁力，或点「115离线」→ 选目录（或根目录）提交

## 配置

`docker-compose.yml` 关键环境变量：

| 变量 | 说明 |
|------|------|
| `CHANNELS` | PanSou 搜索的 Telegram 频道列表 |
| `PANSOU_BASE_URL` | CloudSaver 调 PanSou 的地址，容器内用 `http://pansou:8888` |
| `PANSOU_CLOUD_TYPES` | 启用类型，建议含 `115,magnet,ed2k` |
| `JWT_SECRET` | 登录令牌密钥，**部署前务必修改** |
| `TELE_CHANNELS` | CloudSaver 原生 TG 频道搜索（JSON） |
| `TMDB_API_KEY` | TMDB API Key（不配则榜单为空） |
| `TMDB_BASE_URL` | 默认 `https://api.themoviedb.org/3`，国内可改代理 |
| `TMDB_LANGUAGE` | 默认 `zh-CN` |

### 需要代理

服务器无法直连 Telegram 时，取消 `docker-compose.yml` 中 pansou 的 `PROXY` 注释：

```yaml
PROXY: "socks5://host.docker.internal:7890"
```

## 数据持久化

用户、Cookie、SQLite 保存在 `./data/cloudsaver/`。

## 许可证

- CloudSaver：MIT License（见 `cloudsaver-pansou/LICENSE`）
- PanSou：以 Docker 镜像方式使用，许可证见上游仓库

## 免责声明

本项目仅聚合公开网络中的分享链接，不存储、不传播任何受版权保护的内容。请遵守当地法律法规及平台使用条款。
