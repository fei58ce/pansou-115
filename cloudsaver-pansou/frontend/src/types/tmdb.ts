/**
 * TMDB 内容类型
 */
export type TmdbMediaType = "movie" | "tv" | "all";

/**
 * TMDB 时间窗口
 */
export type TmdbTimeWindow = "day" | "week";

/**
 * TMDB 榜单分类（用于前端菜单）
 */
export type TmdbListType = "trending" | "popular" | "top_rated" | "now_playing";

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

export interface TmdbListParams {
  mediaType?: TmdbMediaType | "movie" | "tv";
  timeWindow?: TmdbTimeWindow;
  language?: string;
  page?: number;
}
