import { Request, Response } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../core/types";
import { Cloud115Service } from "../services/Cloud115Service";
import { BaseCloudController } from "./BaseCloudController";
import { getCookieFromRequest } from "../utils/cookieHelper";

@injectable()
export class Cloud115Controller extends BaseCloudController {
  constructor(@inject(TYPES.Cloud115Service) cloud115Service: Cloud115Service) {
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
}
