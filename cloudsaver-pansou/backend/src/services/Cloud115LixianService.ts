import { AxiosInstance, AxiosHeaders } from "axios";
import { logger } from "../utils/logger";
import { injectable } from "inversify";
import { createAxiosInstance } from "../utils/axiosInstance";

/**
 * 115 离线下载接口
 * - 支持磁力链 (magnet:)、HTTP/HTTPS 直链、电驴等
 * - 需要登录后的 cookie（含 UID/CID/SEID）
 *
 * 流程参考：
 * 1. GET  https://115.com/?ct=offline&ac=space  获取 sign / time
 * 2. 从 cookie 解析 UID
 * 3. POST https://115.com/web/lixian/?ct=lixian&ac=add_task_url
 *    body: url, uid, sign, time, wp_path_id
 */

export interface AddLixianTaskParams {
  /** 任务 URL，可以是磁力链或 HTTP 链接 */
  url: string;
  /** 目标保存目录的 cid，"0" 表示根目录 / 默认离线目录 */
  cid?: string;
}

export interface LixianTask {
  hash: string;
  name: string;
  size: number;
  status: number;
  statusText: string;
  percent: number;
  addTime?: string;
  taskId?: string;
}

interface SpaceResponse {
  state: boolean;
  sign?: string;
  time?: number;
  data?: {
    sign?: string;
    time?: number;
  };
  error_msg?: string;
}

interface AddTaskResponse {
  state: boolean;
  errno?: number;
  errcode?: number;
  error_msg?: string;
  error?: string;
  info_hash?: string;
  name?: string;
  url?: string;
}

interface TaskListResponse {
  state: boolean;
  error_msg?: string;
  tasks?: Array<{
    info_hash: string;
    name: string;
    size: number;
    status: number;
    percentDone: number;
    add_time: number;
  }>;
  page_count?: number;
}

const STATUS_MAP: Record<number, string> = {
  0: "任务已添加",
  1: "下载中",
  2: "已完成",
  3: "失败",
  4: "等待中",
  5: "重试中",
};

@injectable()
export class Cloud115LixianService {
  private api: AxiosInstance;

  constructor() {
    this.api = createAxiosInstance(
      "https://115.com",
      AxiosHeaders.from({
        accept: "application/json, text/javascript, */*; q=0.01",
        "accept-language": "zh-CN,zh;q=0.9",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        origin: "https://115.com",
        referer: "https://115.com/?cid=0&offset=0&mode=wangpan",
        "x-requested-with": "XMLHttpRequest",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      })
    );
  }

  private withCookie(cookie: string) {
    return { headers: { cookie } };
  }

  /** 从 cookie 字符串解析 UID */
  private parseUid(cookie: string): string {
    const match = cookie.match(/(?:^|;\s*)UID=([^;]+)/i);
    if (!match?.[1]) {
      throw new Error("Cookie 中缺少 UID，请重新扫码登录 115");
    }
    // UID 格式通常为 "12345678_xxx_xxx"，取下划线前的数字部分
    const raw = decodeURIComponent(match[1]);
    return raw.split("_")[0];
  }

  /** 获取离线任务所需的 sign / time */
  private async getSignAndTime(cookie: string): Promise<{ sign: string; time: number }> {
    const resp = await this.api.get<SpaceResponse>("/", {
      ...this.withCookie(cookie),
      params: {
        ct: "offline",
        ac: "space",
        _: Date.now(),
      },
    });
    const sign = resp.data?.sign || resp.data?.data?.sign;
    const time = resp.data?.time || resp.data?.data?.time;
    if (!sign || !time) {
      throw new Error(resp.data?.error_msg || "获取 115 离线签名失败，请检查 cookie 是否有效");
    }
    return { sign, time };
  }

  /**
   * 添加离线下载任务
   */
  async addTask(
    cookie: string,
    params: AddLixianTaskParams
  ): Promise<{ taskId: string; message: string }> {
    if (!params.url?.trim()) {
      throw new Error("缺少下载链接");
    }

    try {
      const uid = this.parseUid(cookie);
      const { sign, time } = await this.getSignAndTime(cookie);

      const body = new URLSearchParams();
      body.append("url", params.url.trim());
      body.append("uid", uid);
      body.append("sign", sign);
      body.append("time", String(time));
      if (params.cid) {
        body.append("wp_path_id", params.cid);
      }

      const resp = await this.api.post<AddTaskResponse>(
        "/web/lixian/?ct=lixian&ac=add_task_url",
        body.toString(),
        this.withCookie(cookie)
      );

      if (!resp.data?.state) {
        throw new Error(resp.data?.error_msg || resp.data?.error || "添加离线任务失败");
      }

      return {
        taskId: resp.data.info_hash || "",
        message: resp.data.name ? `已添加：${resp.data.name}` : "已提交到 115 离线下载",
      };
    } catch (error) {
      logger.error("115 离线下载添加任务失败:", error);
      throw error;
    }
  }

  /**
   * 查询任务列表
   */
  async listTasks(cookie: string, page = 1): Promise<LixianTask[]> {
    try {
      const uid = this.parseUid(cookie);
      const { sign, time } = await this.getSignAndTime(cookie);

      const body = new URLSearchParams();
      body.append("page", String(page));
      body.append("uid", uid);
      body.append("sign", sign);
      body.append("time", String(time));

      const resp = await this.api.post<TaskListResponse>(
        "/web/lixian/?ct=lixian&ac=task_lists",
        body.toString(),
        this.withCookie(cookie)
      );

      if (!resp.data?.state) {
        return [];
      }

      return (resp.data.tasks || []).map((t) => ({
        hash: t.info_hash,
        name: t.name,
        size: t.size,
        status: t.status,
        statusText: STATUS_MAP[t.status] || `状态${t.status}`,
        percent: t.percentDone,
        addTime: t.add_time ? new Date(t.add_time * 1000).toLocaleString() : undefined,
        taskId: t.info_hash,
      }));
    } catch (error) {
      logger.error("115 离线任务查询失败:", error);
      return [];
    }
  }
}
