import { Request, Response } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../core/types";
import { ImageService } from "../services/ImageService";
import crypto from "crypto";
import { isRememberedImageUrl } from "../utils/imageSources";

const DEFAULT_IMAGE_HOSTS = [
  "telesco.pe",
  "telegram.org",
  "telegra.ph",
  "doubanio.com",
  "ddys.io",
  "tmdb.org",
];

function isAllowedImageUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return false;

    const extraHosts = (process.env.IMAGE_PROXY_ALLOWED_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
    const hostname = parsed.hostname.toLowerCase();
    const hosts = [...DEFAULT_IMAGE_HOSTS, ...extraHosts];
    return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

// 其他图床只放行本站搜索结果返回过的地址，并限定 http/https 默认端口、不带账号信息。
function isRememberedUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    if (parsed.port || parsed.username || parsed.password) return false;
    return isRememberedImageUrl(rawUrl);
  } catch {
    return false;
  }
}

function decodeOnce(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

@injectable()
export class ImageController {
  constructor(@inject(TYPES.ImageService) private imageService: ImageService) {}

  async getImages(req: Request, res: Response): Promise<void> {
    try {
      const raw = typeof req.query.url === "string" ? req.query.url : "";
      // 查询参数已由 Express 解码一次；地址若多编码了一层，再解码一次匹配。
      const candidates = raw ? [raw, decodeOnce(raw)] : [];
      const trusted = candidates.find(isAllowedImageUrl);
      const url = trusted || candidates.find(isRememberedUrl);
      if (!url) {
        res.status(400).json({ message: "图片地址不在允许的图床白名单中" });
        return;
      }

      const etag = `"img-${crypto.createHash("md5").update(url).digest("hex")}"`;
      res.setHeader("ETag", etag);
      if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }

      const { buffer, contentType, fromCache } = await this.imageService.getImageBuffer(
        url,
        !trusted
      );
      res.setHeader("Content-Type", contentType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Content-Length", String(buffer.length));
      if (fromCache) res.setHeader("X-Cache", "HIT");
      res.send(buffer);
    } catch {
      res.status(502).end();
    }
  }
}
