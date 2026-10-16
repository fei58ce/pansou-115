# 盘搜 · 115 网盘搜索与转存

基于 [CloudSaver](https://github.com/jiangrui1994/CloudSaver) + [PanSou](https://github.com/fish2018/pansou) 整合的一站式 115 网盘影视资源搜索与转存方案。

## 功能

- **搜索**：聚合 PanSou 的 110+ Telegram 频道（含 `Channel_Shares_115`、`vip115hot`、`gimy115iso` 等 115 专属频道），自动按 115 网盘类型归类结果
- **转存**：复用 CloudSaver 的 115 转存链路——浏览网盘目录、选择目标文件夹、一键保存分享文件
- **一体化部署**：`docker compose up -d` 同时启动搜索后端和 Web 前端

## 架构

```
CloudSaver (Web UI + 115 转存)  ←→  PanSou (搜索 API, :8888)
        │
        └── Telegram 公开频道（无需账号/API）
```

- `cloudsaver-pansou/`：CloudSaver 源码，已增加 `PansouSearcher` 服务，搜索时自动调用 PanSou 并把 115 结果合并到结果列表顶部
- `docker-compose.yml`：编排 PanSou + CloudSaver 两个服务

## 快速开始

### 前置要求

- Docker + Docker Compose

### 启动

```bash
docker compose up -d --build
```

启动后：

| 服务 | 地址 |
|------|------|
| CloudSaver Web | http://localhost:8008 |
| PanSou API | http://localhost:8888 |

### 配置 115 Cookie

1. 浏览器登录 [115 网盘网页版](https://115.com)
2. F12 → Network → 刷新页面 → 任选一个 `115.com` 请求 → 复制完整 Cookie
3. 打开 http://localhost:8008 → 注册/登录 → 设置 → 填入 115 Cookie

### 使用流程

1. 搜索电影/剧集名
2. 结果列表中找「PanSou · 115网盘」分组
3. 点击转存 → 选择目标文件夹 → 确认

## 配置

`docker-compose.yml` 中的关键环境变量：

| 变量 | 说明 |
|------|------|
| `CHANNELS` | PanSou 搜索的 Telegram 频道列表（逗号分隔） |
| `PANSOU_BASE_URL` | CloudSaver 调用 PanSou 的地址，容器间通信用 `http://pansou:8888` |
| `JWT_SECRET` | CloudSaver 登录令牌加密密钥，**部署前务必修改** |
| `TELE_CHANNELS` | CloudSaver 原生 TG 频道搜索源（JSON 数组） |

### 只搜 115

如果只想搜 115，可以把 `CHANNELS` 精简为：

```
Channel_Shares_115,vip115hot,gimy115iso
```

### 需要代理

如果你的服务器无法直连 Telegram，取消 `docker-compose.yml` 中 `PROXY` 的注释：

```yaml
PROXY: "socks5://host.docker.internal:7890"
```

## 数据持久化

CloudSaver 的用户、Cookie 配置和 SQLite 数据库保存在 `./data/cloudsaver/`。

## 许可证

- CloudSaver：MIT License（见 `cloudsaver-pansou/LICENSE`）
- PanSou：以 Docker 镜像方式使用，其源码许可证见上游仓库

## 免责声明

本项目仅聚合公开网络中的分享链接，不存储、不传播任何受版权保护的内容。请遵守当地法律法规及平台使用条款。
