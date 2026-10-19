import { AxiosHeaders, AxiosInstance } from "axios";
import { createAxiosInstance } from "../utils/axiosInstance";
import { ShareInfoResponse, FolderListResponse, SaveFileParams } from "../types/cloud";
import { injectable } from "inversify";
import { ICloudStorageService } from "@/types/services";
import { logger } from "../utils/logger";

interface Cloud115ListItem {
  cid: string;
  n: string;
  s: number;
}

interface Cloud115FolderItem {
  cid: string;
  n: string;
  ns: number;
}

@injectable()
export class Cloud115Service implements ICloudStorageService {
  private api: AxiosInstance;

  constructor() {
    this.api = createAxiosInstance(
      "https://webapi.115.com",
      AxiosHeaders.from({
        Host: "webapi.115.com",
        Connection: "keep-alive",
        xweb_xhr: "1",
        Origin: "",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 MicroMessenger/6.8.0(0x16080000) NetType/WIFI MiniProgramEnv/Mac MacWechat/WMPF MacWechat/3.8.9(0x13080910) XWEB/1227",
        Accept: "*/*",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        Referer: "https://servicewechat.com/wx2c744c010a61b0fa/94/page-frame.html",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "zh-CN,zh;q=0.9",
      })
    );
  }

  /**
   * 在请求级别注入 cookie，避免单例服务在多用户环境下的状态污染
   */
  private withCookie(cookie: string) {
    return {
      headers: { cookie },
    };
  }

  /** 通过读取根目录验证 Cookie 是否仍然有效 */
  async validateCookie(cookie: string): Promise<{ valid: boolean; message: string }> {
    try {
      await this.getFolderList(cookie, "0");
      return { valid: true, message: "115 授权有效" };
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : "115 授权已失效",
      };
    }
  }

  /** 按名称查找目录下的文件/文件夹（用于转存后改名） */
  async findItemByName(
    cookie: string,
    parentCid: string,
    name: string
  ): Promise<{ id: string; isFolder: boolean; name: string } | null> {
    const response = await this.api.get("/files", {
      ...this.withCookie(cookie),
      params: {
        aid: 1,
        cid: parentCid || "0",
        o: "user_ptime",
        asc: 0,
        offset: 0,
        show_dir: 1,
        limit: 100,
        type: 0,
        format: "json",
        star: 0,
        suffix: "",
        natsort: 0,
        snap: 0,
        record_open_time: 1,
        fc_mix: 0,
      },
    });

    if (!response.data?.state) {
      throw new Error("获取 115 目录失败:" + (response.data?.error || "未知错误"));
    }

    const items = response.data.data || [];
    const item = items.find((x: { n?: string }) => x.n === name) as
      | { cid?: string; fid?: string; n?: string }
      | undefined;
    if (!item) return null;

    const id = item.cid || item.fid || "";
    if (!id) return null;
    return { id, isFolder: Boolean(item.cid), name: item.n || name };
  }

  /** 重命名 115 文件或文件夹 */
  async renameItem(cookie: string, id: string, newName: string): Promise<void> {
    const body = new URLSearchParams();
    body.append("aid", "1");
    body.append("files_new_name[" + id + "]", newName);
    const response = await this.api.post(
      "/files/batch_rename",
      body.toString(),
      this.withCookie(cookie)
    );
    if (!response.data?.state) {
      throw new Error(
        "重命名失败:" + (response.data?.error || response.data?.errMsg || "未知错误")
      );
    }
  }

  async getShareInfo(
    shareCode: string,
    cookie: string,
    receiveCode = ""
  ): Promise<ShareInfoResponse> {
    const response = await this.api.get("/share/snap", {
      ...this.withCookie(cookie),
      params: {
        share_code: shareCode,
        receive_code: receiveCode,
        offset: 0,
        limit: 20,
        cid: "",
      },
    });
    if (response.data?.state && response.data.data?.list?.length > 0) {
      return {
        data: {
          list: response.data.data.list.map((item: Cloud115ListItem) => ({
            fileId: item.cid,
            fileName: item.n,
            fileSize: item.s,
          })),
        },
      };
    } else {
      logger.error("未找到文件信息:", response.data);
      throw new Error("未找到文件信息");
    }
  }

  async getFolderList(cookie: string, parentCid = "0"): Promise<FolderListResponse> {
    const response = await this.api.get("/files", {
      ...this.withCookie(cookie),
      params: {
        aid: 1,
        cid: parentCid,
        o: "user_ptime",
        asc: 1,
        offset: 0,
        show_dir: 1,
        limit: 50,
        type: 0,
        format: "json",
        star: 0,
        suffix: "",
        natsort: 0,
        snap: 0,
        record_open_time: 1,
        fc_mix: 0,
      },
    });
    if (response.data?.state) {
      return {
        data: response.data.data
          .filter((item: Cloud115FolderItem) => item.cid && !!item.ns)
          .map((folder: Cloud115FolderItem) => ({
            cid: folder.cid,
            name: folder.n,
            path: response.data.path,
          })),
      };
    } else {
      logger.error("获取目录列表失败:", response.data.error);
      throw new Error("获取115pan目录列表失败:" + response.data.error);
    }
  }

  async saveSharedFile(
    params: SaveFileParams,
    cookie: string
  ): Promise<{ message: string; data: unknown }> {
    const param = new URLSearchParams({
      cid: params.folderId || "",
      share_code: params.shareCode || "",
      receive_code: params.receiveCode || "",
      file_id: params.fids?.[0] || "",
    });
    const response = await this.api.post(
      "/share/receive",
      param.toString(),
      this.withCookie(cookie)
    );
    logger.info("保存文件:", response.data);
    if (response.data.state) {
      const saved = (response.data.data || {}) as {
        receive_title?: string;
        [key: string]: unknown;
      };
      let rename: {
        attempted: boolean;
        success: boolean;
        message: string;
        newName?: string;
      } = { attempted: false, success: false, message: "" };

      const newName = params.newName?.trim();
      const originalName = typeof saved.receive_title === "string" ? saved.receive_title : "";
      if (newName && originalName && newName !== originalName) {
        rename.attempted = true;
        try {
          const item = await this.findItemByName(cookie, params.folderId || "0", originalName);
          if (!item) {
            throw new Error("未找到刚转存的文件/文件夹，请稍后在 115 中手动改名");
          }
          await this.renameItem(cookie, item.id, newName);
          rename = { attempted: true, success: true, message: "已重命名", newName };
        } catch (error) {
          rename.message = error instanceof Error ? error.message : "重命名失败";
          logger.warn("转存后重命名失败:", error);
        }
      }

      return {
        message: response.data.error,
        data: { ...saved, rename },
      };
    } else {
      logger.error("保存文件失败:", response.data.error);
      throw new Error("保存115pan文件失败:" + response.data.error);
    }
  }
}
