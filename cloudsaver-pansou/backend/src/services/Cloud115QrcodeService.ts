import axios, { AxiosInstance } from "axios";
import QRCode from "qrcode";
import { logger } from "../utils/logger";
import { injectable } from "inversify";
import UserSetting from "../models/UserSetting";

/**
 * 115 扫码登录流程（参考 ChenyangGao gist / OpenList）：
 * 1. GET  https://qrcodeapi.115.com/api/1.0/web/1.0/token/  获取 uid/time/sign/qrcode
 * 2. GET  https://qrcodeapi.115.com/get/status/?uid=&time=&sign=  轮询状态
 * 3. status=0 等待 / 1 已扫码 / 2 已确认 / -1 过期 / -2 取消
 * 4. POST https://passportapi.115.com/app/1.0/web/1.0/login/qrcode/  换取 cookie
 */

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

interface TokenResponse {
  state: number;
  code?: number;
  message?: string;
  data: {
    uid: string;
    time: number;
    sign: string;
    qrcode: string;
  };
}

interface StatusResponse {
  state: number;
  code?: number;
  message?: string;
  data: {
    status: number;
    msg?: string;
  };
}

interface LoginResponse {
  state: number;
  code?: number;
  message?: string;
  data?: {
    cookie?: Record<string, string> | string;
    user_id?: number;
  };
}

interface SessionCache {
  time: number;
  sign: string;
  createdAt: number;
}

@injectable()
export class Cloud115QrcodeService {
  private qrApi: AxiosInstance;
  private passportApi: AxiosInstance;
  /** uid -> time/sign，轮询时使用 */
  private sessions = new Map<string, SessionCache>();

  constructor() {
    this.qrApi = axios.create({
      baseURL: "https://qrcodeapi.115.com",
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
    });
    this.passportApi = axios.create({
      baseURL: "https://passportapi.115.com",
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json, text/plain, */*",
      },
    });
  }

  /** 清理超过 10 分钟的会话 */
  private cleanupSessions() {
    const now = Date.now();
    for (const [uid, s] of this.sessions) {
      if (now - s.createdAt > 10 * 60 * 1000) {
        this.sessions.delete(uid);
      }
    }
  }

  /**
   * 初始化二维码登录
   */
  async init(): Promise<QrcodeInitResult> {
    this.cleanupSessions();
    const resp = await this.qrApi.get<TokenResponse>("/api/1.0/web/1.0/token/");
    if (resp.data?.state !== 1 || !resp.data?.data?.uid) {
      throw new Error(resp.data?.message || "获取 115 二维码失败");
    }
    const { uid, time, sign, qrcode } = resp.data.data;
    this.sessions.set(uid, { time, sign, createdAt: Date.now() });

    const qrcodeImage = await QRCode.toDataURL(qrcode, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
      color: { dark: "#000000", light: "#ffffff" },
    });

    return { uid, qrcodeUrl: qrcode, qrcodeImage };
  }

  /**
   * 检查扫码状态
   */
  async check(uid: string): Promise<QrcodeCheckResult> {
    try {
      const session = this.sessions.get(uid);
      if (!session) {
        return { status: "expired", message: "会话已失效，请重新获取二维码" };
      }

      const resp = await this.qrApi.get<StatusResponse>("/get/status/", {
        params: { uid, time: session.time, sign: session.sign },
      });

      // state=0 且 message 含 key invalid 等视为错误；正常轮询 state 可能为 0/1
      const statusCode = resp.data?.data?.status;
      if (typeof statusCode !== "number") {
        return {
          status: "error",
          message: resp.data?.message || "115 状态查询失败",
        };
      }

      switch (statusCode) {
        case 0:
          return { status: "pending" };
        case 1:
          return { status: "scanned", message: "已扫码，请在手机上点击确认" };
        case 2: {
          const cookie = await this.exchangeCookie(uid);
          this.sessions.delete(uid);
          return {
            status: "confirmed",
            message: "登录成功",
            cookie,
          };
        }
        case -1:
          this.sessions.delete(uid);
          return { status: "expired", message: "二维码已过期，请重新获取" };
        case -2:
          this.sessions.delete(uid);
          return { status: "canceled", message: "已取消扫码" };
        default:
          return { status: "error", message: `未知状态码 ${statusCode}` };
      }
    } catch (error) {
      logger.error("查询 115 二维码状态失败:", error);
      return { status: "error", message: "查询扫码状态失败" };
    }
  }

  /**
   * 扫码确认后换取 cookie
   */
  private async exchangeCookie(uid: string): Promise<string> {
    const body = new URLSearchParams({ app: "web", account: uid });
    const resp = await this.passportApi.post<LoginResponse>(
      "/app/1.0/web/1.0/login/qrcode/",
      body.toString()
    );
    if (resp.data?.state !== 1 || !resp.data?.data?.cookie) {
      throw new Error(resp.data?.message || "换取 115 登录 cookie 失败");
    }
    const cookie = resp.data.data.cookie;
    if (typeof cookie === "string") {
      return cookie;
    }
    // cookie 为对象时转为标准 Cookie 字符串
    return Object.entries(cookie)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  /**
   * 将扫码登录得到的 cookie 写入当前用户的 UserSetting
   */
  async saveCookieForUser(userId: string, cookie: string): Promise<void> {
    const [setting] = await UserSetting.findOrCreate({
      where: { userId },
      defaults: { userId, cloud115Cookie: "", quarkCookie: "" },
    });
    setting.cloud115Cookie = cookie;
    await setting.save();
  }
}
