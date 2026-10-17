import request from "@/utils/request";
import type { TmdbItem, TmdbListParams, TmdbGenre } from "@/types/tmdb";

export const tmdbApi = {
  /**
   * 趋势榜（每日/每周）
   */
  async getTrending(params: TmdbListParams) {
    const { data } = await request.get<TmdbItem[]>("/api/tmdb/trending", {
      params: {
        mediaType: params.mediaType || "all",
        timeWindow: params.timeWindow || "week",
        language: params.language,
      },
    });
    return data;
  },

  /**
   * 流行榜
   */
  async getPopular(params: TmdbListParams) {
    const { data } = await request.get<TmdbItem[]>("/api/tmdb/popular", {
      params: {
        mediaType: params.mediaType || "movie",
        page: params.page,
        language: params.language,
      },
    });
    return data;
  },

  /**
   * 高分榜
   */
  async getTopRated(params: TmdbListParams) {
    const { data } = await request.get<TmdbItem[]>("/api/tmdb/top-rated", {
      params: {
        mediaType: params.mediaType || "movie",
        page: params.page,
        language: params.language,
      },
    });
    return data;
  },

  /**
   * 正在上映/播出
   */
  async getNowPlaying(params: TmdbListParams) {
    const { data } = await request.get<TmdbItem[]>("/api/tmdb/now-playing", {
      params: {
        mediaType: params.mediaType || "movie",
        page: params.page,
        language: params.language,
      },
    });
    return data;
  },

  /**
   * 获取类型列表
   */
  async getGenres(mediaType: "movie" | "tv") {
    const { data } = await request.get<TmdbGenre[]>(`/api/tmdb/genres`, {
      params: { mediaType },
    });
    return data;
  },
};
