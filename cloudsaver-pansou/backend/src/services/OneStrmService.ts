import axios, { AxiosInstance } from "axios";
import { injectable } from "inversify";
import GlobalSetting from "../models/GlobalSetting";
import { logger } from "../utils/logger";

export interface OneStrmTriggerResult {
  triggered: boolean;
  message: string;
}

@injectable()
export class OneStrmService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({ timeout: 15000 });
  }

  async triggerConfiguredScan(): Promise<OneStrmTriggerResult> {
    const settings = await GlobalSetting.findOne();
    const baseUrl = settings?.dataValues?.oneStrmBaseUrl?.trim().replace(/\/$/, "");
    const token = settings?.dataValues?.oneStrmWebhookToken?.trim();
    const path = settings?.dataValues?.oneStrmScanPath?.trim() || "/emby";
    const enabled = settings?.dataValues?.oneStrmAutoTrigger;

    if (!enabled) {
      return { triggered: false, message: "OneStrm 自动触发未启用" };
    }
    if (!baseUrl || !token) {
      return { triggered: false, message: "OneStrm 地址或 Webhook Token 未配置" };
    }

    try {
      await this.api.post(`${baseUrl}/webhook/quick_scan`, { path }, { params: { token } });
      return { triggered: true, message: `已通知 OneStrm 扫描 ${path}` };
    } catch (error) {
      logger.warn("通知 OneStrm 扫描失败:", error);
      return { triggered: false, message: "OneStrm 通知失败，请检查地址、Token 和网络" };
    }
  }
}
