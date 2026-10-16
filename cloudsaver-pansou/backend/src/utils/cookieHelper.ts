import { Request } from "express";
import UserSetting from "../models/UserSetting";
import { logger } from "./logger";

/**
 * 错误信息：当用户未设置 cookie 时抛出
 */
export class CookieMissingError extends Error {
  constructor(public cloudType: string) {
    super(`请先设置${cloudType}网盘 cookie`);
    this.name = "CookieMissingError";
  }
}

/**
 * 根据用户 ID 获取指定网盘类型的 cookie
 * 避免在单例服务实例中存储 cookie 引起的多用户冲突
 *
 * @param userId 用户 ID
 * @param cookieType "cloud115" | "quark"
 * @returns 用户在该网盘的 cookie
 * @throws CookieMissingError 当 cookie 未设置时
 */
export async function getUserCookie(
  userId: string | undefined,
  cookieType: "cloud115" | "quark"
): Promise<string> {
  if (!userId) {
    throw new CookieMissingError(cookieType === "cloud115" ? "115" : "夸克");
  }

  try {
    const userSetting = await UserSetting.findOne({ where: { userId } });
    const cookieField = cookieType === "cloud115" ? "cloud115Cookie" : "quarkCookie";
    const cookie = userSetting?.dataValues?.[cookieField];

    if (!cookie) {
      throw new CookieMissingError(cookieType === "cloud115" ? "115" : "夸克");
    }
    return cookie;
  } catch (error) {
    if (error instanceof CookieMissingError) {
      throw error;
    }
    logger.error(`获取用户 ${userId} 的 ${cookieType} cookie 失败:`, error);
    throw new CookieMissingError(cookieType === "cloud115" ? "115" : "夸克");
  }
}

/**
 * 从 Request 中获取用户网盘 cookie（便捷方法）
 */
export async function getCookieFromRequest(
  req: Request,
  cookieType: "cloud115" | "quark"
): Promise<string> {
  const userId = req.user?.userId;
  return getUserCookie(userId, cookieType);
}
