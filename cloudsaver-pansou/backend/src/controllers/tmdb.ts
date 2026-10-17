import { Request, Response } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../core/types";
import { TmdbService, TmdbMediaType, TmdbTimeWindow } from "../services/TmdbService";
import { BaseController } from "./BaseController";

/**
 * 兼容字符串 -> 联合类型，未匹配的则使用默认值
 */
const asMediaType = (val: unknown, fallback: TmdbMediaType): TmdbMediaType => {
  const v = String(val || "");
  if (v === "movie" || v === "tv" || v === "all") return v;
  return fallback;
};

const asTimeWindow = (val: unknown, fallback: TmdbTimeWindow): TmdbTimeWindow => {
  const v = String(val || "");
  if (v === "day" || v === "week") return v;
  return fallback;
};

@injectable()
export class TmdbController extends BaseController {
  constructor(@inject(TYPES.TmdbService) private tmdbService: TmdbService) {
    super();
  }

  async getTrending(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const { mediaType, timeWindow, language } = req.query;
      const data = await this.tmdbService.getTrending(
        asMediaType(mediaType, "all"),
        asTimeWindow(timeWindow, "week"),
        language as string | undefined
      );
      return { data };
    });
  }

  async getPopular(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const { mediaType, page, language } = req.query;
      const data = await this.tmdbService.getPopular(
        asMediaType(mediaType, "movie") as "movie" | "tv",
        page ? parseInt(page as string) : 1,
        language as string | undefined
      );
      return { data };
    });
  }

  async getTopRated(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const { mediaType, page, language } = req.query;
      const data = await this.tmdbService.getTopRated(
        asMediaType(mediaType, "movie") as "movie" | "tv",
        page ? parseInt(page as string) : 1,
        language as string | undefined
      );
      return { data };
    });
  }

  async getNowPlaying(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const { mediaType, page, language } = req.query;
      const data = await this.tmdbService.getNowPlaying(
        asMediaType(mediaType, "movie") as "movie" | "tv",
        page ? parseInt(page as string) : 1,
        language as string | undefined
      );
      return { data };
    });
  }

  async getGenres(req: Request, res: Response): Promise<void> {
    await this.handleRequest(req, res, async () => {
      const { mediaType, language } = req.query;
      const data = await this.tmdbService.getGenres(
        asMediaType(mediaType, "movie") as "movie" | "tv",
        language as string | undefined
      );
      return { data };
    });
  }
}
