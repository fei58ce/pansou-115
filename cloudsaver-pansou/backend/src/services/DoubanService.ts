import { AxiosHeaders, AxiosInstance } from "axios";
import { createAxiosInstance } from "../utils/axiosInstance";
import { logger } from "../utils/logger";

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
        cookie:
          'll="118282"; bid=StA6AQFsAWQ; _pk_id.100001.4cf6=6448be57b1b5ca7e.1723172321.; _vwo_uuid_v2=DC15B8183560FF1E538FFE1D480723310|c08e2d213ecb5510005f90a6ff332121; __utmv=30149280.6282; _vwo_uuid_v2=DC15B8183560FF1E538FFE1D480723310|c08e2d213ecb5510005f90a6ff332121; __utmz=30149280.1731915179.21.6.utmcsr=search.douban.com|utmccn=(referral)|utmcmd=referral|utmcct=/movie/subject_search; __utmz=223695111.1731915179.21.6.utmcsr=search.douban.com|utmccn=(referral)|utmcmd=referral|utmcct=/movie/subject_search; douban-fav-remind=1; __utmc=30149280; __utmc=223695111; _pk_ref.100001.4cf6=%5B%22%22%2C%22%22%2C1739176523%2C%22https%3A%2F%2Fsearch.douban.com%2Fmovie%2Fsubject_search%3Fsearch_text%3D%E8%84%91%E6%B4%9E%E5%A4%A7%E5%BC%80%26cat%3D1002%22%5D; _pk_ses.100001.4cf6=1; ap_v=0,6.0; __utma=30149280.859303574.1723448979.1739167503.1739176523.42; __utmb=30149280.0.10.1739176523; __utma=223695111.1882744177.1723448979.1739167503.1739176523.42; __utmb=223695111.0.10.1739176523',
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
      const response = await this.api.get<Array<{ pic?: string; title?: string }>>(
        "/subject_suggest",
        {
          params: { q: keyword },
          timeout: POSTER_TIMEOUT,
        }
      );
      return response.data?.find((item) => item.pic)?.pic || "";
    } catch (error) {
      logger.warn(`豆瓣海报搜索失败（${keyword}）：${brief(error)}`);
      return "";
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
