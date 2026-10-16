import { AxiosInstance } from "axios";
import axios from "axios";
import { injectable } from "inversify";
import { logger } from "../utils/logger";

interface PansouMergedLink {
  url: string;
  password?: string;
  note?: string;
  datetime?: string;
}

interface PansouSearchResponse {
  code: number;
  message: string;
  data?: {
    total?: number;
    merged_by_type?: Record<string, PansouMergedLink[]>;
  };
}

@injectable()
export class PansouSearcher {
  private api: AxiosInstance;

  constructor() {
    const baseURL = process.env.PANSOU_BASE_URL || "http://pansou:8888";
    this.api = axios.create({
      baseURL,
      timeout: 30000,
    });
  }

  async search(keyword: string, cloudType?: string) {
    if (!keyword?.trim()) {
      return [];
    }

    try {
      const response = await this.api.get<PansouSearchResponse>("/api/search", {
        params: {
          kw: keyword,
          res: "merged_by_type",
          cloud_types: cloudType || undefined,
        },
      });

      const merged = response.data?.data?.merged_by_type || {};
      const targetType = cloudType || "115";
      const links = merged[targetType] || [];

      return links.map((link, index) => ({
        id: `pansou-${targetType}-${index}`,
        title: this.extractTitle(link),
        cloudLinks: [link.url],
        cloudType: targetType,
        channel: `PanSou/${targetType}`,
        channelId: `pansou_${targetType}`,
        pubDate: link.datetime || "",
        content: link.note || "",
        messageId: "",
        tags: [],
        image: "",
      }));
    } catch (error) {
      logger.error("PanSou 搜索失败:", error);
      return [];
    }
  }

  private extractTitle(link: PansouMergedLink): string {
    const note = link.note || "";
    if (note) {
      const firstLine = note.split(/\r?\n/)[0];
      if (firstLine.trim()) {
        return firstLine.trim().slice(0, 100);
      }
    }
    const url = link.url || "";
    const match = url.match(/\/s\/([a-zA-Z0-9]+)/);
    return match ? `115分享 ${match[1]}` : "115分享";
  }
}
