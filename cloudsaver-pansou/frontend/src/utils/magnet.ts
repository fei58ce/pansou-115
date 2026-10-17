import { ElMessage } from "element-plus";
import { showNotify } from "vant";
import { isMobileDevice } from "@/utils/index";
import { cloud115QrcodeApi } from "@/api/cloud115Qrcode";

const tip = (type: "success" | "error" | "warning", message: string) => {
  if (isMobileDevice()) {
    showNotify({
      type: type === "success" ? "success" : type === "warning" ? "warning" : "danger",
      message,
    });
    return;
  }
  if (type === "success") ElMessage.success(message);
  else if (type === "warning") ElMessage.warning(message);
  else ElMessage.error(message);
};

/**
 * 复制文本到剪贴板
 */
export async function copyText(text: string, successMsg = "已复制到剪贴板"): Promise<boolean> {
  if (!text) {
    tip("warning", "没有可复制的内容");
    return false;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    tip("success", successMsg);
    return true;
  } catch {
    tip("error", "复制失败，请手动复制");
    return false;
  }
}

/**
 * 复制磁力链
 */
export async function copyMagnet(magnet: string | string[]): Promise<boolean> {
  const text = Array.isArray(magnet) ? magnet[0] : magnet;
  return copyText(text, "磁力链已复制");
}

/**
 * 调用 115 离线下载接口添加磁力任务
 * @param magnet 磁力链
 * @param cid 目标目录，默认根目录
 */
export async function add115Lixian(magnet: string, cid = "0"): Promise<boolean> {
  if (!magnet) {
    tip("warning", "没有可下载的磁力链");
    return false;
  }
  try {
    const result = await cloud115QrcodeApi.addLixianTask(magnet, cid);
    tip("success", result?.message || "已提交到 115 离线下载");
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "提交 115 离线下载失败";
    tip("error", msg);
    return false;
  }
}
