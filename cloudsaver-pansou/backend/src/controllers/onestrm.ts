import { Request, Response } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../core/types";
import { OneStrmService } from "../services/OneStrmService";
import { BaseController } from "./BaseController";

@injectable()
export class OneStrmController extends BaseController {
  constructor(@inject(TYPES.OneStrmService) private oneStrmService: OneStrmService) {
    super();
  }

  async getStatus(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const data = await this.oneStrmService.getStrmStatus();
      return { data };
    });
  }
}
