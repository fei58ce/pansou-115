import { injectable } from "inversify";
import axios, { AxiosInstance } from "axios";
import http from "http";
import https from "https";
import tunnel from "tunnel";
import GlobalSetting from "../models/GlobalSetting";
import { GlobalSettingAttributes } from "../models/GlobalSetting";
import { logger } from "../utils/logger";
import { assertPublicHost, detectRasterImage, guardedLookup } from "../utils/imageSources";

/**
 * 图片代理内存缓存（LRU）
 * - TG 图床 URL 带签名但短期内有效，缓存可显著减少回源
 * - 缓存键为完整 URL，值为 { buffer, contentType }
 * - 上限 200MB，超出淘汰最久未访问的条目
 */
interface CacheEntry {
  buffer: Buffer;
  contentType: string;
  size: number;
  lastAccess: number;
}

const CACHE_MAX_BYTES = 200 * 1024 * 1024; // 200MB
const CACHE_ENTRY_TTL = 6 * 60 * 60 * 1000; // 6 小时
const UNTRUSTED_MAX_BYTES = 10 * 1024 * 1024;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

/**
 * 白名单以外的图床：不走全局代理直连，每次连接（含重定向）都校验目标不是内网地址并限制大小；
 * 返回内容由 getImageBuffer 按文件头确认是图片。
 */
function createUntrustedClient(): AxiosInstance {
  const client = axios.create({
    timeout: 20000,
    maxRedirects: 3,
    maxContentLength: UNTRUSTED_MAX_BYTES,
    proxy: false,
    httpAgent: new http.Agent({ lookup: guardedLookup }),
    httpsAgent: new https.Agent({ lookup: guardedLookup }),
    headers: { Accept: "image/avif,image/webp,image/*;q=0.8", "User-Agent": BROWSER_UA },
    beforeRedirect: (options) => assertPublicHost(String(options.hostname || "")),
  });
  client.interceptors.request.use((config) => {
    assertPublicHost(new URL(config.url || "").hostname);
    return config;
  });
  return client;
}

@injectable()
export class ImageService {
  private axiosInstance: AxiosInstance | null = null;
  private untrusted = createUntrustedClient();
  private cache = new Map<string, CacheEntry>();
  private cacheBytes = 0;

  private async ensureAxiosInstance(): Promise<AxiosInstance> {
    if (!this.axiosInstance) {
      const settings = await GlobalSetting.findOne();
      const globalSetting = settings?.dataValues || ({} as GlobalSettingAttributes);

      this.axiosInstance = axios.create({
        timeout: 30000,
        headers: {
          Accept: "image/*, */*",
          "User-Agent": BROWSER_UA,
        },
        withCredentials: false,
        maxRedirects: 5,
        httpsAgent: globalSetting.isProxyEnabled
          ? tunnel.httpsOverHttp({
              proxy: {
                host: globalSetting.httpProxyHost,
                port: globalSetting.httpProxyPort,
                headers: {
                  "Proxy-Authorization": "",
                },
              },
            })
          : undefined,
      });

      this.axiosInstance.interceptors.response.use(
        (response) => response,
        (error) => {
          throw error;
        }
      );
    }
    return this.axiosInstance;
  }

  async updateAxiosInstance(): Promise<void> {
    this.axiosInstance = null;
    await this.ensureAxiosInstance();
  }

  private cacheGet(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.lastAccess > CACHE_ENTRY_TTL) {
      this.cache.delete(key);
      this.cacheBytes -= entry.size;
      return null;
    }
    entry.lastAccess = Date.now();
    return entry;
  }

  private cachePut(key: string, buffer: Buffer, contentType: string): void {
    // 单张图超过 20MB 不缓存（基本不会发生）
    if (buffer.length > 20 * 1024 * 1024) return;
    // 先淘汰旧条目腾空间
    while (this.cacheBytes + buffer.length > CACHE_MAX_BYTES && this.cache.size > 0) {
      let oldestKey = "";
      let oldestTime = Infinity;
      for (const [k, v] of this.cache.entries()) {
        if (v.lastAccess < oldestTime) {
          oldestTime = v.lastAccess;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        this.cacheBytes -= this.cache.get(oldestKey)!.size;
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { buffer, contentType, size: buffer.length, lastAccess: Date.now() });
    this.cacheBytes += buffer.length;
  }

  async getImageBuffer(
    url: string,
    untrusted = false
  ): Promise<{ buffer: Buffer; contentType: string; fromCache: boolean }> {
    const cached = this.cacheGet(url);
    if (cached) {
      return { buffer: cached.buffer, contentType: cached.contentType, fromCache: true };
    }

    const axiosInstance = untrusted ? this.untrusted : await this.ensureAxiosInstance();
    const response = await axiosInstance.get(url, {
      responseType: "arraybuffer",
      timeout: 20000,
      validateStatus: (status) => status >= 200 && status < 300,
      headers: {
        Referer: new URL(url).origin,
      },
    });

    const buffer = Buffer.from(response.data);
    const contentType = untrusted
      ? detectRasterImage(buffer)
      : response.headers["content-type"] || "image/jpeg";
    if (!contentType) throw new Error("图片地址返回的不是常见图片格式");
    this.cachePut(url, buffer, contentType);
    return { buffer, contentType, fromCache: false };
  }

  getCacheStats(): { count: number; bytes: number } {
    return { count: this.cache.size, bytes: this.cacheBytes };
  }

  async getImages(url: string): Promise<any> {
    // 兼容旧接口（流式）。当前控制器使用 getImageBuffer。
    const axiosInstance = await this.ensureAxiosInstance();
    return await axiosInstance.get(url, {
      responseType: "stream",
      validateStatus: (status) => status >= 200 && status < 300,
      headers: {
        Referer: new URL(url).origin,
      },
    });
  }
}
