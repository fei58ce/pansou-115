import { Request, Response } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../core/types";
import { Searcher } from "../services/Searcher";
import { PansouSearcher } from "../services/PansouSearcher";
import { BaseController } from "./BaseController";

@injectable()
export class ResourceController extends BaseController {
  constructor(
    @inject(TYPES.Searcher) private searcher: Searcher,
    @inject(TYPES.PansouSearcher) private pansouSearcher: PansouSearcher
  ) {
    super();
  }

  async search(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const { keyword, channelId = "", lastMessageId = "" } = req.query;
      const keywordText = (keyword as string) || "";

      // 如果指定 PanSou 渠道，仅调用 PanSou
      if (channelId === "pansou_115") {
        const items = await this.pansouSearcher.search(keywordText, "115");
        return {
          data: [
            {
              id: "pansou_115",
              channelInfo: {
                channelId: "pansou_115",
                name: "PanSou · 115网盘",
                channelLogo: "",
              },
              list: items,
            },
          ],
        };
      }

      // 默认并行调用原有 TG 搜索 + PanSou 115 搜索
      const [tgResults, pansouItems] = await Promise.all([
        this.searcher.searchAll(keywordText, channelId as string, lastMessageId as string),
        this.pansouSearcher.search(keywordText, "115"),
      ]);

      const results = [...(tgResults.data || [])];
      if (pansouItems.length > 0) {
        results.unshift({
          id: "pansou_115",
          channelInfo: {
            channelId: "pansou_115",
            name: "PanSou · 115网盘",
            channelLogo: "",
          },
          list: pansouItems,
        });
      }

      return { data: results };
    });
  }
}
