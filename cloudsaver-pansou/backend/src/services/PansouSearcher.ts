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

interface PansouCheckResult {
  disk_type: string;
  url: string;
  normalized_url?: string;
  state: "ok" | "bad" | "locked" | "unsupported" | "uncertain";
  summary?: string;
}

interface PansouCheckResponse {
  results?: PansouCheckResult[];
}

interface SearchItem {
  id: string;
  title: string;
  cloudLinks: string[];
  cloudType: string;
  channel: string;
  channelId: string;
  pubDate: string;
  content: string;
  messageId: string;
  tags: string[];
  image: string;
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

  async search(keyword: string, cloudType?: string): Promise<SearchItem[]> {
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

      const items: SearchItem[] = links.map((link, index) => ({
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

      return this.filterDeadLinks(items, targetType);
    } catch (error) {
      logger.error("PanSou 搜索失败:", error);
      return [];
    }
  }

  /**
   * 过滤确认已失效的分享链接。
   *
   * 策略（保守）：
   * - bad（已取消/失效/违规）→ 过滤
   * - locked（需要提取码，无法确认）→ 保留
   * - uncertain（探测失败）→ 保留
   * - ok → 保留
   *
   * 探活失败（网络问题等）整体跳过过滤，避免误杀。
   */
  private async filterDeadLinks(items: SearchItem[], cloudType: string): Promise<SearchItem[]> {
    if (items.length === 0) return items;

    try {
      const response = await this.api.post<PansouCheckResponse>("/api/check/links", {
        items: items.map((item) => ({
          disk_type: cloudType,
          url: item.cloudLinks[0],
          password: this.extractPasswordFromUrl(item.cloudLinks[0]),
        })),
      });

      const results = response.data?.results || [];
      const deadUrls = new Set(
        results.filter((r) => r.state === "bad").map((r) => r.normalized_url || r.url)
      );

      if (deadUrls.size === 0) return items;

      const filtered = items.filter((item) => !deadUrls.has(item.cloudLinks[0]));
      logger.info(`[PanSou] 过滤失效链接: ${items.length} -> ${filtered.length}`);
      return filtered;
    } catch (error) {
      logger.error("PanSou 链接探活失败，跳过过滤:", error);
      return items;
    }
  }

  private extractPasswordFromUrl(url: string): string {
    const match = url.match(/[?&]password=([^&#]+)/);
    return match ? decodeURIComponent(match[1]) : "";
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
