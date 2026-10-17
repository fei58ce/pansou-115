import { Request, Response } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../core/types";
import { ImageService } from "../services/ImageService";
import crypto from "crypto";

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

@injectable()
export class ImageController {
  constructor(@inject(TYPES.ImageService) private imageService: ImageService) {}

  async getImages(req: Request, res: Response): Promise<void> {
    try {
      const url = decodeURIComponent((req.query.url as string) || "");
      if (!url || !isAllowedImageUrl(url)) {
        res.status(400).json({ message: "图片地址不在允许的图床白名单中" });
        return;
      }

      const etag = `"img-${crypto.createHash("md5").update(url).digest("hex")}"`;
      res.setHeader("ETag", etag);
      if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }

      const { buffer, contentType, fromCache } = await this.imageService.getImageBuffer(url);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Content-Length", String(buffer.length));
      if (fromCache) res.setHeader("X-Cache", "HIT");
      res.send(buffer);
    } catch {
      res.status(502).end();
    }
  }
}
