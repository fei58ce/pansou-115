import request from "@/utils/request";

export type QrcodeStatus = "pending" | "scanned" | "confirmed" | "expired" | "canceled" | "error";

export interface QrcodeInitResult {
  uid: string;
  qrcodeUrl: string;
  qrcodeImage: string;
}

export interface QrcodeCheckResult {
  status: QrcodeStatus;
  message?: string;
  cookie?: string;
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

function assertOk<T>(res: { code: number; data?: T; message?: string }, fallback: string): T {
  if (res.code !== 0 || res.data === undefined || res.data === null) {
    throw new Error(res.message || fallback);
  }
  return res.data;
}

export const cloud115QrcodeApi = {
  /**
   * 初始化二维码登录，返回 uid 与 base64 二维码
   */
  async init() {
    const res = await request.post<QrcodeInitResult>("/api/cloud115/qrcode/init", {});
    return assertOk(res, "初始化二维码失败");
  },

  /**
   * 轮询扫码状态
   */
  async check(uid: string) {
    const res = await request.get<QrcodeCheckResult>("/api/cloud115/qrcode/check", {
      params: { uid },
    });
    return assertOk(res, "查询扫码状态失败");
  },

  /**
   * 添加 115 离线下载任务
   * @param url 磁力链或 HTTP/HTTPS 链接
   * @param cid 目标目录 cid（默认 0）
   */
  async addLixianTask(url: string, cid = "0") {
    const res = await request.post<{ taskId: string; message: string }>(
      "/api/cloud115/lixian/add",
      { url, cid }
    );
    return assertOk(res, "提交 115 离线下载失败");
  },

  /**
   * 获取 115 离线任务列表
   */
  async getLixianTasks() {
    const res = await request.get<LixianTask[]>("/api/cloud115/lixian/tasks");
    return assertOk(res, "获取离线任务失败");
  },

  async getLixianHistory() {
    const res = await request.get("/api/cloud115/lixian/history");
    return assertOk(res, "获取离线历史失败");
  },

  async retryLixianTask(recordId: string) {
    const res = await request.post("/api/cloud115/lixian/retry", { recordId });
    return assertOk(res, "重试离线任务失败");
  },
};
