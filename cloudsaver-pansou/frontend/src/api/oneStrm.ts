import request from "@/utils/request";

export interface OneStrmStrmFile {
  path: string;
  fileName: string;
  createdAt: string;
}

export interface OneStrmStrmStatus {
  configured: boolean;
  connected: boolean;
  message: string;
  lastScanAt?: string;
  lastTaskResult?: string;
  recentFiles: OneStrmStrmFile[];
}

function assertOk<T>(res: { code: number; data?: T; message?: string }, fallback: string): T {
  if (res.code !== 0 || res.data === undefined || res.data === null) {
    throw new Error(res.message || fallback);
  }
  return res.data;
}

export const oneStrmApi = {
  async getStatus() {
    const res = await request.get<OneStrmStrmStatus>("/api/onestrm/status");
    return assertOk(res, "获取 OneStrm STRM 状态失败");
  },
};
