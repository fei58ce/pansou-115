import { Request, Response } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../core/types";
import { Cloud115QrcodeService } from "../services/Cloud115QrcodeService";
import { Cloud115LixianService } from "../services/Cloud115LixianService";
import { BaseController } from "./BaseController";
import { getCookieFromRequest } from "../utils/cookieHelper";
import { logger } from "../utils/logger";
import QRCode from "qrcode";

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
    private lixianService: Cloud115LixianService
  ) {
    super();
  }

  /**
   * 初始化二维码登录
   * 返回 uid、原始 URL、base64 二维码图片
   */
  async init(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const data = await this.qrcodeService.init();
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
      const result = await this.qrcodeService.check(uid as string);

      // 确认成功后自动保存 cookie 到用户设置
      if (result.status === "confirmed" && result.cookie) {
        try {
          const userId = (req as any).user?.userId;
          if (userId) {
            await this.qrcodeService.saveCookieForUser(userId, result.cookie);
          }
        } catch (error) {
          logger.error("保存 115 cookie 失败:", error);
        }
      }

      return { data: result as { status: string; message?: string; cookie?: string } };
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
      const { url, cid } = req.body || {};
      if (!url) {
        throw new Error("缺少 url");
      }
      const data = await this.lixianService.addTask(cookie, { url, cid });
      return { data, message: data.message };
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
