import { defineStore } from "pinia";
import { tmdbApi } from "@/api/tmdb";
import type {
  TmdbItem,
  TmdbListType,
  TmdbMediaType,
  TmdbTimeWindow,
  TmdbListParams,
} from "@/types/tmdb";
import { ElMessage } from "element-plus";

interface StoreState {
  list: TmdbItem[];
  loading: boolean;
  currentType: TmdbListType;
  currentMediaType: TmdbMediaType | "movie" | "tv";
  currentTimeWindow: TmdbTimeWindow;
  error: string;
}

export const useTmdbStore = defineStore("tmdb", {
  state: (): StoreState => ({
    list: [],
    loading: false,
    currentType: "trending",
    currentMediaType: "all",
    currentTimeWindow: "week",
    error: "",
  }),

  actions: {
    /**
     * 加载榜单
     * @param type 榜单类型
     * @param mediaType 内容类型
     * @param timeWindow 时间窗口（仅 trending）
     */
    async loadList(
      type?: TmdbListType,
      mediaType?: TmdbMediaType | "movie" | "tv",
      timeWindow?: TmdbTimeWindow
    ) {
      if (type) this.currentType = type;
      if (mediaType) this.currentMediaType = mediaType;
      if (timeWindow) this.currentTimeWindow = timeWindow;

      this.loading = true;
      this.error = "";
      try {
        const params: TmdbListParams = { mediaType: this.currentMediaType };
        if (this.currentType === "trending") {
          params.timeWindow = this.currentTimeWindow;
        }
        let list: TmdbItem[] = [];
        switch (this.currentType) {
          case "trending":
            list = (await tmdbApi.getTrending(params)) || [];
            break;
          case "popular":
            list = (await tmdbApi.getPopular(params)) || [];
            break;
          case "top_rated":
            list = (await tmdbApi.getTopRated(params)) || [];
            break;
          case "now_playing":
            list = (await tmdbApi.getNowPlaying(params)) || [];
            break;
        }
        this.list = list;
        if (this.list.length === 0) {
          ElMessage.warning("未获取到内容，请检查 TMDB_API_KEY 是否配置");
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : "获取 TMDB 数据失败";
        ElMessage.error(this.error);
        this.list = [];
      } finally {
        this.loading = false;
      }
    },
  },
});
