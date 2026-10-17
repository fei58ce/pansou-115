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
      // 一次请求同时拿 merged_by_type（链接）+ results（含 TG/插件源的图片）
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
        image: this.matchImage(link, titleImageMap),
        // 磁力类型：magnet 类型时把 url 放入 magnet 字段
        magnet: targetType === "magnet" ? [link.url] : undefined,
        ed2k: targetType === "ed2k" ? [link.url] : undefined,
      }));
    } catch (error) {
      logger.error("PanSou 搜索失败:", error);
      return [];
    }
  }

  /**
   * 从 results 构建标题 → 图片映射
   * TG/插件源的结果自带 images 字段（海报）
   */
  private buildTitleImageMap(results: PansouResultImage[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const r of results) {
      if (r.images && r.images.length > 0 && r.title) {
        // 归一化标题（去空格/标点差异），取第一张图
        const key = this.normalizeTitle(r.title);
        if (key && !map.has(key)) {
          map.set(key, r.images[0]);
        }
      }
    }
    return map;
  }

  /**
   * 给链接匹配海报：
   * 1. 精确标题匹配
   * 2. 包含匹配（A 包含 B 或 B 包含 A，长度 ≥ 4 避免误配）
   */
  private matchImage(link: PansouMergedLink, imageMap: Map<string, string>): string {
    const title = this.extractTitle(link);
    if (!title || imageMap.size === 0) return "";

    const normalized = this.normalizeTitle(title);
    if (!normalized) return "";

    // 精确匹配
    const exact = imageMap.get(normalized);
    if (exact) return exact;

    // 包含匹配（较短的一方至少 4 个字符）
    for (const [key, img] of imageMap.entries()) {
      if (key.length >= 4 && normalized.length >= 4) {
        if (normalized.includes(key) || key.includes(normalized)) {
          return img;
        }
      }
    }
    return "";
  }

  /**
   * 标题归一化：去空格、常见标点、集数/质量等干扰词，便于匹配
   */
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
      if (firstLine.trim()) {
        return firstLine.trim().slice(0, 100);
      }
    }
    const url = link.url || "";
    if (/^magnet:/i.test(url)) {
      const hash = url.match(/btih:([a-zA-Z0-9]+)/i)?.[1] || "";
      return hash ? `磁力 ${hash.slice(0, 16)}...` : "磁力资源";
    }
    if (/^ed2k:/i.test(url)) {
      return "电驴资源";
    }
    const match = url.match(/\/s\/([a-zA-Z0-9]+)/);
    return match ? `网盘分享 ${match[1]}` : "网盘分享";
  }
}
