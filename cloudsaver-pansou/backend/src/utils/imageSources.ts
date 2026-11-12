import dns from "dns";
import net from "net";

const REMEMBER_LIMIT = 50000;
const REMEMBER_TTL = 24 * 60 * 60 * 1000;
const remembered = new Map<string, number>();

/**
 * 记录本站搜索结果里返回过的图片地址。
 * 图片代理对白名单以外的图床只放行这些地址，避免被当成任意网址代理。
 */
export function rememberImageUrls(urls: Iterable<unknown>): void {
  const now = Date.now();
  for (const url of urls) {
    if (typeof url !== "string" || url.length > 2048 || !/^https?:\/\//i.test(url)) continue;
    remembered.delete(url);
    remembered.set(url, now);
  }
  for (const key of remembered.keys()) {
    if (remembered.size <= REMEMBER_LIMIT) break;
    remembered.delete(key);
  }
}

export function isRememberedImageUrl(url: string): boolean {
  const at = remembered.get(url);
  if (at === undefined) return false;
  if (Date.now() - at <= REMEMBER_TTL) return true;
  remembered.delete(url);
  return false;
}

const reserved = new net.BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  reserved.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 127],
  ["64:ff9b::", 96],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  reserved.addSubnet(address, prefix, "ipv6");
}

/** 只有公网地址可以连接：拒绝回环、内网、链路本地、运营商NAT、保留和组播地址。 */
export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  return family !== 0 && !reserved.check(address, family === 6 ? "ipv6" : "ipv4");
}

export function privateAddressError(): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error("图片地址指向内网或保留地址，已拒绝");
  error.code = "EIMAGEPRIVATE";
  return error;
}

/** 地址里直接写 IP 时 Node 不会做 DNS 解析，guardedLookup 管不到，需要单独校验。 */
export function assertPublicHost(hostname: string): void {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && !isPublicAddress(host)) throw privateAddressError();
}

/** 连接时校验解析结果（重定向的每一跳也会经过这里），防止借域名解析到内网。 */
export const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address))) {
      return callback(privateAddressError(), "");
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

/** 按文件头识别常见位图；识别不出来就返回空串（包括 SVG 和网页）。 */
export function detectRasterImage(buffer: Buffer): string {
  const text = (start: number, end: number) => buffer.subarray(start, end).toString("latin1");
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (text(0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (text(0, 4) === "GIF8") return "image/gif";
  if (text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return "image/webp";
  if (text(4, 8) === "ftyp" && /^avi[fs]$/.test(text(8, 12))) return "image/avif";
  return "";
}
