export interface SubscriptionConfig {
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
  accountId: string;
  mode: "future" | "backfill";
  searchFallback: boolean;
}

export interface MediaFile {
  id: string;
  name: string;
  size: string;
  sha1: string;
  folder: boolean;
  context: string;
}

export function parseShare(value: string): { shareCode: string; receiveCode: string } {
  const url = new URL(value);
  if (url.protocol !== "https:" || !["115.com", "115cdn.com", "anxia.com"].includes(url.hostname)) {
    throw new Error("请输入HTTPS的115分享链接");
  }
  const code = url.pathname.match(/^\/s\/([a-zA-Z0-9]+)\/?$/)?.[1];
  if (!code) throw new Error("无法识别115分享链接");
  return { shareCode: code, receiveCode: url.searchParams.get("password") || "" };
}

export function accountId(cookie: string): string {
  const id = cookie.match(/(?:^|;\s*)UID=(\d+)_/)?.[1];
  if (!id) throw new Error("115授权缺失，请重新扫码");
  return id;
}

// 对数字token处理，不替换字符串内的内容，防止115大整数ID被JSON.parse舍入。
export function parse115Json(text: string): unknown {
  const safe = text.replace(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, (token) => {
    if (token.startsWith('"')) return token;
    if (/^-?\d{16,}$/.test(token)) return JSON.stringify(token);
    return token;
  });
  return JSON.parse(safe);
}

export function chinaDate(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}
export function nextDaily(now = new Date()): Date {
  const today = new Date(chinaDate(now) + "T18:00:00+08:00");
  if (today.getTime() <= now.getTime()) today.setUTCDate(today.getUTCDate() + 1);
  return today;
}
export const isVideo = (name: string): boolean =>
  /\.(mkv|mp4|avi|mov|ts|m2ts|wmv|iso)$/i.test(name);
const norm = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s._\-·]+/g, "");

export function identityMatches(text: string, c: SubscriptionConfig): boolean {
  const n = norm(text);
  return (
    [c.title, ...c.aliases].some((s) => {
      const title = norm(s);
      const index = n.indexOf(title);
      if (index < 0) return false;
      const after = n.slice(index + title.length);
      // 不把“剧名2”或“剧名续篇”自动识别成原剧；英文标题需词边界。
      if (/^(?:\d(?!\d{3})|续|續|之)/u.test(after)) return false;
      if (/^[a-z]/i.test(title) && /[a-z]$/i.test(title)) {
        const escape = s.replace(/[.*+?^${}()|[\]\\]/g, (ch) => "\\" + ch);
        return new RegExp(
          "(?:^|[^a-z])" + escape.replace(/\s+/g, "[ ._-]+") + "(?=$|[^a-z])",
          "i"
        ).test(text);
      }
      return true;
    }) &&
    (!c.year || text.includes(c.year))
  );
}

export function episodeOf(name: string, context = ""): { season: number; episode: number } | null {
  // 多集打包、区间、特别篇不自动处理；E01-E02 / E01E02 / 第1-2集均拒绝。
  if (/special|特[别別]篇|SP\d|合集|全\d+集/i.test(name)) return null;
  const se = [...name.matchAll(/S(\d{1,2})[ ._-]*E(\d{1,4})(?!\d)/gi)];
  const es = [...name.matchAll(/(?:^|[^a-z])E(?:P)?[ ._-]*(\d{1,4})(?!\d)|第(\d{1,4})[集话話]/gi)];
  if (
    se.length > 1 ||
    es.length > 1 ||
    /(?:E\d+(?:\s*[-~至到]\s*E?\d+(?!\d|p)|[ ._-]*E\d+)|第\d+[-~至到]\d+集)/i.test(name)
  )
    return null;
  let episode = se[0] ? Number(se[0][2]) : es[0] ? Number(es[0][1] || es[0][2]) : 0;
  if (!episode) {
    const cn = name.match(/第(\d{1,4})[集话話]/);
    episode = cn ? Number(cn[1]) : 0;
  }
  const digits: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  const text = (name + " " + context).replace(
    /第([一二三四五六七八九十])季/g,
    (_, n: string) => "第" + digits[n] + "季"
  );
  const seasons = [...text.matchAll(/(?:\bS(?:eason)?\s*(\d{1,2})(?=E\d|\b)|第(\d{1,2})季)/gi)].map(
    (m) => Number(m[1] || m[2])
  );
  const unique = [...new Set(seasons)];
  const season = se[0] ? Number(se[0][1]) : unique.length === 1 ? unique[0] : 0;
  if (!episode || !season || unique.some((s) => s !== season)) return null;
  return { season, episode };
}

export function matchFile(
  file: MediaFile,
  c: SubscriptionConfig
): { episode?: number; reason?: string } {
  if (file.folder || !isVideo(file.name)) return { reason: "非单个视频文件" };
  const text = file.context + " " + file.name;
  if (!identityMatches(text, c)) return { reason: "作品名或年份不匹配" };
  const e = episodeOf(file.name, file.context);
  if (!e || e.season !== c.season) return { reason: "季集不明确、跨季或多集打包" };
  if (c.quality && !(c.quality === "2160p" ? /2160p|\b4k\b/i : /1080p/i).test(text)) {
    return { reason: "清晰度不符合" };
  }
  if (c.requiredText && !text.toLowerCase().includes(c.requiredText.toLowerCase())) {
    return { reason: "字幕/版本关键字不符合" };
  }
  return { episode: e.episode };
}

export function sameFile(a: MediaFile, b: MediaFile): boolean {
  if (a.sha1 && b.sha1) return a.sha1.toLowerCase() === b.sha1.toLowerCase();
  return a.name === b.name && a.size !== "0" && a.size === b.size;
}
