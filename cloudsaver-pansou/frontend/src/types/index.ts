export interface ResourceItem {
  id: string;
  title: string;
  channel: string;
  channelId?: string;
  image?: string;
  cloudLinks: string[];
  /** 磁力链接列表 */
  magnet?: string[];
  /** 电驴链接列表 */
  ed2k?: string[];
  tags?: string[];
  content?: string;
  pubDate: string;
  cloudType: string;
  messageId?: string;
  isLastMessage?: boolean;
  isSupportSave?: boolean;
  /** 是否支持复制磁力 / 115 离线下载 */
  isSupportMagnet?: boolean;
  /** 链接探活状态 */
  linkStatus?: "ok" | "bad" | "locked" | "unsupported" | "uncertain";
  linkStatusMessage?: string;
}

export interface Resource {
  list: ResourceItem[];
  displayList?: boolean;
  loading?: boolean;
  channelInfo: {
    channelId: string;
    name: string;
    channelLogo: string;
  };
  id: string;
}

export interface ShareInfo {
  fileId: string;
  fileName: string;
  fileSize?: number;
  fileIdToken?: string;
  isChecked?: boolean;
}

export interface ShareInfoItem {
  fileId: string;
  fileName: string;
  fileSize?: number;
  fileIdToken?: string;
}

export interface ShareInfoResponse {
  list: ShareInfoItem[];
  fileSize?: number;
  pwdId?: string;
  stoken?: string;
}

export interface ShareFileInfoAndFolder {
  shareInfo: ShareInfoResponse;
  folderId: string;
  shareCode: string;
  receiveCode?: string;
  newName?: string;
}

export interface Folder {
  cid: string;
  name: string;
  path?: Folder[];
}

export interface SaveFileParams {
  shareCode: string; // 分享code
  receiveCode?: string; // 分享文件的密码
  folderId: string; // 文件夹id
  fids: string[]; // 存储文件id
  fidTokens?: string[]; // 存储文件token
  newName?: string; // 转存后重命名
}

export interface GetShareInfoParams {
  shareCode: string;
  receiveCode?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Save115FileParams {
  shareCode: string;
  receiveCode: string;
  fileId: string;
  folderId: string;
}

export interface SaveQuarkFileParams {
  fid_list: string[];
  fid_token_list: string[];
  to_pdir_fid: string;
  pwd_id: string;
  stoken: string;
  pdir_fid: string;
  scene: string;
}

export interface TagColor {
  baiduPan: string;
  weiyun: string;
  aliyun: string;
  pan115: string;
  quark: string;
  magnet?: string;
  ed2k?: string;
}

export interface GlobalSettingAttributes {
  httpProxyHost: string;
  httpProxyPort: number | string;
  isProxyEnabled: boolean;
  AdminUserCode: number;
  CommonUserCode: number;
  tmdbApiKey?: string;
  oneStrmBaseUrl?: string;
  oneStrmWebhookToken?: string;
  oneStrmScanPath?: string;
  oneStrmAutoTrigger?: boolean;
}
export interface UserSettingAttributes {
  cloud115Cookie: string;
  quarkCookie: string;
}
