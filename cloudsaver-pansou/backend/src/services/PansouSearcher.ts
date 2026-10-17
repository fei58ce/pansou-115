import { AxiosInstance } from "axios";
import axios from "axios";
import { inject, injectable } from "inversify";
import { logger } from "../utils/logger";
import { TYPES } from "../core/types";
import { TmdbService } from "./TmdbService";
import { DoubanService } from "./DoubanService";

interface PansouMergedLink {
  url: string;
  password?: string;
  note?: string;
  datetime?: string;
  images?: string[];
}

interface PansouResultImage {
  title: string;
  images: string[];
}

interface PansouSearchResponse {
  code: number;
  message: string;
  data?: {
    total?: number;
    merged_by_type?: Record<string, PansouMergedLink[]>;
    results?: PansouResultImage[];
  };
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
  magnet?: string[];
  ed2k?: string[];
  linkStatus?: "ok" | "bad" | "locked" | "unsupported" | "uncertain";
  linkStatusMessage?: string;
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

@injectable()
export class PansouSearcher {
  private api: AxiosInstance;
  private posterCache = new Map<string, string>();

  constructor(
    @inject(TYPES.TmdbService) private tmdbService: TmdbService,
    @inject(TYPES.DoubanService) private doubanService: DoubanService
  ) {
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
      const results = response.data?.data?.results || [];
      const titleImageMap = this.buildTitleImageMap(results);
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
        image: link.images?.[0] || this.matchImage(link, titleImageMap),
        magnet: targetType === "magnet" ? [link.url] : undefined,
        ed2k: targetType === "ed2k" ? [link.url] : undefined,
      }));
      if (targetType !== "magnet" && targetType !== "ed2k") {
        await this.fillMissingPosters(items);
      }
      if (targetType === "115") {
        await this.checkLinkStatus(items, targetType);
      }
      return this.rankItems(items, keyword);
    } catch (error) {
      logger.error("PanSou 搜索失败:", error);
      return [];
    }
  }

  /**
   * 搜索结果质量排序。
   * 分数越高越靠前：标题匹配 > 完整/合集 > 清晰度 > 来源信息 > 图片 > 新鲜度。
   */
  private rankItems(items: SearchItem[], keyword: string): SearchItem[] {
    const query = this.normalizeTitle(keyword);
    const now = Date.now();

    const score = (item: SearchItem): number => {
      const title = item.title || "";
      const normalized = this.normalizeTitle(title);
      let value = 0;

      if (query && normalized === query) value += 100;
      else if (query && normalized.includes(query)) value += 70;
      else if (query && query.includes(normalized) && normalized.length >= 4) value += 50;

      // 完整合集/全集优先，预告/花絮/解说等非主资源降权
      if (/(全集|全季|合集|完结|全\d+集|S\d+完)/i.test(title)) value += 30;
      if (/(预告|预览|花絮|解说|剪辑|片段|采访|短片)/i.test(title)) value -= 25;

      // 常见质量标签
      if (/(4K|2160p|UHD)/i.test(title)) value += 18;
      else if (/1080p/i.test(title)) value += 12;
      else if (/720p/i.test(title)) value += 5;
      if (/(BluRay|Blu-ray|Remux)/i.test(title)) value += 12;
      if (/(HDR|杜比|Dolby|DV|全景声|Atmos)/i.test(title)) value += 8;
      if (/(简中|繁中|中字|中英|双语)/i.test(title)) value += 4;

      // 有描述、图片、密码信息的结果更适合直接使用
      if (item.content) value += 3;
      if (item.image) value += 8;
      if (/[?&](password|pwd)=/i.test(item.cloudLinks[0] || "")) value += 2;

      // 新鲜度最多加 10 分，避免完全压过标题匹配
      if (item.pubDate) {
        const time = Date.parse(item.pubDate);
        if (!Number.isNaN(time)) {
          const days = Math.max(0, (now - time) / 86_400_000);
          value += Math.max(0, 10 - Math.min(days, 10));
        }
      }
      return value;
    };

    return items
      .map((item, index) => ({ item, index, score: score(item) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ item }) => item);
  }
  /** 批量探活 115 链接；只过滤明确 bad，网络不确定时保留结果。 */
  private async checkLinkStatus(items: SearchItem[], cloudType: string): Promise<void> {
    if (!items.length) return;
    try {
      const response = await this.api.post<PansouCheckResponse>("/api/check/links", {
        items: items.map((item) => ({
          disk_type: cloudType,
          url: item.cloudLinks[0],
          password: this.extractPassword(item.cloudLinks[0]),
        })),
      });
      const resultMap = new Map((response.data?.results || []).map((item) => [item.url, item]));
      for (const item of items) {
        const result = resultMap.get(item.cloudLinks[0]);
        if (result) {
          item.linkStatus = result.state;
          item.linkStatusMessage = result.summary || "";
        }
      }
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].linkStatus === "bad") items.splice(i, 1);
      }
    } catch (error) {
      logger.warn("115 链接探活失败，保留原始搜索结果:", error);
    }
  }

  private extractPassword(url: string): string {
    const match = url.match(/[?&](?:password|pwd)=([^&#]+)/i);
    return match ? decodeURIComponent(match[1]) : "";
  }

  /** 给仍然没有图片的结果按标题补 TMDB/豆瓣海报。 */
  private async fillMissingPosters(items: SearchItem[]): Promise<void> {
    const titles = [
      ...new Set(
        items
          .filter((item) => !item.image)
          .map((item) => this.extractMediaTitle(item.title))
          .filter((title) => title.length >= 2)
      ),
    ].slice(0, 30);

    if (titles.length === 0) return;

    await Promise.all(
      titles.map(async (title) => {
        if (this.posterCache.has(title)) return;
        let poster = "";
        try {
          poster = await this.tmdbService.searchPoster(title);
        } catch (error) {
          logger.warn(`TMDB 补图失败（${title}）:`, error);
        }
        if (!poster) {
          try {
            poster = await this.doubanService.searchPoster(title);
          } catch (error) {
            logger.warn(`豆瓣补图失败（${title}）:`, error);
          }
        }
        this.posterCache.set(title, poster);
      })
    );

    for (const item of items) {
      if (item.image) continue;
      const title = this.extractMediaTitle(item.title);
      item.image = this.posterCache.get(title) || "";
    }
  }

  /** 去掉季数、清晰度、字幕和资源包装信息，保留影视主标题。 */
  private extractMediaTitle(title: string): string {
    return title
      .replace(/^名称\s*[:：]\s*/i, "")
      .replace(/[(（【][^)）】]*[)）】]/gu, " ")
      .replace(
        /(第[一二三四五六七八九十百千0-9]+季|S\d{1,2}E\d{1,3}|全\d+集|更新至\d+集|\d{4}|4k|8k|2160p|1080p|720p|hdr|dv|dolby|vision|nf|web-?dl|blu-?ray|remux|内封|外挂|简中|繁中|中英|双语|杜比|全景声|atmos)/gi,
        " "
      )
      .replace(/[【】()（）{}]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  }

  private buildTitleImageMap(results: PansouResultImage[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const result of results) {
      if (result.images?.length && result.title) {
        const key = this.normalizeTitle(result.title);
        if (key && !map.has(key)) map.set(key, result.images[0]);
      }
    }
    return map;
  }

  private matchImage(link: PansouMergedLink, imageMap: Map<string, string>): string {
    const normalized = this.normalizeTitle(this.extractTitle(link));
    if (!normalized) return "";
    const exact = imageMap.get(normalized);
    if (exact) return exact;
    for (const [key, image] of imageMap.entries()) {
      if (
        key.length >= 4 &&
        normalized.length >= 4 &&
        (normalized.includes(key) || key.includes(normalized))
      ) {
        return image;
      }
    }
    return "";
  }

  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/名称[:：]/g, "")
      .replace(/[(（【][^)）】]*[)）】]/gu, " ")
      .replace(/[^\p{L}\p{N}]+/gu, "")
      .replace(
        /(第[一二三四五六七八九十百千0-9]+季|S\d{1,2}E\d{1,3}|全\d+集|更新至\d+集|\d{4}[集hpxkv]|\d+p|4k|8k|hdr|dv|dolby|vision|nf|web-?dl|blu-?ray|remux|内封|外挂|简中|繁中|中英|双语|杜比|全景声|atmos|2160p|1080p|720p)/gi,
        ""
      )
      .trim();
  }

  private extractTitle(link: PansouMergedLink): string {
    const note = link.note || "";
    if (note) {
      const firstLine = note.split(/\r?\n/)[0];
      if (firstLine.trim()) return firstLine.trim().slice(0, 100);
    }
    const url = link.url || "";
    if (/^magnet:/i.test(url)) {
      const hash = url.match(/btih:([a-zA-Z0-9]+)/i)?.[1] || "";
      return hash ? `磁力 ${hash.slice(0, 16)}...` : "磁力资源";
    }
    if (/^ed2k:/i.test(url)) return "电驴资源";
    const match = url.match(/\/s\/([a-zA-Z0-9]+)/);
    return match ? `网盘分享 ${match[1]}` : "网盘分享";
  }
}
