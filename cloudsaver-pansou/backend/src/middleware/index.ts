import { Application } from "express";
import express from "express";
import { authMiddleware } from "./auth";
import { requestLogger } from "./requestLogger";
import { rateLimiter } from "./rateLimiter";
import { cors } from "./cors";

/**
 * 配置应用中间件。
 *
 * 执行顺序：
 * 1. body parser：解析请求体
 * 2. cors：处理跨域（包括 OPTIONS 预检），先于鉴权便于预检通过
 * 3. rateLimiter：限流，丢弃明显异常流量
 * 4. requestLogger：记录请求日志（包含被限流/鉴权失败的请求）
 * 5. authMiddleware：JWT 鉴权
 */
export const setupMiddlewares = (app: Application) => {
  app.use(express.json());
  app.use(cors());
  app.use(rateLimiter());
  app.use(requestLogger());
  app.use(authMiddleware);
};
