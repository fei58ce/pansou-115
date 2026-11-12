// filepath: /d:/code/CloudDiskDown/backend/src/app.ts
import "./types/express";
import express from "express";
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
class App {
  private app = express();
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
      this.app.listen(port, () => {
        logger.info(`
🚀 服务器启动成功
🌍 监听端口: ${port}
🔧 运行环境: ${process.env.NODE_ENV || "development"}
        `);
      });
    } catch (error) {
      logger.error("服务器启动失败:", error);
      process.exit(1);
    }
  }
}

// 创建并启动应用
const application = new App();
application.start().catch((error) => {
  logger.error("应用程序启动失败:", error);
  process.exit(1);
});

export default application;
