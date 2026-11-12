import axios, { AxiosInstance } from "axios";
import { MediaFile, parse115Json, SubscriptionConfig } from "./rules";

type Row = Record<string, unknown>;
type Reply = { data: unknown };
export const RISK_CONTROL = "115触发风控或返回异常页面，本轮已停止，下次检查自动重试";
export interface TreeResult {
  files: MediaFile[];
  path: string;
}
export interface SubscriptionDrive {
  target(cookie: string, cid: string): Promise<TreeResult>;
  source(cookie: string, c: SubscriptionConfig): Promise<TreeResult>;
  receive(cookie: string, c: SubscriptionConfig, file: MediaFile): Promise<void>;
}
function row(v: unknown): Row {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("115响应格式异常");
  return v as Row;
}
function id(v: unknown): string {
  if (typeof v === "number" && !Number.isSafeInteger(v)) throw new Error("115文件ID精度异常");
  const result = String(v ?? "");
  if (!/^\d+$/.test(result)) throw new Error("115文件ID无效");
  return result;
}
export function normalizeFile(v: unknown, context: string): MediaFile {
  const item = row(v);
  const folder = !item.fid && !item.file_id;
  return {
    id: id(folder ? item.cid : item.fid || item.file_id),
    folder,
    name: String(item.n ?? item.file_name ?? ""),
    size: String(item.s ?? item.file_size ?? "0"),
    sha1: String(item.sha ?? item.sha1 ?? ""),
    context,
  };
}
// 115风控/限流时返回HTML页面而不是JSON；保留原文，由 call() 统一识别。
export function parseBody(text: unknown): unknown {
  if (typeof text !== "string") return text;
  try {
    return parse115Json(text);
  } catch {
    return text;
  }
}

export class HttpSubscriptionDrive implements SubscriptionDrive {
  private last = 0;
  constructor(
    private api: AxiosInstance = axios.create({
      baseURL: "https://webapi.115.com",
      timeout: 15000,
      maxRedirects: 0,
      maxContentLength: 8 * 1024 * 1024,
      transformResponse: [parseBody],
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    }),
    // 115对短时间连续请求返回405风控页，所有请求之间保持最小间隔。
    private minIntervalMs = 1000
  ) {}

  private async call(send: () => Promise<Reply>): Promise<Row> {
    const wait = this.last + this.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      const response = await send();
      if (typeof response.data === "string") throw new Error(RISK_CONTROL);
      return row(response.data);
    } catch (e) {
      const r = (e as { response?: { status?: number; data?: unknown } } | undefined)?.response;
      if (r && (r.status === 405 || r.status === 429 || typeof r.data === "string"))
        throw new Error(RISK_CONTROL);
      throw e;
    } finally {
      this.last = Date.now();
    }
  }

  private async tree(cookie: string, cid: string, c?: SubscriptionConfig): Promise<TreeResult> {
    const files: MediaFile[] = [];
    const queue = [{ cid, context: "", depth: 0 }];
    const visited = new Set<string>();
    let path = "";
    const deadline = Date.now() + 150000;
    let entries = 0;
    while (queue.length) {
      const folder = queue.shift();
      if (!folder) break;
      if (visited.has(folder.cid)) throw new Error("目录遍历出现重复，已停止");
      visited.add(folder.cid);
      if (visited.size > 60 || folder.depth > 4)
        throw new Error("目录层级或数量超过安全上限，请选择具体季目录");
      let offset = 0;
      const seen = new Set<string>();
      for (let page = 0; page < 40; page++) {
        if (Date.now() > deadline) throw new Error("目录读取超时，本轮未执行转存");
        const body = await this.call(() =>
          this.api.get(c ? "/share/snap" : "/files", {
            headers: { Cookie: cookie },
            params: c
              ? {
                  share_code: c.shareCode,
                  receive_code: c.receiveCode,
                  cid: folder.cid,
                  offset,
                  limit: 100,
                }
              : {
                  aid: 1,
                  cid: folder.cid,
                  offset,
                  limit: 100,
                  show_dir: 1,
                  fc_mix: 1,
                  o: "file_name",
                  asc: 1,
                  format: "json",
                },
          })
        );
        if (body.state !== true && body.state !== 1) {
          // 不返回任意远端文本，避免日志泄漏认证字段。
          const message = String(body.error || body.message || "");
          if (/登录|授权|login/i.test(message))
            throw new Error("115授权失效，请重新扫码后恢复订阅");
          if (/频繁|风控|限流|稍后|too many|frequent/i.test(message)) throw new Error(RISK_CONTROL);
          throw new Error(
            c ? "115分享不可读取，请检查提取码、链接和源目录" : "115目标目录不可读取或触发限流"
          );
        }
        const data = c ? row(body.data) : body;
        const list = c ? data.list : body.data;
        if (!Array.isArray(list)) throw new Error("115目录列表不完整，停止本轮转存");
        if (!c && offset === 0) {
          if (!Array.isArray(body.path)) throw new Error("无法核实115目标目录路径");
          const parts = body.path.map(row);
          if (String(parts[parts.length - 1]?.cid) !== folder.cid)
            throw new Error("115返回了其他目录，已禁止写入");
          if (folder.cid === cid)
            path =
              "/" +
              parts
                .filter((p) => String(p.cid) !== "0")
                .map((p) => String(p.name))
                .join("/");
        }
        for (const raw of list) {
          const file = normalizeFile(raw, folder.context || (!c ? path : ""));
          if (seen.has(file.id)) throw new Error("115分页重复，无法确认完整目录");
          seen.add(file.id);
          entries++;
          if (entries > 3000) throw new Error("文件超过3000项，请缩小订阅目录范围");
          if (file.folder)
            queue.push({
              cid: file.id,
              context: folder.context + "/" + file.name,
              depth: folder.depth + 1,
            });
          else files.push(file);
        }
        offset += list.length;
        const total = Number(data.count ?? body.count);
        if (!list.length || (Number.isFinite(total) && offset >= total)) break;
        if (page === 39) throw new Error("115分页超限，未取得完整目录");
        // 没有可靠count时必须继续请求空页，不能以不足limit推断完成。
      }
    }
    return { files, path };
  }
  target(cookie: string, cid: string): Promise<TreeResult> {
    return this.tree(cookie, cid);
  }
  source(cookie: string, c: SubscriptionConfig): Promise<TreeResult> {
    return this.tree(cookie, c.sourceCid, c);
  }
  async receive(cookie: string, c: SubscriptionConfig, file: MediaFile): Promise<void> {
    const body = await this.call(() =>
      this.api.post(
        "/share/receive",
        new URLSearchParams({
          share_code: c.shareCode,
          receive_code: c.receiveCode,
          cid: c.targetCid,
          file_id: file.id,
        }).toString(),
        { headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" } }
      )
    );
    if (body.state !== true && body.state !== 1) throw new Error("115未确认转存，请核实目标目录");
  }
}
