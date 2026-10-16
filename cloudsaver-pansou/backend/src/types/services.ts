import { ShareInfoResponse, FolderListResponse, SaveFileParams } from "./cloud";

/**
 * 云盘存储服务接口
 *
 * 注意：为了避免单例服务在多用户环境下因共享 cookie 导致的状态污染问题，
 * 所有方法都需要在调用时显式传入 cookie，而不是依赖实例变量。
 */
export interface ICloudStorageService {
  /**
   * 获取分享信息
   * @param shareCode 分享码
   * @param cookie 用户网盘 cookie
   * @param receiveCode 提取码
   */
  getShareInfo(shareCode: string, cookie: string, receiveCode?: string): Promise<ShareInfoResponse>;

  /**
   * 获取网盘目录列表
   * @param cookie 用户网盘 cookie
   * @param parentCid 父目录 ID
   */
  getFolderList(cookie: string, parentCid?: string): Promise<FolderListResponse>;

  /**
   * 转存分享文件
   * @param params 转存参数
   * @param cookie 用户网盘 cookie
   */
  saveSharedFile(
    params: SaveFileParams,
    cookie: string
  ): Promise<{ message: string; data: unknown }>;
}
