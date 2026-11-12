# 构建前端项目
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# 构建后端项目：bcrypt / sqlite3 的原生模块在这里编译，打包后裁掉开发依赖
FROM node:22-alpine AS backend-build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY backend/package.json backend/package-lock.json ./
RUN npm install
COPY backend/ ./
RUN rm -f database.sqlite
RUN npm run build && npm prune --omit=dev

# 生产环境镜像：和构建阶段同一个基础镜像，原生模块直接复用，不带编译工具
FROM node:22-alpine

# Nginx 提供前端页面；tini 做 1 号进程，转发停止信号并回收僵尸进程
RUN apk add --no-cache nginx tini

WORKDIR /app
RUN mkdir -p /app/config /app/data

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY --from=backend-build /app/package.json /app/.env.example ./
COPY --from=backend-build /app/node_modules ./node_modules
COPY --from=backend-build /app/dist ./dist

COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

VOLUME ["/app/config", "/app/data"]
EXPOSE 8008

ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]
