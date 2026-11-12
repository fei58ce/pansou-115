import { AxiosInstance, AxiosHeaders } from "axios";
import { createAxiosInstance } from "../utils/axiosInstance";
import GlobalSetting from "../models/GlobalSetting";
import { GlobalSettingAttributes } from "../models/GlobalSetting";
import * as cheerio from "cheerio";
import { config } from "../config";
import { logger } from "../utils/logger";
import { injectable } from "inversify";

interface sourceItem {
  messageId?: string;
  title?: string;
  completeTitle?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  description?: string;
  image?: string;
  cloudLinks?: string[];
  tags?: string[];
  cloudType?: string;
  /** 磁力链接（从纯文本或 href 中提取） */
  magnet?: string[];
  /** 电驴链接 */
  ed2k?: string[];
}

interface ChannelPage {
  items: sourceItem[];
  channelLogo: string;
}

// 同一关键词短时间内重复搜（刷新、翻回、多人同搜）直接用缓存，不再挨个频道请求
const CHANNEL_PAGE_TTL = 5 * 60 * 1000;
const CHANNEL_PAGE_CACHE_LIMIT = 300;

@injectable()
export class Searcher {
  private static instance: Searcher;
  private api: AxiosInstance | null = null;
  private channelPages = new Map<string, { page: ChannelPage; at: number }>();
  private pendingChannelPages = new Map<string, Promise<ChannelPage>>();

  constructor() {
    this.initAxiosInstance();
    Searcher.instance = this;
  }

  private async initAxiosInstance(isUpdate: boolean = false) {
    let globalSetting = {} as GlobalSettingAttributes;
    if (isUpdate) {
      const settings = await GlobalSetting.findOne();
      globalSetting = settings?.dataValues || ({} as GlobalSettingAttributes);
    }
    this.api = createAxiosInstance(
      config.telegram.baseUrl,
      AxiosHeaders.from({
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        "cache-control": "max-age=0",
        priority: "u=0, i",
        "sec-ch-ua": '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
      }),
      globalSetting?.isProxyEnabled,
      globalSetting?.isProxyEnabled
        ? { host: globalSetting?.httpProxyHost, port: globalSetting?.httpProxyPort }
        : undefined
    );
  }

  public static async updateAxiosInstance(): Promise<void> {
    await Searcher.instance.initAxiosInstance(true);
  }

  /**
   * 从文本中提取所有可识别的网盘/下载链接
   * 返回 { links, cloudType, magnet, ed2k }
   * - links:    所有网盘/磁力/电驴链接
   * - cloudType: 第一个匹配到的网盘类型（向后兼容）
   * - magnet:   单独的磁力链数组
   * - ed2k:     单的电驴链接数组
   */
  private extractCloudLinks(text: string): {
    links: string[];
    cloudType: string;
    magnet: string[];
    ed2k: string[];
  } {
    const links: string[] = [];
    let cloudType = "";
    const magnet: string[] = [];
    const ed2k: string[] = [];

    Object.entries(config.cloudPatterns).forEach(([key, pattern]) => {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        // 去重
        const unique = [...new Set(matches)];
        if (key === "magnet") {
          magnet.push(...unique);
        } else if (key === "ed2k") {
          ed2k.push(...unique);
        } else {
          links.push(...unique);
          if (!cloudType) cloudType = key;
        }
      }
    });

    return {
      links: [...new Set(links)],
      cloudType,
      magnet: [...new Set(magnet)],
      ed2k: [...new Set(ed2k)],
    };
  }

  async searchAll(keyword: string, channelId?: string, messageId?: string) {
    const channelList = channelId
      ? config.telegram.channels.filter((channel) => channel.id === channelId)
      : config.telegram.channels;

    // 各频道并行请求，结果按频道配置顺序返回，不按谁先响应
    const groups = await Promise.all(
      channelList.map(async (channel) => {
        const messageIdparams = messageId ? `before=${messageId}` : "";
        const url = `/${channel.id}${keyword ? `?q=${encodeURIComponent(keyword)}&${messageIdparams}` : `?${messageIdparams}`}`;
        logger.debug(`Searching in channel ${channel.name} with URL: ${url}`);
        const results = await this.loadChannelPage(url).catch(() => null);
        if (!results?.items.length) return null;
        logger.debug(`Found ${results.items.length} items in channel ${channel.name}`);
        const channelResults = results.items
          .filter(
            (item: sourceItem) =>
              (item.cloudLinks && item.cloudLinks.length > 0) ||
              (item.magnet && item.magnet.length > 0) ||
              (item.ed2k && item.ed2k.length > 0)
          )
          .map((item: sourceItem) => ({
            ...item,
            // 仅有磁力/电驴时，给 cloudType 一个可识别的标签
            cloudType:
              item.cloudType || (item.magnet?.length ? "magnet" : item.ed2k?.length ? "ed2k" : ""),
            cloudLinks: item.cloudLinks?.length
              ? item.cloudLinks
              : item.magnet?.length
                ? item.magnet
                : item.ed2k || [],
            channel: channel.name,
            channelId: channel.id,
          }));

        return {
          list: channelResults,
          channelInfo: {
            ...channel,
            channelLogo: results.channelLogo,
          },
          id: channel.id,
        };
      })
    );

    return {
      data: groups.filter((group): group is NonNullable<typeof group> => group !== null),
    };
  }

  /** 同一频道页（频道 + 关键词 + 翻页位置）短时间内只请求一次；请求失败不缓存。 */
  private loadChannelPage(url: string): Promise<ChannelPage> {
    const hit = this.channelPages.get(url);
    if (hit && Date.now() - hit.at < CHANNEL_PAGE_TTL) return Promise.resolve(hit.page);
    const pending = this.pendingChannelPages.get(url);
    if (pending) return pending;
    const task = this.fetchChannelPage(url)
      .then((page) => {
        this.channelPages.delete(url);
        this.channelPages.set(url, { page, at: Date.now() });
        for (const key of this.channelPages.keys()) {
          if (this.channelPages.size <= CHANNEL_PAGE_CACHE_LIMIT) break;
          this.channelPages.delete(key);
        }
        return page;
      })
      .finally(() => this.pendingChannelPages.delete(url));
    this.pendingChannelPages.set(url, task);
    return task;
  }

  private async fetchChannelPage(url: string): Promise<ChannelPage> {
    try {
      if (!this.api) {
        throw new Error("Axios instance is not initialized");
      }
      const response = await this.api.get(url);
      const html = response.data;
      const $ = cheerio.load(html);
      const items: sourceItem[] = [];
      let channelLogo = "";
      $(".tgme_header_link").each((_, element) => {
        channelLogo = $(element).find("img").attr("src") || "";
      });
      // 遍历每个消息容器
      $(".tgme_widget_message_wrap").each((_, element) => {
        const messageEl = $(element);

        // 通过 data-post 属性来获取消息的链接 去除channelId 获得消息id
        const messageId = messageEl
          .find(".tgme_widget_message")
          .data("post")
          ?.toString()
          .split("/")[1];

        // 提取标题 (第一个<br>标签前的内容)
        const title =
          messageEl
            .find(".js-message_text")
            .html()
            ?.split("<br>")[0]
            .replace(/<[^>]+>/g, "")
            .replace(/\n/g, "") || "";

        // 提取描述 (第一个<a>标签前面的内容，不包含标题)
        const content =
          messageEl
            .find(".js-message_text")
            .html()
            ?.replace(title, "")
            .split("<a")[0]
            .replace(/<br>/g, "")
            .trim() || "";

        // 提取链接 (消息中的链接)
        // const link = messageEl.find('.tgme_widget_message').data('post');

        // 提取发布时间
        const pubDate = messageEl.find("time").attr("datetime");

        // 提取图片
        const image = messageEl
          .find(".tgme_widget_message_photo_wrap")
          .attr("style")
          ?.match(/url\('(.+?)'\)/)?.[1];

        const tags: string[] = [];
        // 提取云盘链接
        const links = messageEl
          .find(".tgme_widget_message_text a")
          .map((_, el) => $(el).attr("href"))
          .get();
        messageEl.find(".tgme_widget_message_text a").each((index, element) => {
          const tagText = $(element).text();
          if (tagText && tagText.startsWith("#")) {
            tags.push(tagText);
          }
        });
        // 提取链接的文本（href + 文本），用于在文本中匹配磁力链
        const allHrefs = messageEl
          .find(".tgme_widget_message_text a")
          .map((_, el) => $(el).attr("href"))
          .get();
        const allTexts = messageEl.find(".tgme_widget_message_text").text();
        // 同时从 href 和纯文本中匹配（磁力链常出现在纯文本中）
        const cloudInfo = this.extractCloudLinks([...allHrefs, allTexts].join(" "));
        // 添加到数组第一位
        items.unshift({
          messageId,
          title,
          pubDate,
          content,
          image,
          cloudLinks: cloudInfo.links,
          cloudType: cloudInfo.cloudType,
          tags,
          magnet: cloudInfo.magnet,
          ed2k: cloudInfo.ed2k,
        } as any);
      });
      return { items: items, channelLogo };
    } catch (error) {
      logger.error(`搜索错误: ${url}`, error);
      throw error;
    }
  }
}
