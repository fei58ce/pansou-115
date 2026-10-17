import { Request, Response } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../core/types";
import { Searcher } from "../services/Searcher";
import { PansouSearcher } from "../services/PansouSearcher";
import { BaseController } from "./BaseController";
import { config } from "../config";

/**
 * 支持通过 PanSou 检索的网盘类型
 * 注意：TG 频道只搜云盘链接，PanSou 才能搜磁力/电驴
 */
const PANSOU_CLOUD_TYPES: Record<string, string> = {
  pansou_115: "115",
  pansou_quark: "quark",
  pansou_aliyun: "aliyun",
  pansou_baidu: "baidu",
  pansou_magnet: "magnet",
  pansou_ed2k: "ed2k",
  pansou_xunlei: "xunlei",
  pansou_pikpak: "pikpak",
  pansou_123: "123",
};

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

      // 指定某个 PanSou 网盘渠道
      if (channelId && PANSOU_CLOUD_TYPES[channelId as string]) {
        const cloudType = PANSOU_CLOUD_TYPES[channelId as string];
        const items = await this.pansouSearcher.search(keywordText, cloudType);
        return {
          data: [
            {
              id: channelId as string,
              channelInfo: {
                channelId: channelId as string,
                name: `PanSou · ${this.cloudTypeLabel(cloudType)}`,
                channelLogo: "",
              },
              list: items,
            },
          ],
        };
      }

      // 默认并行调用：TG 频道 + PanSou 115 + PanSou magnet（如果启用）
      const enableMagnet = config.panSou.cloudTypes.includes("magnet");
      const tasks: Promise<any>[] = [
        this.searcher.searchAll(keywordText, channelId as string, lastMessageId as string),
        this.pansouSearcher.search(keywordText, "115"),
      ];
      if (enableMagnet) {
        tasks.push(this.pansouSearcher.search(keywordText, "magnet"));
      }

      const [tgResults, pansouItems, magnetItems] = await Promise.all(tasks);
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

      if (enableMagnet && magnetItems && magnetItems.length > 0) {
        results.unshift({
          id: "pansou_magnet",
          channelInfo: {
            channelId: "pansou_magnet",
            name: "PanSou · 磁力链接",
            channelLogo: "",
          },
          list: magnetItems,
        });
      }

      return { data: results };
    });
  }

  private cloudTypeLabel(type: string): string {
    const map: Record<string, string> = {
      baidu: "百度网盘",
      aliyun: "阿里云盘",
      quark: "夸克网盘",
      "115": "115网盘",
      xunlei: "迅雷网盘",
      pikpak: "PikPak",
      "123": "123网盘",
      magnet: "磁力链接",
      ed2k: "电驴链接",
    };
    return map[type] || type;
  }
}
