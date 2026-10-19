import { Request, Response } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../core/types";
import { Cloud115Service } from "../services/Cloud115Service";
import { OneStrmService } from "../services/OneStrmService";
import { BaseCloudController } from "./BaseCloudController";
import { getCookieFromRequest } from "../utils/cookieHelper";
import UserSetting from "../models/UserSetting";

@injectable()
export class Cloud115Controller extends BaseCloudController {
  constructor(
    @inject(TYPES.Cloud115Service) private cloud115Service: Cloud115Service,
    @inject(TYPES.OneStrmService) private oneStrmService: OneStrmService
  ) {
    super(cloud115Service);
  }

  protected getCookieType(): "cloud115" {
    return "cloud115";
  }

  async checkAuth(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const cookie = await getCookieFromRequest(req, this.getCookieType());
      const userId = (req as any).user?.userId;
      const validation = await this.cloud115Service.validateCookie(cookie);
      const setting = userId ? await UserSetting.findOne({ where: { userId } }) : null;
      return {
        data: {
          ...validation,
          appType: setting?.cloud115AppType || "",
          userName: setting?.cloud115UserName || "",
          validatedAt: setting?.cloud115ValidatedAt || null,
        },
      };
    });
  }

  /** 转存成功后，按设置可选通知 OneStrm 扫描监控路径。 */
  async saveFile(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const cookie = await getCookieFromRequest(req, this.getCookieType());
      const result = await this.cloudService.saveSharedFile(req.body, cookie);
      const oneStrm = await this.oneStrmService.triggerConfiguredScan();
      return {
        data: { ...result, oneStrm },
        message: result.message,
      };
    });
  }
}
