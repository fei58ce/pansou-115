export interface DoubanCategory {
  label: string;
  type: "movie" | "tv";
  tag: string;
  query: Record<string, string>;
}

// 和 PC 侧边栏菜单、后端启动预热的榜单一致
export const DOUBAN_CATEGORIES: DoubanCategory[] = [
  { label: "热门电影", type: "movie", tag: "热门", query: { type: "movie" } },
  { label: "热门电视剧", type: "tv", tag: "热门", query: { type: "tv" } },
  { label: "最新电影", type: "movie", tag: "最新", query: { type: "movie", tag: "最新" } },
  { label: "热门综艺", type: "tv", tag: "综艺", query: { type: "tv", tag: "综艺" } },
];

export const findDoubanCategory = (type?: string, tag?: string): DoubanCategory =>
  DOUBAN_CATEGORIES.find(
    (item) => item.type === (type || "movie") && item.tag === (tag || "热门")
  ) || DOUBAN_CATEGORIES[0];
