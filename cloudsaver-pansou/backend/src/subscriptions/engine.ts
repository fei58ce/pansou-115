import { randomUUID } from "crypto";
import { Op, Transaction } from "sequelize";
import sequelize from "../config/database";
import { getUserCookie } from "../utils/cookieHelper";
import { HttpSubscriptionDrive, SubscriptionDrive } from "./drive";
import {
  Subscription,
  SubscriptionEntry,
  SubscriptionLease,
  SubscriptionRun,
  SubscriptionData,
} from "./models";
import {
  accountId,
  chinaDate,
  episodeOf,
  identityMatches,
  isVideo,
  matchFile,
  MediaFile,
  nextDaily,
  parseShare,
  sameFile,
  SubscriptionConfig,
} from "./rules";

type Candidate = { title: string; cloudLinks: string[]; pubDate?: string };
export interface Dependencies {
  drive: SubscriptionDrive;
  cookie: (userId: string) => Promise<string>;
  search: (title: string) => Promise<Candidate[]>;
  notify: () => Promise<{ triggered: boolean; message: string }>;
}
const stamp = () => new Date().toISOString();
const fileKey = (f: MediaFile) => (f.sha1 ? "sha:" + f.sha1.toLowerCase() : "id:" + f.id);
const safeError = (e: unknown): string => {
  const msg = e instanceof Error ? e.message : "检查失败";
  // 仅暴露本模块的诊断；网络错误不能含URL、Cookie或响应体。
  return /^(?:115|[\u4e00-\u9fff])/.test(msg)
    ? msg.slice(0, 200)
    : "网络或数据库异常，未确认的写入不会自动重试";
};
const risky = (e: unknown) => /风控/.test(safeError(e));

export class SubscriptionEngine {
  private busy = false;
  private cooldownUntil = 0;
  private queueTimer?: NodeJS.Timeout;
  private dailyTimer?: NodeJS.Timeout;
  constructor(private deps: Dependencies) {}

  async owned(userId: string, id: string) {
    const sub = await Subscription.findOne({ where: { id, userId, archived: false } });
    if (!sub) throw new Error("订阅不存在");
    return sub;
  }

  async validate(userId: string, input: Record<string, unknown>): Promise<SubscriptionConfig> {
    const title = String(input.title || "").trim();
    const season = Number(input.season);
    const year = String(input.year || "").trim();
    const targetCid = String(input.targetCid || "");
    const sourceCid = String(input.sourceCid ?? "0");
    const quality = String(input.quality || "");
    const requiredText = String(input.requiredText || "").trim();
    const aliases = Array.isArray(input.aliases)
      ? input.aliases
          .map(String)
          .map((v) => v.trim())
          .filter(Boolean)
      : [];
    if (
      title.length < 2 ||
      title.length > 100 ||
      aliases.length > 5 ||
      aliases.some((v) => v.length < 2 || v.length > 100)
    )
      throw new Error("作品名/别名为2至100字，最多5个别名");
    if (!Number.isInteger(season) || season < 1 || season > 99) throw new Error("季数须为1至99");
    if (year && !/^(19|20)\d{2}$/.test(year)) throw new Error("年份格式错误");
    if (!/^\d{1,30}$/.test(targetCid) || targetCid === "0")
      throw new Error("请选择具体剧集季目录，不能使用根目录");
    if (!/^\d{1,30}$/.test(sourceCid)) throw new Error("源目录ID无效");
    if (!["", "1080p", "2160p"].includes(quality) || requiredText.length > 80)
      throw new Error("资源要求无效");
    if (!["future", "backfill"].includes(String(input.mode))) throw new Error("请选择首次同步方式");
    const share = parseShare(String(input.shareUrl || ""));
    const receiveCode = String(input.receiveCode || share.receiveCode).trim();
    if (receiveCode.length > 32 || !/^[a-zA-Z0-9]*$/.test(receiveCode))
      throw new Error("提取码格式错误");
    const cookie = await this.deps.cookie(userId);
    const account = accountId(cookie);
    const target = await this.deps.drive.target(cookie, targetCid);
    return {
      title,
      aliases,
      year,
      season,
      quality,
      requiredText,
      ...share,
      receiveCode,
      sourceCid,
      targetCid,
      targetPath: target.path,
      accountId: account,
      mode: input.mode as "future" | "backfill",
      searchFallback: input.searchFallback === true,
    };
  }

  async save(userId: string, input: Record<string, unknown>, id?: string) {
    if (id) await this.owned(userId, id);
    if (!id && (await Subscription.count({ where: { userId, archived: false } })) >= 50)
      throw new Error("最多创建50条订阅");
    const config = await this.validate(userId, input);
    return sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE }, async (t) => {
      if (id) {
        const sub = await Subscription.findOne({
          where: { id, userId, archived: false },
          transaction: t,
        });
        if (!sub) throw new Error("订阅不存在");
        const others = await Subscription.findAll({
          where: { userId, archived: false, id: { [Op.ne]: id } },
          transaction: t,
        });
        if (
          others.some(
            (s) =>
              s.get().config.accountId === config.accountId &&
              s.get().config.targetCid === config.targetCid
          )
        )
          throw new Error("此目录已绑定另一条订阅");
        const active = await SubscriptionRun.count({
          where: { subscriptionId: id, state: ["queued", "running"] },
          transaction: t,
        });
        if (active) throw new Error("请等待当前检查结束后编辑");
        const pending = await SubscriptionEntry.count({
          where: { subscriptionId: id, state: "uncertain" },
          transaction: t,
        });
        if (pending) throw new Error("存在结果待核实的转存，请先核实；不要更换目标目录");
        await sub.update(
          {
            config,
            initialized: false,
            baseline: [],
            watermark: 0,
            revision: sub.get().revision + 1,
            lastError: "配置已更新，下一次检查重建基线",
          },
          { transaction: t }
        );
        return sub.get();
      }
      const duplicate = await Subscription.findAll({
        where: { userId, archived: false },
        transaction: t,
      });
      if (
        duplicate.some((s) => {
          const c = s.get().config;
          return c.accountId === config.accountId && c.targetCid === config.targetCid;
        })
      )
        throw new Error("此目录已绑定另一条订阅，请每季使用独立目录");
      return (await Subscription.create({ userId, config }, { transaction: t })).get();
    });
  }

  async enqueue(userId: string, id: string, mode = "manual", date = chinaDate()) {
    await this.owned(userId, id);
    const result = await sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE }, async (t) => {
      const sub = await Subscription.findOne({
        where: { id, userId, enabled: true, archived: false },
        transaction: t,
      });
      if (!sub) throw new Error("请先恢复订阅");
      const slot = mode === "auto" ? "auto:" + date : "manual:" + randomUUID();
      if (mode === "auto") {
        const prior = await SubscriptionRun.findOne({
          where: { subscriptionId: id, slot },
          transaction: t,
        });
        if (prior) return prior.get();
      }
      const active = await SubscriptionRun.findOne({
        where: { subscriptionId: id, state: ["queued", "running"] },
        transaction: t,
      });
      if (active) {
        if (mode === "auto")
          return (
            await SubscriptionRun.create(
              {
                userId,
                subscriptionId: id,
                slot,
                mode,
                state: "skipped",
                report: ["已有检查任务，本日不重复排队"],
                finishedAt: stamp(),
              },
              { transaction: t }
            )
          ).get();
        return active.get();
      }
      return (
        await SubscriptionRun.create({ userId, subscriptionId: id, slot, mode }, { transaction: t })
      ).get();
    });
    return result;
  }

  async toggle(userId: string, id: string, enabled: boolean, archived = false) {
    const sub = await this.owned(userId, id);
    if (enabled) {
      const cookie = await this.deps.cookie(userId);
      if (accountId(cookie) !== sub.get().config.accountId)
        throw new Error("115账号已变更，请编辑订阅并重新绑定");
      await this.deps.drive.target(cookie, sub.get().config.targetCid);
    }
    await sub.update({ enabled, archived });
    if (!enabled)
      await SubscriptionRun.update(
        { state: "canceled", finishedAt: stamp(), report: ["订阅已暂停"] },
        { where: { subscriptionId: id, userId, state: "queued" } }
      );
  }

  async list(userId: string) {
    const rows = await Subscription.findAll({
      where: { userId, archived: false },
      order: [["createdAt", "DESC"]],
    });
    return Promise.all(
      rows.map(async (s) => ({
        ...s.get(),
        nextCheck: s.get().enabled ? nextDaily().toISOString() : null,
        latestRun:
          (
            await SubscriptionRun.findOne({
              where: { subscriptionId: s.get().id, userId },
              order: [["createdAt", "DESC"]],
            })
          )?.get() || null,
        confirmed: await SubscriptionEntry.count({
          where: { subscriptionId: s.get().id, userId, state: "confirmed" },
        }),
        uncertain: await SubscriptionEntry.count({
          where: { subscriptionId: s.get().id, userId, state: "uncertain" },
        }),
      }))
    );
  }

  async drain(): Promise<void> {
    // 115风控后暂停消费队列，避免同批订阅继续请求延长封禁；排队任务保留。
    if (this.busy || Date.now() < this.cooldownUntil) return;
    this.busy = true;
    const owner = randomUUID();
    const leaseMs = 600000;
    let heartbeat: NodeJS.Timeout | undefined;
    try {
      const [claimed] = await SubscriptionLease.update(
        { owner, expiresAt: Date.now() + leaseMs },
        { where: { id: "worker", expiresAt: { [Op.lt]: Date.now() } } }
      );
      if (!claimed) return;
      heartbeat = setInterval(() => {
        void SubscriptionLease.update(
          { expiresAt: Date.now() + leaseMs },
          { where: { id: "worker", owner } }
        ).catch(() => undefined);
      }, 30000);
      // 只有持有全局租约才能回收崩溃任务。保留uncertain账本，恢复检查不得重发。
      await SubscriptionRun.update(
        {
          state: "interrupted",
          finishedAt: stamp(),
          report: ["进程中断；下次检查先核实已发送操作，不自动重复转存"],
        },
        { where: { state: "running" } }
      );
      for (let processed = 0; processed < 100; processed++) {
        const run = await SubscriptionRun.findOne({
          where: { state: "queued" },
          order: [["createdAt", "ASC"]],
        });
        if (!run) break;
        await run.update({ state: "running", startedAt: stamp() });
        const report: string[] = [];
        try {
          const sub = await this.owned(run.get().userId, run.get().subscriptionId);
          const guard = async () => {
            const held = await SubscriptionLease.count({
              where: { id: "worker", owner, expiresAt: { [Op.gt]: Date.now() } },
            });
            const fresh = await this.owned(sub.get().userId, sub.get().id);
            if (!held || !fresh.get().enabled || fresh.get().revision !== sub.get().revision)
              throw new Error("订阅已暂停、配置变更或执行锁已失效");
          };
          await this.sync(sub.get(), guard, report);
          await Subscription.update(
            { lastChecked: stamp(), lastError: "" },
            { where: { id: sub.get().id } }
          );
          await run.update({ state: "done", finishedAt: stamp(), report: report.slice(0, 100) });
        } catch (e) {
          const message = safeError(e);
          await Subscription.update(
            {
              lastChecked: stamp(),
              lastError: message,
              ...(/授权|账号|目标目录|其他目录/.test(message) ? { enabled: false } : {}),
            },
            { where: { id: run.get().subscriptionId } }
          );
          await run.update({
            state: "failed",
            finishedAt: stamp(),
            report: [...report, message].slice(0, 100),
          });
          if (/风控/.test(message)) {
            this.cooldownUntil = Date.now() + 30 * 60000;
            break;
          }
        }
      }
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      await SubscriptionLease.update(
        { owner: "", expiresAt: 0 },
        { where: { id: "worker", owner } }
      ).catch(() => undefined);
      this.busy = false;
    }
  }

  private async sync(sub: SubscriptionData, guard: () => Promise<void>, report: string[]) {
    await guard();
    const c = sub.config;
    const deadline = Date.now() + 8 * 60000;
    const cookie = await this.deps.cookie(sub.userId);
    if (accountId(cookie) !== c.accountId) throw new Error("115账号变更，已暂停自动转存");
    let target = await this.deps.drive.target(cookie, c.targetCid);
    // 优先核实历史未知结果；绝不将超时请求当作可以重发。
    const ledger = await SubscriptionEntry.findAll({
      where: { userId: sub.userId, accountId: c.accountId, targetCid: c.targetCid },
    });
    for (const entry of ledger) {
      if (entry.get().state !== "uncertain") continue;
      const found = target.files.find((f) => sameFile(f, entry.get().file));
      if (found) {
        await entry.update({ state: "confirmed", targetId: found.id });
        report.push("已核实上次转存：" + found.name);
      } else report.push("转存结果待核实，不自动重发：" + entry.get().file.name);
    }
    const existing = new Set<number>();
    let unknownTarget = false;
    for (const file of target.files.filter((f) => isVideo(f.name))) {
      const e = episodeOf(file.name, file.context + " Season " + c.season);
      if (!e || e.season !== c.season) unknownTarget = true;
      else existing.add(e.episode);
    }
    let sources: { file: MediaFile; config: SubscriptionConfig }[] = [];
    let sourceError = false;
    try {
      const tree = await this.deps.drive.source(cookie, c);
      sources = tree.files.map((file) => ({ file, config: c }));
    } catch (e) {
      if (!sub.initialized) throw e; // 基线不能基于不完整源建立。
      const failure = safeError(e);
      if (/授权|账号|风控/.test(failure)) throw e;
      sourceError = true;
      report.push(failure);
    }
    const baselineKeys = new Set(sub.baseline);
    if (!sub.initialized) {
      const watermark = Math.max(
        0,
        ...existing,
        ...sources.map(({ file }) => {
          const e = episodeOf(file.name, file.context);
          return identityMatches(file.context + " " + file.name, c) && e?.season === c.season
            ? e.episode
            : 0;
        })
      );
      await Subscription.update(
        { initialized: true, baseline: sources.map(({ file }) => fileKey(file)), watermark },
        { where: { id: sub.id } }
      );
      report.push("源目录基线已建立，共" + sources.length + "项");
      if (c.mode === "future") {
        report.push("仅后续新增：本次不转存已有集；下次检查18:00或手动检查");
        return;
      }
    }
    if (unknownTarget) {
      report.push("待确认：目标目录存在无法识别季集的视频，本轮不写入，避免重复");
      return;
    }
    if (c.searchFallback && sub.initialized) {
      try {
        const candidates = await this.deps.search(c.title);
        const used = new Set([c.shareCode]);
        for (const candidate of candidates.slice(0, 20)) {
          if (!identityMatches(candidate.title, c)) continue;
          if (c.mode === "future") {
            const published = Date.parse(candidate.pubDate || "");
            const created = new Date(sub.createdAt || 0).getTime();
            if (!Number.isFinite(published) || published <= created) {
              report.push("待确认：补充来源发布时间不明确或早于关注时间，不作新增自动转存");
              continue;
            }
          }
          for (const link of candidate.cloudLinks) {
            let parsed;
            try {
              parsed = parseShare(link);
            } catch {
              continue;
            }
            if (used.has(parsed.shareCode) || used.size >= 4) continue;
            used.add(parsed.shareCode);
            const other = { ...c, ...parsed, sourceCid: "0" };
            try {
              const tree = await this.deps.drive.source(cookie, other);
              sources.push(
                ...tree.files.map((file) => ({
                  file: { ...file, context: candidate.title + " " + file.context },
                  config: other,
                }))
              );
            } catch (e) {
              if (risky(e)) throw e;
              report.push("补充来源不可读取，已跳过");
            }
          }
        }
      } catch (e) {
        if (risky(e)) throw e;
        report.push("补充搜索暂不可用，固定来源继续处理");
      }
    }
    const occupied = new Set(ledger.map((e) => e.get().episode));
    let writes = 0;
    for (const { file, config } of sources) {
      if (!isVideo(file.name)) continue;
      const match = matchFile(file, c);
      if (!match.episode) {
        if (report.length < 70) report.push("待确认：" + file.name + "（" + match.reason + "）");
        continue;
      }
      const episode = match.episode;
      if (
        existing.has(episode) ||
        occupied.has(episode) ||
        target.files.some((f) => sameFile(f, file)) ||
        ledger.some((e) => sameFile(e.get().file, file))
      )
        continue;
      if (c.mode === "future" && (baselineKeys.has(fileKey(file)) || episode <= sub.watermark))
        continue;
      if (writes >= 10) {
        report.push("本轮最多新增10集，剩余下次检查");
        break;
      }
      if (Date.now() > deadline) {
        report.push("本轮达到时间上限，剩余下次检查");
        break;
      }
      await guard();
      // 每次写入前重新读目标，避免并行外部操作造成明显重复。
      target = await this.deps.drive.target(cookie, c.targetCid);
      if (
        target.files.some(
          (f) => isVideo(f.name) && !episodeOf(f.name, f.context + " Season " + c.season)
        )
      ) {
        report.push("目标目录新增了不明确的视频，本轮停止写入");
        break;
      }
      if (
        target.files.some(
          (f) =>
            sameFile(f, file) ||
            (isVideo(f.name) &&
              episodeOf(f.name, f.context + " Season " + c.season)?.episode === episode)
        )
      ) {
        existing.add(episode);
        continue;
      }
      await guard();
      const key = [c.accountId, c.targetCid, c.season, episode].join(":");
      const [entry, created] = await SubscriptionEntry.findOrCreate({
        where: { key },
        defaults: {
          key,
          subscriptionId: sub.id,
          userId: sub.userId,
          episode,
          file,
          targetCid: c.targetCid,
          accountId: c.accountId,
          state: "uncertain",
        },
      });
      if (!created) continue;
      occupied.add(episode);
      writes++;
      let blocked: unknown;
      try {
        await guard();
        await this.deps.drive.receive(cookie, config, file);
      } catch (e) {
        report.push("115未明确确认，本次请求不自动重发：" + file.name);
        if (risky(e)) blocked = e;
      }
      try {
        const after = await this.deps.drive.target(cookie, c.targetCid);
        const found = after.files.find((f) => sameFile(f, file));
        if (found) {
          await entry.update({ state: "confirmed", targetId: found.id });
          report.push("转存已确认：" + file.name);
        } else report.push("结果待核实：" + file.name);
      } catch {
        report.push("目标核实暂时失败，不重发转存：" + file.name);
      }
      if (blocked) throw blocked;
    }
    const notifyEntries = await SubscriptionEntry.findAll({
      where: { subscriptionId: sub.id, state: "confirmed", notified: false },
    });
    if (notifyEntries.length) {
      await guard();
      const result = await this.deps.notify();
      if (result.triggered)
        await SubscriptionEntry.update(
          { notified: true },
          { where: { key: notifyEntries.map((e) => e.get().key) } }
        );
      report.push(
        result.triggered
          ? "已通知OneStrm，STRM仍待核实"
          : "OneStrm未触发，请检查联动设置；文件不会重复转存"
      );
    }
    if (!writes) report.push("未发现可自动转存的缺集");
    if (sourceError) report.push("固定分享不可用，请检查来源；本轮不代表源无更新");
  }

  async daily(date = chinaDate()): Promise<void> {
    const list = await Subscription.findAll({ where: { enabled: true, archived: false } });
    for (const s of list) {
      try {
        await this.enqueue(s.get().userId, s.get().id, "auto", date);
      } catch {
        /* 单条失败不影响其他订阅 */
      }
    }
  }
  start(): void {
    // 此定时器仅消费持久化队列，不搜索资源。每日任务由独立18:00触发器入队。
    this.queueTimer = setInterval(() => {
      void this.drain().catch(() => undefined);
    }, 5000);
    this.queueTimer.unref();
    const schedule = () => {
      const due = nextDaily();
      this.dailyTimer = setTimeout(() => {
        void this.daily(chinaDate(due))
          .finally(schedule)
          .catch(() => undefined);
      }, due.getTime() - Date.now());
      this.dailyTimer.unref();
    };
    schedule();
  }
  stop(): void {
    if (this.queueTimer) clearInterval(this.queueTimer);
    if (this.dailyTimer) clearTimeout(this.dailyTimer);
  }
}
export const defaultDrive = new HttpSubscriptionDrive();
export const defaultCookie = (userId: string) => getUserCookie(userId, "cloud115");
