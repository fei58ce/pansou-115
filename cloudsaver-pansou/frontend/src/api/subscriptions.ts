import request from "@/utils/request";
export interface FollowConfig {
  title: string;
  aliases: string[];
  year: string;
  season: number;
  quality: string;
  requiredText: string;
  shareCode: string;
  receiveCode: string;
  sourceCid: string;
  targetCid: string;
  targetPath: string;
  mode: "future" | "backfill";
  searchFallback: boolean;
}
export interface FollowRun {
  id: string;
  state: string;
  report: string[];
  startedAt: string;
  finishedAt: string;
}
export interface Follow {
  id: string;
  config: FollowConfig;
  enabled: boolean;
  initialized: boolean;
  lastChecked: string;
  lastError: string;
  nextCheck: string | null;
  confirmed: number;
  uncertain: number;
  latestRun: FollowRun | null;
}
export interface FollowEntry {
  key: string;
  episode: number;
  file: { name: string };
  state: string;
  notified: boolean;
}
function ok<T>(res: { code: number; data?: T; message?: string }): T {
  if (res.code !== 0 || res.data === undefined) throw new Error(res.message || "操作失败");
  return res.data;
}
export const subscriptionsApi = {
  async list() {
    return ok(await request.get<Follow[]>("/api/subscriptions"));
  },
  async save(data: Record<string, unknown>) {
    return ok(await request.post("/api/subscriptions/save", data, { timeout: 180000 }));
  },
  async check(id: string) {
    return ok(await request.post("/api/subscriptions/" + id + "/check", {}));
  },
  async state(id: string, enabled: boolean, archived = false) {
    return ok(
      await request.post(
        "/api/subscriptions/" + id + "/state",
        { enabled, archived },
        { timeout: 180000 }
      )
    );
  },
  async history(id: string) {
    return ok(
      await request.get<{ runs: FollowRun[]; entries: FollowEntry[] }>(
        "/api/subscriptions/" + id + "/history"
      )
    );
  },
};
