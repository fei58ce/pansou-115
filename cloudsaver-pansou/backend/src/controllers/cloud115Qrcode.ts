import { Request, Response } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../core/types";
import { Cloud115QrcodeService } from "../services/Cloud115QrcodeService";
import { Cloud115LixianService } from "../services/Cloud115LixianService";
import { Cloud115Service } from "../services/Cloud115Service";
import { BaseController } from "./BaseController";
import { getCookieFromRequest } from "../utils/cookieHelper";
import { logger } from "../utils/logger";
import QRCode from "qrcode";
import LixianTaskRecord from "../models/LixianTaskRecord";

/**
 * 115 网盘扩展控制器：
 * - 二维码扫码登录
 * - 离线下载任务（磁力/链接）
 */
@injectable()
export class Cloud115QrcodeController extends BaseController {
  constructor(
    @inject(TYPES.Cloud115QrcodeService)
    private qrcodeService: Cloud115QrcodeService,
    @inject(TYPES.Cloud115LixianService)
    private lixianService: Cloud115LixianService,
    @inject(TYPES.Cloud115Service)
    private cloud115Service: Cloud115Service
  ) {
    super();
  }

  /**
   * 初始化二维码登录
   * 返回 uid、原始 URL、base64 二维码图片
   */
  async init(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const data = await this.qrcodeService.init(req.body?.appType);
      return { data };
    });
  }

  /**
   * 查询扫码状态
   * query: uid
   * - status=confirmed 时会返回 cookie，并自动写入当前用户配置
   */
  async check(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const { uid } = req.query;
      if (!uid) {
        return { data: { status: "error" as const, message: "缺少 uid" } };
      }
      const userId = (req as any).user?.userId;
      const result = await this.qrcodeService.check(uid as string, userId);
      return { data: result };
    });
  }

  /**
   * 直接获取二维码图片（备用接口，方便前端传 url 自己渲染）
   * query: url
   */
  async getQrImage(req: Request, res: Response): Promise<void> {
    try {
      const { url } = req.query;
      if (!url) {
        res.status(400).json({ message: "缺少 url 参数" });
        return;
      }
      const image = await QRCode.toDataURL(url as string, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 240,
      });
      res.json({ image });
    } catch (error) {
      logger.error("生成二维码失败:", error);
      res.status(500).json({ message: "生成二维码失败" });
    }
  }

  /**
   * 添加 115 离线下载任务
   * body: { url, cid? }
   */
  async addLixianTask(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const cookie = await getCookieFromRequest(req, "cloud115");
      const { url, cid, newName } = req.body || {};
      if (!url) {
        throw new Error("缺少 url");
      }
      const userId = (req as any).user?.userId;
      if (!userId) throw new Error("用户ID无效");
      const record = await LixianTaskRecord.create({
        userId,
        url: String(url),
        cid: cid || "0",
        renameTo: String(newName || "").trim(),
      });
      try {
        const data = await this.lixianService.addTask(cookie, { url, cid });
        await record.update({
          taskId: data.taskId || "",
          status: 0,
          statusText: "已提交",
          name: data.message,
        });
        return { data: { ...data, recordId: record.id }, message: data.message };
      } catch (error) {
        await record.update({
          status: 3,
          statusText: "提交失败",
          lastError: error instanceof Error ? error.message : "提交失败",
        });
        throw error;
      }
    });
  }

  /** 获取本站保存的离线任务提交历史 */
  async getLixianHistory(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const userId = (req as any).user?.userId;
      if (!userId) throw new Error("用户ID无效");
      const data = await LixianTaskRecord.findAll({
        where: { userId },
        order: [["createdAt", "DESC"]],
        limit: 100,
      });
      return { data };
    });
  }

  /** 重试本站记录的失败离线任务 */
  async retryLixianTask(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const userId = (req as any).user?.userId;
      const recordId = String(req.body?.recordId || "");
      if (!userId || !recordId) throw new Error("缺少任务记录");
      const record = await LixianTaskRecord.findOne({ where: { id: recordId, userId } });
      if (!record) throw new Error("任务记录不存在");
      const cookie = await getCookieFromRequest(req, "cloud115");
      try {
        const data = await this.lixianService.addTask(cookie, { url: record.url, cid: record.cid });
        await record.update({
          taskId: data.taskId || "",
          status: 0,
          statusText: "已重试",
          lastError: "",
          renameApplied: false,
        });
        return { data: { ...data, recordId: record.id }, message: data.message };
      } catch (error) {
        await record.update({
          status: 3,
          statusText: "重试失败",
          lastError: error instanceof Error ? error.message : "重试失败",
        });
        throw error;
      }
    });
  }

  /** 对已完成的离线任务执行改名 */
  async renameLixianTask(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const userId = (req as any).user?.userId;
      const recordId = String(req.body?.recordId || "");
      const newName = String(req.body?.newName || "").trim();
      if (!userId || !recordId) throw new Error("缺少任务记录");

      const record = await LixianTaskRecord.findOne({
        where: { id: recordId, userId },
      });
      if (!record) throw new Error("任务记录不存在");

      const targetName = newName || record.renameTo;
      if (!targetName) throw new Error("请填写新的文件名");

      const cookie = await getCookieFromRequest(req, "cloud115");
      const tasks = await this.lixianService.listTasks(cookie);
      const task =
        tasks.find((item) => item.taskId && item.taskId === record.taskId) ||
        tasks.find((item) => item.name && record.name.includes(item.name));

      if (task && task.status !== 2) {
        throw new Error("任务尚未完成，当前状态：" + task.statusText);
      }

      const originalName =
        task?.name ||
        record.name
          .replace(/^已添加[:：]\s*/, "")
          .replace(/magnet:\?[^\s]+/gi, "")
          .replace(/https?:\/\/[^\s]+/gi, "")
          .trim();

      if (!originalName) {
        throw new Error("无法确定离线文件原名，请稍后在 115 中手动改名");
      }

      const item = await this.cloud115Service.findItemByName(
        cookie,
        record.cid || "0",
        originalName
      );
      if (!item) {
        throw new Error("未找到下载完成的文件/文件夹，请确认任务已完成且保存在所选目录");
      }

      await this.cloud115Service.renameItem(cookie, item.id, targetName);
      await record.update({
        name: targetName,
        renameTo: targetName,
        renameApplied: true,
        lastError: "",
      });

      return {
        data: {
          renamed: true,
          newName: targetName,
          isFolder: item.isFolder,
        },
        message: "重命名成功",
      };
    });
  }

  /**
   * 获取 115 离线任务列表
   */
  async getLixianTasks(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const cookie = await getCookieFromRequest(req, "cloud115");
      const data = await this.lixianService.listTasks(cookie);
      return { data };
    });
  }
}
