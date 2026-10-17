import { useUserSettingStore } from "@/stores/userSetting";
import defaultImage from "@/assets/images/default.png";

/**
 * Telegram 图床在部分网络环境下无法直连。
 * 即使用户切换了“直连模式”，Telegram CDN 仍强制走本站代理；
 * 其它图片源则遵循用户的 proxy/local 选择。
 */
const FORCE_PROXY_HOSTS = new Set(["telesco.pe", "telegram.org", "telegra.ph"]);

function shouldForceProxy(originalUrl: string): boolean {
  try {
    const hostname = new URL(originalUrl).hostname.toLowerCase();
    return [...FORCE_PROXY_HOSTS].some(
      (host) => hostname === host || hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

export const getProxyImageUrl = (originalUrl: string): string => {
  const userStore = useUserSettingStore();
  if (!originalUrl) return defaultImage;

  const useProxy = userStore.imagesSource === "proxy" || shouldForceProxy(originalUrl);
  return useProxy ? `/tele-images/?url=${encodeURIComponent(originalUrl)}` : originalUrl;
};
