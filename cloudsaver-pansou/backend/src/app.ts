// filepath: /d:/code/CloudDiskDown/backend/src/app.ts
import "./types/express";
import express from "express";
import type { Server } from "http";
import { container } from "./inversify.config";
import { TYPES } from "./core/types";
import { DatabaseService } from "./services/DatabaseService";
import { setupMiddlewares } from "./middleware";
import routes from "./routes/api";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/errorHandler";
import { SubscriptionEngine, defaultCookie, defaultDrive } from "./subscriptions/engine";
import { initSubscriptionTables } from "./subscriptions/models";
import { subscriptionRoutes } from "./subscriptions/routes";
import { PansouSearcher } from "./services/PansouSearcher";
import { OneStrmService } from "./services/OneStrmService";
import { DoubanService } from "./services/DoubanService";
import sequelize from "./config/database";

// docker stop 默认 10 秒后强杀，要在这之前收完尾
const SHUTDOWN_TIMEOUT_MS = 8000;

class App {
  private app = express();
  private server?: Server;
  private databaseService = container.get<DatabaseService>(TYPES.DatabaseService);

  private subscriptions = new SubscriptionEngine({
    drive: defaultDrive,
    cookie: defaultCookie,
    search: (title) => container.get<PansouSearcher>(TYPES.PansouSearcher).search(title, "115"),
    notify: () => container.get<OneStrmService>(TYPES.OneStrmService).triggerConfiguredScan(),
  });
  constructor() {
    this.setupExpress();
  }

  private setupExpress(): void {
    // 设置中间件
    setupMiddlewares(this.app);

    // 设置路由
    this.app.use("/subscriptions", subscriptionRoutes(this.subscriptions));
    this.app.use("/", routes);
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // 初始化数据库
      await this.databaseService.initialize();
      await initSubscriptionTables();
      this.subscriptions.start();
      logger.info("订阅调度已启动：每天18:00 Asia/Shanghai；仅处理已启用订阅");
      logger.info("数据库初始化成功");

      // 启动服务器
      const port = process.env.PORT || 8009;
      this.server = this.app.listen(port, () => {
        logger.info(`
🚀 服务器启动成功
🌍 监听端口: ${port}
🔧 运行环境: ${process.env.NODE_ENV || "development"}
        `);
        void container.get<DoubanService>(TYPES.DoubanService).warmUp();
      });
    } catch (error) {
      logger.error("服务器启动失败:", error);
      process.exit(1);
    }
  }

  /** 停订阅调度，不再接新请求并等手头的请求处理完，再关数据库。 */
  public async stop(): Promise<void> {
    this.subscriptions.stop();
    const server = this.server;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await sequelize.close();
  }
}

// 创建并启动应用
const application = new App();
application.start().catch((error) => {
  logger.error("应用程序启动失败:", error);
  process.exit(1);
});

let stopping = false;
const shutdown = (signal: NodeJS.Signals) => {
  if (stopping) return;
  stopping = true;
  logger.info(`收到 ${signal}，正在停止服务`);
  setTimeout(() => {
    logger.warn(`${SHUTDOWN_TIMEOUT_MS / 1000} 秒内没停完，强制退出`);
    process.exit(0);
  }, SHUTDOWN_TIMEOUT_MS).unref();
  application.stop().then(
    () => process.exit(0),
    (error) => {
      logger.error("停止服务出错:", error);
      process.exit(1);
    }
  );
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default application;
