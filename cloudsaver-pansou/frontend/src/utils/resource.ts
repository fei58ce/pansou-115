import type { ResourceItem } from "@/types";

export type LinkStatus = NonNullable<ResourceItem["linkStatus"]>;
export type Tone = "success" | "warning" | "danger" | "info";

export const LINK_STATUS_LABEL: Record<LinkStatus, string> = {
  ok: "有效",
  locked: "需提取码",
  uncertain: "待确认",
  unsupported: "未检测",
  bad: "已失效",
};

export const LINK_STATUS_TONE: Record<LinkStatus, Tone> = {
  ok: "success",
  locked: "warning",
  uncertain: "info",
  unsupported: "info",
  bad: "danger",
};

const CLOUD_TYPE_LABEL: Record<string, string> = {
  pan115: "115",
  quark: "夸克",
  baiduPan: "百度",
  aliyun: "阿里",
  weiyun: "微云",
  magnet: "磁力",
  ed2k: "电驴",
};

export const cloudTypeLabel = (type?: string): string =>
  CLOUD_TYPE_LABEL[type || ""] || type || "链接";

const textCache = new Map<string, string>();

/** 频道消息和 PanSou 备注是外部的 HTML，只取纯文本显示，不当 HTML 插进页面 */
export function htmlToText(html?: string): string {
  if (!html) return "";
  let text = textCache.get(html);
  if (text === undefined) {
    const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, "\n"), "text/html");
    text = (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
    if (textCache.size >= 500) textCache.clear();
    textCache.set(html, text);
  }
  return text;
}

/** PanSou 的结果没有 messageId，列表 key 优先用 id */
export const resourceKey = (item: ResourceItem, index: number): string =>
  item.id || item.messageId || String(index);

/** 跳转优先用网盘链接，没有再用磁力 */
export const primaryLink = (item: ResourceItem): string =>
  item.cloudLinks?.find((link) => !/^magnet:/i.test(link)) ||
  item.cloudLinks?.[0] ||
  item.magnet?.[0] ||
  "";
