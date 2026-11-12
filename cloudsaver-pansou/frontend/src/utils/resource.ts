import type { Resource, ResourceItem } from "@/types";

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

/** 频道消息里的标签本身就带 # */
export const tagLabel = (tag: string): string => `#${tag.replace(/^#+/, "")}`;

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

export const SUMMARY_115_ID = "summary_115";
const PANSOU_115_ID = "pansou_115";
const PAN115_SHARE = /https?:\/\/(?:www\.)?(?:115|115cdn|anxia)\.com\/s\/([a-z0-9]+)/i;

/** 只有 TG 频道能翻页、有频道主页；PanSou 分组和 115 汇总都不是频道 */
export const isTelegramGroup = (id: string): boolean =>
  Boolean(id) && id !== SUMMARY_115_ID && !id.startsWith("pansou_");

// 频道消息的 cloudType 只取第一个识别到的网盘，带 115 链接的消息可能标成别的类型，所以按链接认
const find115Link = (item: ResourceItem) =>
  item.cloudLinks?.find((link) => PAN115_SHARE.test(link));

const shareCode = (item: ResourceItem) => {
  const link = item.cloudLinks?.[0] || "";
  return link.match(PAN115_SHARE)?.[1].toLowerCase() || link;
};

const uniqueByShareCode = (items: ResourceItem[], seen = new Set<string>()) =>
  items.filter((item) => {
    const code = shareCode(item);
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });

/** 汇总里放副本：115 链接排第一，标上来源；频道消息没有 id，补一个免得不同频道的 messageId 撞 key */
const toSummaryItem = (item: ResourceItem, group: Resource): ResourceItem => {
  const link = find115Link(item);
  return {
    ...item,
    id: item.id || `${group.id}-${item.messageId}`,
    cloudType: "pan115",
    cloudLinks: link
      ? [link, ...item.cloudLinks.filter((other) => other !== link)]
      : item.cloudLinks,
    isSupportSave: true,
    sourceName: group.id === PANSOU_115_ID ? "PanSou" : group.channelInfo.name,
    sourceId: group.id,
  };
};

const createSummary = (list: ResourceItem[], displayList = true): Resource => ({
  id: SUMMARY_115_ID,
  channelInfo: { channelId: SUMMARY_115_ID, name: "115 资源汇总", channelLogo: "" },
  list,
  displayList,
});

const pubTime = (item: ResourceItem) => Date.parse(item.pubDate) || 0;

/**
 * 把 115 资源汇总成一组放最前：PanSou 的结果在前（带探活状态），频道里的 115 链接按发布时间新到旧接在后面，
 * 同一分享码只留一条。PanSou·115 分组并进汇总不再单列，频道分组原样保留。对已带汇总的列表再调用结果不变。
 */
export function withSummary115(groups: Resource[]): Resource[] {
  const previous = groups.find((group) => group.id === SUMMARY_115_ID);
  const pansou = groups.find((group) => group.id === PANSOU_115_ID);
  const pansouItems = pansou
    ? pansou.list.map((item) => toSummaryItem(item, pansou))
    : (previous?.list || []).filter((item) => item.sourceId === PANSOU_115_ID);
  const channelItems = groups
    .filter((group) => isTelegramGroup(group.id))
    .flatMap((group) => group.list.filter(find115Link).map((item) => toSummaryItem(item, group)))
    .sort((a, b) => pubTime(b) - pubTime(a));
  const list = uniqueByShareCode([...pansouItems, ...channelItems]);
  const rest = groups.filter((group) => group.id !== SUMMARY_115_ID && group.id !== PANSOU_115_ID);
  return list.length ? [createSummary(list, previous?.displayList ?? true), ...rest] : rest;
}

/** 频道翻页拿到的 115 链接接到汇总末尾。原地修改：手机端监听的是数组引用，换掉会跳回第一个标签 */
export function appendToSummary115(groups: Resource[], group: Resource, items: ResourceItem[]) {
  const summary = groups.find((item) => item.id === SUMMARY_115_ID);
  const added = uniqueByShareCode(
    items.filter(find115Link).map((item) => toSummaryItem(item, group)),
    new Set(summary?.list.map(shareCode))
  );
  if (!added.length) return;
  if (summary) summary.list.push(...added);
  else groups.unshift(createSummary(added));
}

/** 汇总里频道来的条目在原频道里也有，统计时只多算 PanSou 来的 */
export function resourceStats(groups: Resource[]) {
  const summary = groups.find((group) => group.id === SUMMARY_115_ID);
  const others = groups.filter((group) => group.id !== SUMMARY_115_ID);
  const pansouCount = summary?.list.filter((item) => item.sourceId === PANSOU_115_ID).length || 0;
  return {
    sources: others.length + (pansouCount ? 1 : 0),
    total: others.reduce((sum, group) => sum + group.list.length, 0) + pansouCount,
    count115: summary?.list.length || 0,
  };
}
