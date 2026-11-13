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

type LinkState = "ok" | "bad" | "locked" | "unsupported" | "uncertain";

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
  linkStatus?: LinkState;
  linkStatusMessage?: string;
}

interface PansouCheckResult {
  disk_type: string;
  url: string;
  normalized_url?: string;
  state: LinkState;
  summary?: string;
}

interface PansouCheckResponse {
  results?: PansouCheckResult[];
}

// 补图只等这么久，没查完的在后台继续并写进缓存，下次搜同一部直接命中
const POSTER_WAIT_MS = 5000;
const POSTER_CACHE_LIMIT = 2000;
const POSTER_HIT_TTL = 24 * 60 * 60 * 1000;
// 没查到海报的标题过一阵再查，TMDB/豆瓣可能只是当时没连上
const POSTER_MISS_TTL = 30 * 60 * 1000;
// 资源名里跟在片名后面的发布信息：年份、季集、清晰度、大小、编码音轨、语言字幕、版本。英文标签要求前后不是字母，免得切到英文片名中间
const RELEASE_INFO = new RegExp(
  [
    "(?<!\\d)(?:19|20)\\d{2}(?!\\d)",
    "第[\\d一二三四五六七八九十百千零两]+[季部集期话]",
    "(?:全|共)\\d+[集话期]|(?<!\\d)\\d+[集话期]全?|全集|合集|系列|已?完结|更新至?|更至",
    "(?<![a-z])(?:S\\d{1,2}(?:E\\d{1,4})?|EP?\\d{1,4}|V\\d+版?)(?![a-z])",
    "(?<![a-z\\d])(?:\\d{3,4}[PI]|[248]K|\\d+(?:FPS|帧))(?![a-z])",
    "(?<![\\d.])\\d+(?:\\.\\d+)?\\s?(?:[GMT]B|G)(?![a-z])",
    "(?<![a-z])(?:WEB-?DL|WEB-?RIP|BDRIP|HDRIP|DVDRIP|BLU-?RAY|REMUX|HDTV|ULTRA\\s?HD|UHD|HD|BD|DVD|H\\s?26[45]|X\\s?26[45]|HEVC|AVC|AV1|\\d+BIT|HDR10\\+?|HDR|DV|DOVI|DOLBY|ATMOS|TRUEHD|DTS|DDP?\\d(?:\\.\\d)?|AAC|FLAC|AC3|NF|AMZN|DSNP|IMAX)(?![a-z])",
    "国语|粤语|国粤|国英|国沪|英语|日语|韩语|双语|中字|中英|双字|简中|繁中|简繁|内封|内嵌|外挂|字幕|杜比|全景声|高码|普码|高清|超清|蓝光|原盘|无水印|去广告|[各双多全]?版本",
    "(?:纯净|导演剪辑|剪辑|加长|国际|未删减|无删减|完整|修复|重制|典藏|珍藏|特别|院线|抢先)版",
  ].join("|"),
  "gi"
);
// 资源名开头常见的分类、画质标签，不是片名
const LEADING_TAG =
  /^(?:(?:国产|国内|华语|欧美|日韩|日本|韩国|美国|英国|泰国|港台|香港|台湾|大陆|内地|[国美韩日英泰港台])?(?:电视剧|连续剧|剧集|剧|动画电影|电影|动画|动漫|番剧|漫|综艺|纪录片|短剧)|[248]K|\d{3,4}[PI]|高清|超清|蓝光|杜比视界|HDR|合集)$/i;
// 点号夹在两个数字中间时不算分隔，保住 60.25GB、5.1 这类数值
const TITLE_SEPARATOR =
  /[[\]【】()（）{}「」『』《》〈〉<>|｜/\\_+&＆➕,，;；:：~～]|(?<!\d)\.|\.(?!\d)/g;
// 线上 115 探活偶尔要十几秒：搜索最多等 30 秒，没探完的在后台继续并写进缓存，下次搜到同一链接直接用
const LINK_CHECK_WAIT_MS = 30000;
const LINK_CHECK_TIMEOUT = 60000;
// 坏链基本不会复活，存久一点；正常/加密的链接随时可能失效，存短一点；探不出结果的不存
const LINK_STATUS_TTL: Partial<Record<LinkState, number>> = {
  bad: 12 * 60 * 60 * 1000,
  unsupported: 12 * 60 * 60 * 1000,
  ok: 60 * 60 * 1000,
  locked: 60 * 60 * 1000,
};
const LINK_STATUS_CACHE_LIMIT = 5000;

@injectable()
export class PansouSearcher {
  private api: AxiosInstance;
  private posterCache = new Map<string, { poster: string; at: number }>();
  private pendingPosters = new Map<string, Promise<string>>();
  private linkStatusCache = new Map<string, { state: LinkState; summary: string; at: number }>();

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
      const uniqueItems = this.dedupeItems(items);
      const needPosters = targetType !== "magnet" && targetType !== "ed2k";
      // 补海报和 115 探活互不依赖，并行跑
      await Promise.all([
        needPosters ? this.fillMissingPosters(uniqueItems) : null,
        targetType === "115" ? this.checkLinkStatus(uniqueItems, targetType) : null,
      ]);
      const aliveItems = uniqueItems.filter((item) => item.linkStatus !== "bad");
      return this.rankItems(aliveItems, keyword);
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
  /** 去除完全重复链接和完全相同的资源标题，不合并不同季/不同集。 */
  private dedupeItems(items: SearchItem[]): SearchItem[] {
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const result: SearchItem[] = [];
    for (const item of items) {
      const urlKey = (item.cloudLinks[0] || "").toLowerCase().split("#")[0];
      const titleKey = this.dedupeTitle(item.title);
      if ((urlKey && seenUrls.has(urlKey)) || (titleKey && seenTitles.has(titleKey))) {
        continue;
      }
      if (urlKey) seenUrls.add(urlKey);
      if (titleKey) seenTitles.add(titleKey);
      result.push(item);
    }
    return result;
  }

  private dedupeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/名称[:：]/g, "")
      .replace(/[(（【][^)）】]*[)）】]/gu, " ")
      .replace(
        /(4k|8k|2160p|1080p|720p|hdr|dv|dolby|vision|nf|web-?dl|blu-?ray|remux|内封|外挂|简中|繁中|中英|双语|杜比|全景声|atmos)/gi,
        " "
      )
      .replace(/[^\p{L}\p{N}]+/gu, "")
      .trim();
  }

  /**
   * 批量探活 115 链接并写回 linkStatus：缓存里有的直接用，只把没缓存的发给 PanSou。
   * 探活失败或超时就不标状态，结果照常保留。
   */
  private async checkLinkStatus(items: SearchItem[], cloudType: string): Promise<void> {
    if (!items.length) return;
    const fresh = new Map<string, PansouCheckResult>();
    const unchecked = [
      ...new Set(
        items.map((item) => item.cloudLinks[0]).filter((url) => url && !this.cachedLinkStatus(url))
      ),
    ];
    if (unchecked.length) {
      let timer: NodeJS.Timeout | undefined;
      const finished = await Promise.race([
        this.requestLinkStatus(unchecked, cloudType).then((results) => {
          for (const result of results) fresh.set(result.url, result);
          return true;
        }),
        new Promise<false>((resolve) => {
          timer = setTimeout(() => resolve(false), LINK_CHECK_WAIT_MS);
        }),
      ]);
      clearTimeout(timer);
      if (!finished) {
        logger.info(`115 探活超过 ${LINK_CHECK_WAIT_MS / 1000} 秒，先返回结果，探完的写进缓存`);
      }
    }
    for (const item of items) {
      const status = fresh.get(item.cloudLinks[0]) || this.cachedLinkStatus(item.cloudLinks[0]);
      if (status) {
        item.linkStatus = status.state;
        item.linkStatusMessage = status.summary || "";
      }
    }
  }

  /** 发给 PanSou 探活，能缓存的结果写进缓存；失败只记日志。 */
  private async requestLinkStatus(urls: string[], cloudType: string): Promise<PansouCheckResult[]> {
    try {
      const response = await this.api.post<PansouCheckResponse>(
        "/api/check/links",
        {
          items: urls.map((url) => ({
            disk_type: cloudType,
            url,
            password: this.extractPassword(url),
          })),
        },
        { timeout: LINK_CHECK_TIMEOUT }
      );
      const results = response.data?.results || [];
      const at = Date.now();
      for (const result of results) {
        if (!LINK_STATUS_TTL[result.state]) continue;
        this.linkStatusCache.delete(result.url);
        this.linkStatusCache.set(result.url, {
          state: result.state,
          summary: result.summary || "",
          at,
        });
      }
      for (const url of this.linkStatusCache.keys()) {
        if (this.linkStatusCache.size <= LINK_STATUS_CACHE_LIMIT) break;
        this.linkStatusCache.delete(url);
      }
      return results;
    } catch (error) {
      logger.warn("115 链接探活失败，保留原始搜索结果:", error);
      return [];
    }
  }

  private cachedLinkStatus(url: string) {
    const hit = this.linkStatusCache.get(url);
    if (hit && Date.now() - hit.at > (LINK_STATUS_TTL[hit.state] || 0)) {
      this.linkStatusCache.delete(url);
      return undefined;
    }
    return hit;
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

    const lookups = titles
      .filter((title) => this.cachedPoster(title) === undefined)
      .map((title) => this.lookupPoster(title));
    if (lookups.length > 0) {
      let timer: NodeJS.Timeout | undefined;
      await Promise.race([
        Promise.all(lookups),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, POSTER_WAIT_MS);
        }),
      ]);
      clearTimeout(timer);
    }

    for (const item of items) {
      if (item.image) continue;
      item.image = this.cachedPoster(this.extractMediaTitle(item.title)) || "";
    }
  }

  private cachedPoster(title: string): string | undefined {
    const hit = this.posterCache.get(title);
    if (!hit) return undefined;
    if (Date.now() - hit.at > (hit.poster ? POSTER_HIT_TTL : POSTER_MISS_TTL)) {
      this.posterCache.delete(title);
      return undefined;
    }
    return hit.poster;
  }

  /** 同一标题同时只查一次：先 TMDB，查不到再豆瓣，结果（包括没查到）写进缓存。 */
  private lookupPoster(title: string): Promise<string> {
    const pending = this.pendingPosters.get(title);
    if (pending) return pending;
    const task = (async () => {
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
      this.posterCache.delete(title);
      this.posterCache.set(title, { poster, at: Date.now() });
      const oldest = this.posterCache.keys().next().value;
      if (this.posterCache.size > POSTER_CACHE_LIMIT && oldest !== undefined) {
        this.posterCache.delete(oldest);
      }
      return poster;
    })().finally(() => this.pendingPosters.delete(title));
    this.pendingPosters.set(title, task);
    return task;
  }

  /** 把资源名洗成影视片名用来查海报：去掉分类前缀和括号，从第一个发布信息起截掉，有中文名时只取中文名。 */
  private extractMediaTitle(title: string): string {
    const raw = title.replace(/^名称\s*[:：]\s*/, "").trim();
    // extractTitle 给没有说明的链接编的名字，拿去查只会配错图
    if (/^网盘分享(?:\s|$)/.test(raw)) return "";
    const words = raw
      .replace(/^[^\p{L}\p{N}]+/u, "")
      .replace(TITLE_SEPARATOR, " ")
      .split(/\s+/)
      .filter(Boolean);
    while (words.length > 1 && LEADING_TAG.test(words[0])) words.shift();
    const text = words.join(" ");
    // 开头就是年份的算片名（如《1917》），从后面的发布信息起截
    const cut = [...text.matchAll(RELEASE_INFO)].find((match) => (match.index ?? 0) > 0)?.index;
    const name = text.slice(0, cut).replace(/^[\s\-·.]+|[\s\-·.]+$/g, "");
    const chinese = name
      .split(" ")
      .find((word) => /\p{Script=Han}/u.test(word) && [...word].length >= 2);
    return (chinese || name).slice(0, 40);
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
