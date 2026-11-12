import { AxiosHeaders, AxiosInstance } from "axios";
import { createAxiosInstance } from "../utils/axiosInstance";
import { logger } from "../utils/logger";
import { config } from "../config";

interface DoubanSubject {
  id: string;
  title: string;
  rate: string;
  cover: string;
  url: string;
  is_new: boolean;
}

interface HotListParams {
  type: string;
  tag: string;
  page_limit: string;
  page_start: string;
}

// 服务器到豆瓣的线路会间歇卡死：榜单缓存并在失败时沿用旧数据，单次请求短超时后换连接重试。
const HOT_LIST_FRESH_MS = 30 * 60 * 1000;
const HOT_LIST_CACHE_LIMIT = 100;
const HOT_LIST_ATTEMPTS = 3;
const HOT_LIST_ATTEMPT_TIMEOUT = 8000;
const POSTER_TIMEOUT = 6000;
// 前端菜单里的榜单：启动后先取一遍，部署或重启后第一个打开豆瓣页的人不用等豆瓣
const WARMUP_LISTS = [
  { type: "movie", tag: "热门" },
  { type: "tv", tag: "热门" },
  { type: "movie", tag: "最新" },
  { type: "tv", tag: "综艺" },
];
const WARMUP_PAGE_LIMIT = "20";
const WARMUP_RETRY_MS = 10 * 60 * 1000;
const WARMUP_ROUNDS = 3;

const brief = (error: unknown) =>
  error instanceof Error
    ? `${(error as NodeJS.ErrnoException).code || ""} ${error.message}`.trim()
    : String(error);

export class DoubanService {
  private baseUrl: string;
  private api: AxiosInstance;
  private hotLists = new Map<string, { data: DoubanSubject[]; at: number }>();
  private pendingHotLists = new Map<string, Promise<DoubanSubject[]>>();

  constructor() {
    this.baseUrl = "https://movie.douban.com/j";
    this.api = createAxiosInstance(
      this.baseUrl,
      AxiosHeaders.from({
        accept: "*/*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        priority: "u=1, i",
        "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132", "Microsoft Edge";v="132"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest",
        ...(config.douban.cookie ? { cookie: config.douban.cookie } : {}),
        Referer: "https://movie.douban.com/",
        "Referrer-Policy": "unsafe-url",
      })
    );
  }

  /**
   * 按标题搜索一张豆瓣海报，用于资源搜索结果补图。
   */
  async searchPoster(query: string): Promise<string> {
    const keyword = query.trim();
    if (!keyword) return "";

    try {
      const response = await this.api.get<Array<{ img?: string; title?: string }>>(
        "/subject_suggest",
        {
          params: { q: keyword },
          timeout: POSTER_TIMEOUT,
        }
      );
      return response.data?.find((item) => item.img)?.img || "";
    } catch (error) {
      logger.warn(`豆瓣海报搜索失败（${keyword}）：${brief(error)}`);
      return "";
    }
  }
  /** 依次预取菜单榜单；没取到的过一阵再试，最多试 WARMUP_ROUNDS 轮。 */
  async warmUp(lists = WARMUP_LISTS, round = 1): Promise<void> {
    const failed: typeof WARMUP_LISTS = [];
    for (const list of lists) {
      try {
        await this.getHotList({ ...list, page_limit: WARMUP_PAGE_LIMIT, page_start: "0" });
      } catch {
        failed.push(list);
      }
    }
    if (!failed.length) {
      logger.info(`豆瓣榜单预热完成（${lists.length} 个）`);
    } else if (round < WARMUP_ROUNDS) {
      logger.warn(
        `豆瓣榜单预热有 ${failed.length} 个没取到，${WARMUP_RETRY_MS / 60000} 分钟后重试`
      );
      setTimeout(() => void this.warmUp(failed, round + 1), WARMUP_RETRY_MS).unref();
    }
  }

  async getHotList(params: HotListParams): Promise<{ data: DoubanSubject[] }> {
    const key = JSON.stringify([params.type, params.tag, params.page_limit, params.page_start]);
    const cached = this.hotLists.get(key);
    if (!cached) return { data: await this.refreshHotList(key, params) };
    if (Date.now() - cached.at > HOT_LIST_FRESH_MS) {
      this.refreshHotList(key, params).catch(() => undefined);
    }
    return { data: cached.data };
  }

  private refreshHotList(key: string, params: HotListParams): Promise<DoubanSubject[]> {
    const pending = this.pendingHotLists.get(key);
    if (pending) return pending;
    const task = this.fetchHotList(params)
      .then((data) => {
        this.hotLists.delete(key);
        this.hotLists.set(key, { data, at: Date.now() });
        const oldest = this.hotLists.keys().next().value;
        if (this.hotLists.size > HOT_LIST_CACHE_LIMIT && oldest !== undefined) {
          this.hotLists.delete(oldest);
        }
        return data;
      })
      .finally(() => this.pendingHotLists.delete(key));
    this.pendingHotLists.set(key, task);
    return task;
  }

  private async fetchHotList(params: HotListParams): Promise<DoubanSubject[]> {
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await this.api.get("/search_subjects", {
          params,
          timeout: HOT_LIST_ATTEMPT_TIMEOUT,
        });
        return response.data?.subjects || [];
      } catch (error) {
        logger.warn(
          `豆瓣榜单第${attempt}次请求失败（${params.type}/${params.tag}）：${brief(error)}`
        );
        if (attempt >= HOT_LIST_ATTEMPTS) throw new Error("豆瓣暂时连不上，请稍后重试");
      }
    }
  }
}
