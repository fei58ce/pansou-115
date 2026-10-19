import axios, { AxiosInstance, AxiosResponse } from "axios";
import QRCode from "qrcode";
import { injectable, inject } from "inversify";
import { TYPES } from "../core/types";
import UserSetting from "../models/UserSetting";
import { logger } from "../utils/logger";
import { Cloud115Service } from "./Cloud115Service";

/**
 * 115 扫码登录
 *
 * 关键点：
 * 1. token/status 统一走 qrcodeapi.115.com 的 web 1.0 接口；
 * 2. 换取 Cookie 时必须使用目标设备端点：
 *      https://qrcodeapi.115.com/app/1.0/{app}/1.0/login/qrcode/
 * 3. web 设备（ssoent=A1）Cookie 生命周期短，容易出现“登录超时”；
 *    默认改用 115ios（115_苹果端，ssoent=D3），授权更持久。
 *
 * 参考：ChenyangGao/p115client 的 p115qrcode 实现。
 */

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

export const DEFAULT_CLOUD115_APP: Cloud115AppType = "115ios";

const APP_LABELS = Object.fromEntries(
  CLOUD115_APP_OPTIONS.map((item) => [item.value, item.label])
) as Record<Cloud115AppType, string>;

const APP_USER_AGENTS: Record<Cloud115AppType, string> = {
  "115ios":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  "115android":
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
  "115ipad":
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  ios: "UPhone/1.0.0",
  android:
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
  wechatmini:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.0",
  alipaymini:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 AlipayClient/10.5.0",
};

export function normalizeCloud115AppType(value: unknown): Cloud115AppType {
  const raw = String(value || "").trim();
  return CLOUD115_APP_OPTIONS.some((item) => item.value === raw)
    ? (raw as Cloud115AppType)
    : DEFAULT_CLOUD115_APP;
}

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
  data?: {
    status?: number | string;
    msg?: string;
  };
}

interface LoginResponse {
  state?: number | boolean;
  code?: number;
  error?: string;
  message?: string;
  data?: {
    cookie?: Record<string, string> | string;
    user_id?: number | string;
    user_name?: string;
    user_face?: string;
  };
}

interface SessionCache {
  time: number;
  sign: string;
  createdAt: number;
  appType: Cloud115AppType;
}

@injectable()
export class Cloud115QrcodeService {
  private qrApi: AxiosInstance;
  private loginApi: AxiosInstance;
  /** uid -> time/sign/appType，轮询时使用 */
  private sessions = new Map<string, SessionCache>();

  constructor(@inject(TYPES.Cloud115Service) private cloud115Service: Cloud115Service) {
    const commonHeaders = {
      Accept: "application/json, text/plain, */*",
    };
    this.qrApi = axios.create({
      baseURL: "https://qrcodeapi.115.com",
      timeout: 15000,
      headers: {
        ...commonHeaders,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    this.loginApi = axios.create({
      baseURL: "https://qrcodeapi.115.com",
      timeout: 20000,
      headers: {
        ...commonHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  }

  /** 清理超过 10 分钟的会话 */
  private cleanupSessions() {
    const now = Date.now();
    for (const [uid, session] of this.sessions) {
      if (now - session.createdAt > 10 * 60 * 1000) {
        this.sessions.delete(uid);
      }
    }
  }

  /** 初始化二维码登录 */
  async init(appTypeRaw?: unknown): Promise<QrcodeInitResult> {
    this.cleanupSessions();
    const appType = normalizeCloud115AppType(appTypeRaw);
    const resp = await this.qrApi.get<TokenResponse>("/api/1.0/web/1.0/token/");
    if (resp.data?.state !== 1 || !resp.data?.data?.uid) {
      throw new Error(resp.data?.message || "获取 115 二维码失败");
    }
    const { uid, time, sign, qrcode } = resp.data.data;
    this.sessions.set(uid, { time, sign, createdAt: Date.now(), appType });

    const qrcodeImage = await QRCode.toDataURL(qrcode, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
      color: { dark: "#000000", light: "#ffffff" },
    });

    return {
      uid,
      qrcodeUrl: qrcode,
      qrcodeImage,
      appType,
      appLabel: APP_LABELS[appType],
    };
  }

  /** 检查扫码状态 */
  async check(uid: string, userId?: string): Promise<QrcodeCheckResult> {
    try {
      const session = this.sessions.get(uid);
      if (!session) {
        return { status: "expired", message: "会话已失效，请重新获取二维码" };
      }

      let resp: AxiosResponse<StatusResponse>;
      try {
        resp = await this.qrApi.get<StatusResponse>("/get/status/", {
          params: { uid, time: session.time, sign: session.sign },
          timeout: 90_000,
        });
      } catch (error) {
        if (
          axios.isAxiosError(error) &&
          (error.code === "ECONNABORTED" || /timeout/i.test(error.message))
        ) {
          // 115 的状态接口是长轮询：未扫码时会保持连接，超时视为继续等待
          return { status: "pending", message: "等待扫码..." };
        }
        throw error;
      }

      const rawStatus = resp.data?.data?.status;
      if (rawStatus === undefined || rawStatus === null || rawStatus === "") {
        if (resp.data?.state === 1) {
          // 长轮询在等待期间会返回 {"state":1,"data":{}}
          return { status: "pending", message: "等待扫码..." };
        }
        return {
          status: "error",
          message: resp.data?.message || "115 状态查询失败",
        };
      }
      const statusCode = Number(rawStatus);
      if (!Number.isFinite(statusCode)) {
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
          this.sessions.delete(uid);
          const login = await this.exchangeCookie(uid, session.appType);
          const validation = await this.cloud115Service.validateCookie(login.cookie);
          if (!validation.valid) {
            return {
              status: "error",
              message: "扫码成功，但 115 授权校验失败：" + validation.message,
              appType: session.appType,
            };
          }
          if (userId) {
            await this.saveCookieForUser(userId, login.cookie, {
              appType: session.appType,
              userName: login.userName,
            });
          }
          return {
            status: "confirmed",
            message: "登录成功（" + APP_LABELS[session.appType] + "）",
            userName: login.userName,
            appType: session.appType,
          };
        }
        case -1:
          this.sessions.delete(uid);
          return { status: "expired", message: "二维码已过期，请重新获取" };
        case -2:
          this.sessions.delete(uid);
          return { status: "canceled", message: "已取消扫码" };
        default:
          return { status: "error", message: "未知状态码 " + statusCode };
      }
    } catch (error) {
      logger.error("查询 115 二维码状态失败:", error);
      return {
        status: "error",
        message: error instanceof Error ? error.message : "查询扫码状态失败",
      };
    }
  }

  /**
   * 扫码确认后换取 Cookie。
   * 注意：这里必须使用 app 对应的设备端点，才能在 UID 中拿到正确的 ssoent。
   */
  private async exchangeCookie(
    uid: string,
    appType: Cloud115AppType
  ): Promise<{ cookie: string; userName?: string }> {
    const body = new URLSearchParams({ account: uid });
    const resp = await this.loginApi.post<LoginResponse>(
      "/app/1.0/" + appType + "/1.0/login/qrcode/",
      body.toString(),
      {
        headers: {
          "User-Agent": APP_USER_AGENTS[appType],
        },
      }
    );

    if (!resp.data?.state) {
      throw new Error(resp.data?.message || resp.data?.error || "换取 115 登录 Cookie 失败");
    }

    const cookie = this.extractCookie(resp);
    if (!cookie) {
      throw new Error("115 登录成功，但未返回 Cookie");
    }

    const required = ["UID", "CID", "SEID", "KID"];
    const missing = required.filter((key) => !new RegExp("(?:^|;\\s*)" + key + "=").test(cookie));
    if (missing.length > 0) {
      throw new Error("115 返回的 Cookie 缺少字段：" + missing.join(", "));
    }

    return {
      cookie,
      userName: resp.data.data?.user_name,
    };
  }

  /** 合并 data.cookie 与 Set-Cookie 响应头，输出标准 Cookie 字符串 */
  private extractCookie(resp: AxiosResponse<LoginResponse>): string {
    const pairs = new Map<string, string>();

    const addPair = (raw: string) => {
      const first = raw.split(";")[0].trim();
      const index = first.indexOf("=");
      if (index <= 0) return;
      const key = first.slice(0, index).trim();
      const value = first.slice(index + 1).trim();
      if (key && value) pairs.set(key, value);
    };

    const rawCookie = resp.data?.data?.cookie;
    if (typeof rawCookie === "string") {
      rawCookie.split(";").forEach(addPair);
    } else if (rawCookie && typeof rawCookie === "object") {
      for (const [key, value] of Object.entries(rawCookie)) {
        if (value !== undefined && value !== null && String(value) !== "") {
          pairs.set(key, String(value));
        }
      }
    }

    const setCookie = resp.headers["set-cookie"];
    if (Array.isArray(setCookie)) {
      setCookie.forEach(addPair);
    } else if (typeof setCookie === "string") {
      addPair(setCookie);
    }

    return Array.from(pairs.entries())
      .map(([key, value]) => key + "=" + value)
      .join("; ");
  }

  /** 将扫码登录得到的 Cookie 写入当前用户的 UserSetting */
  async saveCookieForUser(
    userId: string,
    cookie: string,
    meta: { appType: Cloud115AppType; userName?: string }
  ): Promise<void> {
    const [setting] = await UserSetting.findOrCreate({
      where: { userId },
      defaults: { userId, cloud115Cookie: "", quarkCookie: "" },
    });
    setting.cloud115Cookie = cookie;
    setting.cloud115AppType = meta.appType;
    setting.cloud115UserName = meta.userName || setting.cloud115UserName || "";
    setting.cloud115ValidatedAt = new Date();
    await setting.save();
  }
}
