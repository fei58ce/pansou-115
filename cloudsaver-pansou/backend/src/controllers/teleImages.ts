import { Request, Response } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../core/types";
import { ImageService } from "../services/ImageService";
import { BaseController } from "./BaseController";
import crypto from "crypto";

@injectable()
export class ImageController extends BaseController {
  constructor(@inject(TYPES.ImageService) private imageService: ImageService) {
    super();
  }

  async getImages(req: Request, res: Response): Promise<void> {
    try {
      const url = decodeURIComponent((req.query.url as string) || "");
      if (!url) {
        res.status(400).end();
        return;
      }

      // ETag 基于 URL（内容不变时命中 304，浏览器不发新请求）
      const etag = `"img-${crypto.createHash("md5").update(url).digest("hex")}"`;
      res.setHeader("ETag", etag);
      if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }

      const { buffer, contentType, fromCache } = await this.imageService.getImageBuffer(url);

      // TG 图片签名 URL 短期内有效且内容不变，允许浏览器长缓存
      // 注意：不能用 immutable，URL 过期后需要重新搜索获取新 URL
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400"); // 浏览器缓存 24 小时
      res.setHeader("Content-Length", String(buffer.length));
      if (fromCache) {
        res.setHeader("X-Cache", "HIT");
      }
      res.send(buffer);
    } catch (error) {
      // 上游失败返回 502，让 el-image 显示占位
      res.status(502).end();
    }
  }
}
