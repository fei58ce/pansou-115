import request from "@/utils/request";

export type QrcodeStatus = "pending" | "scanned" | "confirmed" | "expired" | "canceled" | "error";

export type Cloud115AppType =
  | "115ios"
  | "115android"
  | "115ipad"
  | "ios"
  | "android"
  | "wechatmini"
  | "alipaymini";

export interface Cloud115AppOption {
  value: Cloud115AppType;
  label: string;
  description: string;
}

export const CLOUD115_APP_OPTIONS: Cloud115AppOption[] = [
  { value: "115ios", label: "115_苹果端", description: "推荐，长期授权（D3）" },
  { value: "115android", label: "115_安卓端", description: "长期授权（F3）" },
  { value: "115ipad", label: "115_苹果平板端", description: "长期授权（H3）" },
  { value: "ios", label: "115生活_苹果端", description: "115生活 App（D1）" },
  { value: "android", label: "115生活_安卓端", description: "115生活 App（F1）" },
  { value: "wechatmini", label: "115生活_微信小程序端", description: "微信小程序（R1）" },
  { value: "alipaymini", label: "115生活_支付宝小程序", description: "支付宝小程序（R2）" },
];

export interface QrcodeInitResult {
  uid: string;
  qrcodeUrl: string;
  qrcodeImage: string;
  appType: Cloud115AppType;
  appLabel: string;
}

export interface QrcodeCheckResult {
  status: QrcodeStatus;
  message?: string;
  userName?: string;
  appType?: Cloud115AppType;
}

export interface Cloud115AuthStatus {
  valid: boolean;
  message: string;
  appType?: string;
  userName?: string;
  validatedAt?: string | null;
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

export interface LixianHistoryRecord {
  id: string;
  url: string;
  cid: string;
  taskId: string;
  name: string;
  status: number;
  statusText: string;
  percent: number;
  lastError: string;
  createdAt?: string;
  updatedAt?: string;
}

function assertOk<T>(res: { code: number; data?: T; message?: string }, fallback: string): T {
  if (res.code !== 0 || res.data === undefined || res.data === null) {
    throw new Error(res.message || fallback);
  }
  return res.data;
}

export const cloud115QrcodeApi = {
  /** 初始化二维码登录，返回 uid 与 base64 二维码 */
  async init(appType: Cloud115AppType = "115ios") {
    const res = await request.post<QrcodeInitResult>("/api/cloud115/qrcode/init", { appType });
    return assertOk(res, "初始化二维码失败");
  },

  /** 轮询扫码状态 */
  async check(uid: string) {
    const res = await request.get<QrcodeCheckResult>("/api/cloud115/qrcode/check", {
      params: { uid },
    });
    return assertOk(res, "查询扫码状态失败");
  },

  /** 添加 115 离线下载任务 */
  async addLixianTask(url: string, cid = "0") {
    const res = await request.post<{ taskId: string; message: string }>(
      "/api/cloud115/lixian/add",
      { url, cid }
    );
    return assertOk(res, "提交 115 离线下载失败");
  },

  /** 获取 115 离线任务列表 */
  async getLixianTasks() {
    const res = await request.get<LixianTask[]>("/api/cloud115/lixian/tasks");
    return assertOk(res, "获取离线任务失败");
  },

  async getLixianHistory() {
    const res = await request.get<LixianHistoryRecord[]>("/api/cloud115/lixian/history");
    return assertOk(res, "获取离线历史失败");
  },

  async retryLixianTask(recordId: string) {
    const res = await request.post("/api/cloud115/lixian/retry", { recordId });
    return assertOk(res, "重试离线任务失败");
  },

  async checkAuth() {
    const res = await request.get<Cloud115AuthStatus>("/api/cloud115/auth/status");
    return assertOk(res, "检测 115 授权失败");
  },
};
