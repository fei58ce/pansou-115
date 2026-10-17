import axios, { AxiosInstance } from "axios";
import { config } from "../config";
import GlobalSetting from "../models/GlobalSetting";
import { logger } from "../utils/logger";
import { injectable } from "inversify";

/**
 * TMDB 内容类型
 * - movie: 电影
 * - tv: 电视剧
 * - all: 全部
 */
export type TmdbMediaType = "movie" | "tv" | "all";

/**
 * TMDB 时间窗口
 * - day: 当天
 * - week: 本周
 */
export type TmdbTimeWindow = "day" | "week";

export interface TmdbItem {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  poster: string;
  backdrop: string;
  rating: number;
  voteCount: number;
  releaseDate: string;
  mediaType: "movie" | "tv";
  genreIds: number[];
  url: string;
  popularity: number;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbRawItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: "movie" | "tv";
  genre_ids: number[];
  popularity: number;
}

interface TmdbTrendingResponse {
  results: TmdbRawItem[];
  total_pages: number;
  total_results: number;
  page: number;
}

interface TmdbGenreResponse {
  genres: TmdbGenre[];
}

@injectable()
export class TmdbService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: config.tmdb.baseUrl,
      timeout: 15000,
    });
  }

  /**
   * 获取 TMDB API Key。
   * 优先读数据库全局设置（管理员在设置页配置，保存即生效），
   * 未配置时回退到环境变量 TMDB_API_KEY。
   */
  private async getApiKey(): Promise<string> {
    try {
      const settings = await GlobalSetting.findOne();
      const dbKey = settings?.dataValues?.tmdbApiKey?.trim();
      if (dbKey) {
        return dbKey;
      }
    } catch (error) {
      logger.error("读取 TMDB 数据库配置失败，回退环境变量:", error);
    }
    const key = config.tmdb.apiKey;
    if (!key) {
      throw new Error("未配置 TMDB API Key，请在设置页或 TMDB_API_KEY 环境变量中配置");
    }
    return key;
  }

  /**
   * 拼接完整的图片 URL
   * @param path TMDB 返回的图片相对路径
   * @param size 尺寸（w92、w154、w185、w342、w500、w780、original）
   */
  private buildImageUrl(path: string | null, size = "w500"): string {
    if (!path) return "";
    return `${config.tmdb.imageBaseUrl}/${size}${path}`;
  }

  /**
   * 规范化 TMDB 原始数据
   * @param fallbackType 当 raw.media_type 缺失时的回退类型（trending 可能为 all）
   */
  private normalizeItem(raw: TmdbRawItem, fallbackType: TmdbMediaType | "movie" | "tv"): TmdbItem {
    let type: "movie" | "tv";
    if (raw.media_type === "movie" || raw.media_type === "tv") {
      type = raw.media_type;
    } else if (fallbackType === "tv") {
      type = "tv";
    } else if (fallbackType === "movie") {
      type = "movie";
    } else {
      // trending/all：用 title/name 字段判断
      type = raw.title || raw.original_title ? "movie" : "tv";
    }

    const title = raw.title || raw.name || raw.original_title || raw.original_name || "";
    const date = raw.release_date || raw.first_air_date || "";

    return {
      id: raw.id,
      title,
      originalTitle: raw.original_title || raw.original_name || "",
      overview: raw.overview || "",
      poster: this.buildImageUrl(raw.poster_path, "w500"),
      backdrop: this.buildImageUrl(raw.backdrop_path, "w780"),
      rating: raw.vote_average ?? 0,
      voteCount: raw.vote_count ?? 0,
      releaseDate: date,
      mediaType: type,
      genreIds: raw.genre_ids ?? [],
      // TMDB 详情页格式为 /movie/123 或 /tv/123
      url: `https://www.themoviedb.org/${type}/${raw.id}`,
      popularity: raw.popularity ?? 0,
    };
  }

  /**
   * 获取 trending 内容（每日/每周流行榜）
   */
  async getTrending(
    mediaType: TmdbMediaType = "all",
    timeWindow: TmdbTimeWindow = "week",
    language?: string
  ): Promise<TmdbItem[]> {
    const apiKey = await this.getApiKey();
    const lang = language || config.tmdb.language;
    try {
      const { data } = await this.api.get<TmdbTrendingResponse>(
        `/trending/${mediaType}/${timeWindow}`,
        { params: { api_key: apiKey, language: lang } }
      );
      return (data.results || []).map((raw) => this.normalizeItem(raw, mediaType));
    } catch (error) {
      logger.error("TMDB trending 请求失败:", error);
      return [];
    }
  }

  /**
   * 获取电影/电视榜单
   */
  async getPopular(mediaType: "movie" | "tv", page = 1, language?: string): Promise<TmdbItem[]> {
    const apiKey = await this.getApiKey();
    const lang = language || config.tmdb.language;
    try {
      const { data } = await this.api.get<TmdbTrendingResponse>(`/${mediaType}/popular`, {
        params: { api_key: apiKey, language: lang, page },
      });
      return (data.results || []).map((raw) => this.normalizeItem(raw, mediaType));
    } catch (error) {
      logger.error(`TMDB ${mediaType}/popular 请求失败:`, error);
      return [];
    }
  }

  /**
   * 获取高评分榜单
   */
  async getTopRated(mediaType: "movie" | "tv", page = 1, language?: string): Promise<TmdbItem[]> {
    const apiKey = await this.getApiKey();
    const lang = language || config.tmdb.language;
    try {
      const { data } = await this.api.get<TmdbTrendingResponse>(`/${mediaType}/top_rated`, {
        params: { api_key: apiKey, language: lang, page },
      });
      return (data.results || []).map((raw) => this.normalizeItem(raw, mediaType));
    } catch (error) {
      logger.error(`TMDB ${mediaType}/top_rated 请求失败:`, error);
      return [];
    }
  }

  /**
   * 获取正在上映 / 正在播出
   */
  async getNowPlaying(mediaType: "movie" | "tv", page = 1, language?: string): Promise<TmdbItem[]> {
    const apiKey = await this.getApiKey();
    const lang = language || config.tmdb.language;
    const endpoint = mediaType === "movie" ? "now_playing" : "on_the_air";
    try {
      const { data } = await this.api.get<TmdbTrendingResponse>(`/${mediaType}/${endpoint}`, {
        params: { api_key: apiKey, language: lang, page },
      });
      return (data.results || []).map((raw) => this.normalizeItem(raw, mediaType));
    } catch (error) {
      logger.error(`TMDB ${mediaType}/${endpoint} 请求失败:`, error);
      return [];
    }
  }

  /**
   * 获取类型列表
   */
  async getGenres(mediaType: "movie" | "tv", language?: string): Promise<TmdbGenre[]> {
    const apiKey = await this.getApiKey();
    const lang = language || config.tmdb.language;
    try {
      const { data } = await this.api.get<TmdbGenreResponse>(`/genre/${mediaType}/list`, {
        params: { api_key: apiKey, language: lang },
      });
      return data.genres || [];
    } catch (error) {
      logger.error(`TMDB ${mediaType} genre 请求失败:`, error);
      return [];
    }
  }
}
