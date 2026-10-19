import axios, { AxiosInstance } from "axios";
import { injectable } from "inversify";
import GlobalSetting from "../models/GlobalSetting";
import { logger } from "../utils/logger";

export interface OneStrmTriggerResult {
  triggered: boolean;
  message: string;
}

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

const ANSI_ESCAPE = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");

interface OneStrmConfig {
  baseUrl: string;
  token: string;
  username: string;
  password: string;
  path: string;
  enabled: boolean;
}

@injectable()
export class OneStrmService {
  private api: AxiosInstance;
  private sessionCookie = "";
  private sessionExpiresAt = 0;

  constructor() {
    this.api = axios.create({ timeout: 20000, maxRedirects: 0 });
  }

  private async getConfig(): Promise<OneStrmConfig> {
    const settings = await GlobalSetting.findOne();
    return {
      baseUrl: settings?.dataValues?.oneStrmBaseUrl?.trim().replace(/\/$/, "") || "",
      token: settings?.dataValues?.oneStrmWebhookToken?.trim() || "",
      username: settings?.dataValues?.oneStrmUsername?.trim() || "",
      password: settings?.dataValues?.oneStrmPassword || "",
      path: settings?.dataValues?.oneStrmScanPath?.trim() || "/emby",
      enabled: Boolean(settings?.dataValues?.oneStrmAutoTrigger),
    };
  }

  async triggerConfiguredScan(): Promise<OneStrmTriggerResult> {
    const config = await this.getConfig();
    if (!config.enabled) {
      return { triggered: false, message: "OneStrm 自动触发未启用" };
    }
    if (!config.baseUrl || !config.token) {
      return { triggered: false, message: "OneStrm 地址或 Webhook Token 未配置" };
    }

    try {
      await this.api.post(
        config.baseUrl + "/webhook/quick_scan",
        { paths: [config.path] },
        { params: { token: config.token } }
      );
      return { triggered: true, message: "已通知 OneStrm 扫描 " + config.path };
    } catch (error) {
      logger.warn("通知 OneStrm 扫描失败:", error);
      return { triggered: false, message: "OneStrm 通知失败，请检查地址、Token 和网络" };
    }
  }

  /** 登录 OneStrm 管理后台，返回 session Cookie。 */
  private async login(): Promise<string> {
    if (this.sessionCookie && Date.now() < this.sessionExpiresAt) {
      return this.sessionCookie;
    }

    const config = await this.getConfig();
    if (!config.baseUrl || !config.username || !config.password) {
      throw new Error("OneStrm 管理账号未配置");
    }

    const body = new URLSearchParams({
      username: config.username,
      password: config.password,
      login: "登录",
    });
    const resp = await this.api.post(config.baseUrl + "/login", body.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: config.baseUrl + "/login",
        Origin: config.baseUrl,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const setCookie = resp.headers["set-cookie"];
    const raw = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie || "");
    const match = raw.match(/session=([^;]+)/);
    if (!match) {
      throw new Error("OneStrm 登录失败，请检查管理账号和密码");
    }

    this.sessionCookie = "session=" + match[1];
    this.sessionExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
    return this.sessionCookie;
  }

  /** 读取 OneStrm 的 STRM 日志。 */
  private async fetchStrmLog(retry = true): Promise<string> {
    const config = await this.getConfig();
    if (!config.baseUrl) {
      throw new Error("OneStrm 地址未配置");
    }

    const cookie = await this.login();
    const resp = await this.api.get(config.baseUrl + "/get_log_updates", {
      params: {
        log_type: "strm",
        cursor: 0,
        file_id: "",
        initial: 1,
      },
      headers: {
        Cookie: cookie,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
      validateStatus: (status) => status >= 200 && status < 400,
    });

    if (resp.status === 302) {
      if (retry) {
        this.sessionCookie = "";
        this.sessionExpiresAt = 0;
        return this.fetchStrmLog(false);
      }
      throw new Error("OneStrm 登录已失效，请检查管理账号和密码");
    }

    const data = resp.data;
    if (typeof data !== "object" || data === null || typeof data.log !== "string") {
      if (retry) {
        this.sessionCookie = "";
        this.sessionExpiresAt = 0;
        return this.fetchStrmLog(false);
      }
      throw new Error("OneStrm 日志接口返回异常");
    }
    return data.log;
  }

  /** 获取 OneStrm 最近 STRM 生成状态。 */
  async getStrmStatus(): Promise<OneStrmStrmStatus> {
    const config = await this.getConfig();
    if (!config.baseUrl || !config.username) {
      return {
        configured: false,
        connected: false,
        message: "请先在设置中填写 OneStrm 地址、管理账号和密码",
        recentFiles: [],
      };
    }

    try {
      const log = await this.fetchStrmLog();
      return {
        configured: true,
        connected: true,
        message: "OneStrm 已连接",
        lastScanAt: this.findLastMessage(
          log,
          /最终执行路径:|开始处理路径:|Webhook快捷扫描延时结束/
        ),
        lastTaskResult: this.findLastMessage(log, /完成生成Strm 文件：|strm: 总数：|【任务完成】/),
        recentFiles: this.parseStrmFiles(log).slice(-30).reverse(),
      };
    } catch (error) {
      logger.warn("读取 OneStrm STRM 状态失败:", error);
      return {
        configured: true,
        connected: false,
        message: error instanceof Error ? error.message : "读取 OneStrm STRM 状态失败",
        recentFiles: [],
      };
    }
  }

  private cleanLine(line: string): string {
    return line
      .replace(ANSI_ESCAPE, "")
      .replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d+ - OneStrm - /, "")
      .trim();
  }

  private findLastMessage(log: string, pattern: RegExp): string | undefined {
    const lines = log.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const message = this.cleanLine(lines[i]);
      if (pattern.test(message)) return message;
    }
    return undefined;
  }

  private parseStrmFiles(log: string): OneStrmStrmFile[] {
    const map = new Map<string, OneStrmStrmFile>();
    for (const line of log.split("\n")) {
      const clean = this.cleanLine(line);
      const pathMatch = clean.match(/创建Strm 文件成功:\s*'(.+)'/);
      if (!pathMatch) continue;
      const path = pathMatch[1];
      const fileName = path.split("/").pop() || path;
      const dateMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
      map.set(path, {
        path,
        fileName,
        createdAt: dateMatch ? dateMatch[1] : "",
      });
    }
    return Array.from(map.values());
  }
}
