import request from "@/utils/request";
import { HotListItem, HotListParams } from "@/types/douban";

export const doubanApi = {
  async getHotList(params: HotListParams) {
    const { data } = await request.get<HotListItem[]>("/api/douban/hot", {
      params,
      // 后端对豆瓣最多请求 3 次、每次 8 秒，这里要等得比这个总时长更久
      timeout: 30000,
    });
    return data;
  },
};
