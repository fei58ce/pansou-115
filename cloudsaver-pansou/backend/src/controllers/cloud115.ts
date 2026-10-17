import { Request, Response } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../core/types";
import { Cloud115Service } from "../services/Cloud115Service";
import { OneStrmService } from "../services/OneStrmService";
import { BaseCloudController } from "./BaseCloudController";
import { getCookieFromRequest } from "../utils/cookieHelper";

@injectable()
export class Cloud115Controller extends BaseCloudController {
  constructor(
    @inject(TYPES.Cloud115Service) cloud115Service: Cloud115Service,
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
      try {
        await this.cloudService.getFolderList(cookie, "0");
        return { data: { valid: true, message: "115 授权有效" } };
      } catch (error) {
        return {
          data: {
            valid: false,
            message: error instanceof Error ? error.message : "115 授权已失效",
          },
        };
      }
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
