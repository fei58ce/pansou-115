import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

interface RateLimitRecord {
  count: number;
  timestamp: number;
}

const WINDOW_MS = 60 * 1000; // 1分钟窗口
const MAX_REQUESTS = 600; // 每个IP每分钟最多600个请求
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 每 5 分钟清理一次过期记录
const MAX_MAP_SIZE = 50_000; // Map 容量上限，防止极端情况下的内存爆炸

/**
 * 基于滑动窗口的简易限流器。
 * - 使用 Map 存储每个 IP 的请求计数
 * - 启动一个定时器定期清理过期记录，避免内存泄漏
 * - 当 Map 容量超过阈值时清空整个表（极端情况下的兜底保护）
 */
class RateLimiterStore {
  private records = new Map<string, RateLimitRecord>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  /**
   * 记录一次请求并返回是否允许通过
   */
  hit(ip: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const record = this.records.get(ip);

    if (!record || now - record.timestamp > WINDOW_MS) {
      this.records.set(ip, { count: 1, timestamp: now });
      return { allowed: true };
    }

    record.count++;

    if (record.count > MAX_REQUESTS) {
      const retryAfter = Math.ceil((record.timestamp + WINDOW_MS - now) / 1000);
      return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
    }

    return { allowed: true };
  }

  /**
   * 清理过期的请求记录
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [ip, record] of this.records.entries()) {
      if (now - record.timestamp > WINDOW_MS) {
        this.records.delete(ip);
        removed++;
      }
    }

    // 兜底保护：如果条目数仍然过多，强制清空（可能是恶意刷量）
    if (this.records.size > MAX_MAP_SIZE) {
      logger.warn(`限流器记录数超过上限 (${this.records.size} > ${MAX_MAP_SIZE})，已强制清空`);
      this.records.clear();
    } else if (removed > 0) {
      logger.debug(`限流器清理过期记录 ${removed} 条，当前 ${this.records.size} 条`);
    }
  }

  /**
   * 启动定时清理任务
   */
  private startCleanup(): void {
    // 避免在测试场景下启动定时器
    if (process.env.NODE_ENV === "test") return;

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL_MS);

    // unref 防止定时器阻止进程退出
    this.cleanupTimer.unref?.();
  }

  /**
   * 停止定时清理任务（仅用于优雅关闭）
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

const store = new RateLimiterStore();

/**
 * 在进程退出时停止清理定时器
 */
const shutdownHandler = () => {
  store.stop();
};
process.once("SIGINT", shutdownHandler);
process.once("SIGTERM", shutdownHandler);

export const rateLimiter = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const result = store.hit(ip);

    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfter));
      return res.status(429).json({ message: "请求过于频繁，请稍后再试" });
    }

    next();
  };
};
