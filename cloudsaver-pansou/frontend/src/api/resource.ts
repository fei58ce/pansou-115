import request from "@/utils/request";
import type { Resource } from "@/types/index";

export const resourceApi = {
  search(keyword: string, channelId?: string, lastMessageId?: string) {
    return request.get<Resource[]>(`/api/search`, {
      params: { keyword, channelId, lastMessageId },
      // 后端要等 TG 频道和 PanSou（各自最多 30 秒）再加补图/探活，默认 16 秒会提前放弃
      timeout: 60000,
    });
  },
};
