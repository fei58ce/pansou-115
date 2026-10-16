import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { ICloudStorageService } from "@/types/services";
import { getCookieFromRequest } from "../utils/cookieHelper";

/**
 * 云盘控制器基类
 *
 * 在每个方法调用时从数据库中获取当前请求用户的 cookie，
 * 避免单例服务在多用户环境下因共享实例变量导致的状态污染。
 */
export abstract class BaseCloudController extends BaseController {
  constructor(protected cloudService: ICloudStorageService) {
    super();
  }

  /**
   * 子类必须实现此方法，返回当前控制器对应的网盘类型
   */
  protected abstract getCookieType(): "cloud115" | "quark";

  async getShareInfo(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const { shareCode, receiveCode } = req.query;
      const cookie = await getCookieFromRequest(req, this.getCookieType());
      return await this.cloudService.getShareInfo(
        shareCode as string,
        cookie,
        receiveCode as string
      );
    });
  }

  async getFolderList(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const { parentCid } = req.query;
      const cookie = await getCookieFromRequest(req, this.getCookieType());
      return await this.cloudService.getFolderList(cookie, parentCid as string);
    });
  }

  async saveFile(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const cookie = await getCookieFromRequest(req, this.getCookieType());
      return await this.cloudService.saveSharedFile(req.body, cookie);
    });
  }
}
