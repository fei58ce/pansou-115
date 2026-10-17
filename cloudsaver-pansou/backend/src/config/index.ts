import dotenv from "dotenv";

// 加载.env文件
dotenv.config();

interface Channel {
  id: string;
  name: string;
}

interface CloudPatterns {
  baiduPan: RegExp;
  tianyi: RegExp;
  aliyun: RegExp;
  pan115: RegExp;
  pan123: RegExp;
  quark: RegExp;
  yidong: RegExp;
  magnet: RegExp;
  ed2k: RegExp;
}

interface TmdbConfig {
  apiKey: string;
  baseUrl: string;
  imageBaseUrl: string;
  language: string;
}

interface Config {
  jwtSecret: string;
  telegram: {
    baseUrl: string;
    channels: Channel[];
  };
  cloudPatterns: CloudPatterns;
  app: {
    port: number;
    env: string;
  };
  database: {
    type: string;
    path: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  tmdb: TmdbConfig;
  panSou: {
    baseUrl: string;
    /**
     * 启用的网盘类型列表
     * Pansou 支持: baidu, aliyun, quark, guangya, tianyi, uc, mobile, 115, pikpak, xunlei, 123, magnet, ed2k
     */
    cloudTypes: string[];
  };
}

// 从环境变量读取频道配置
const getTeleChannels = (): Channel[] => {
  try {
    const channelsStr = process.env.TELE_CHANNELS;
    if (channelsStr) {
      return JSON.parse(channelsStr);
    }
  } catch (error) {
    // 注意：此处不依赖 logger，避免与 logger.ts 形成循环引用
    // eslint-disable-next-line no-console
    console.warn("无法解析 TELE_CHANNELS 环境变量，使用默认配置:", error);
  }

  // 默认配置
  return [];
};

/**
 * 解析 JWT 密钥
 * 优先使用 JWT_SECRET 环境变量；
 * 未设置时根据当前环境给出警告（开发环境使用临时占位密钥，生产环境抛出错误）。
 */
const resolveJwtSecret = (): string => {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    throw new Error("未设置 JWT_SECRET 环境变量。生产环境必须配置强随机密钥（建议 32 字节以上）。");
  }

  // 开发环境使用占位密钥并发出警告
  // eslint-disable-next-line no-console
  console.warn(
    "[警告] 未设置 JWT_SECRET 环境变量，当前使用开发环境占位密钥。生产部署前务必设置强随机密钥。"
  );
  return "dev-only-insecure-secret-change-me";
};

export const config: Config = {
  app: {
    port: parseInt(process.env.PORT || "8009"),
    env: process.env.NODE_ENV || "development",
  },
  database: {
    type: "sqlite",
    path: "./data/database.sqlite",
  },
  jwt: {
    secret: resolveJwtSecret(),
    expiresIn: "6h",
  },
  jwtSecret: resolveJwtSecret(),

  telegram: {
    baseUrl: process.env.TELEGRAM_BASE_URL || "https://t.me/s",
    channels: getTeleChannels(),
  },
  cloudPatterns: {
    baiduPan: /https?:\/\/(?:pan|yun)\.baidu\.com\/[^\s<>"]+/g,
    tianyi: /https?:\/\/cloud\.189\.cn\/[^\s<>"]+/g,
    aliyun: /https?:\/\/\w+\.(?:alipan|aliyundrive)\.com\/[^\s<>"]+/g,
    // pan115有两个域名 115.com 和 anxia.com 和 115cdn.com
    pan115: /https?:\/\/(?:115|anxia|115cdn)\.com\/s\/[^\s<>"]+/g,
    // 修改为匹配所有以123开头的域名
    // eslint-disable-next-line no-useless-escape
    pan123: /https?:\/\/(?:www\.)?123[^\/\s<>"]+\.com\/s\/[^\s<>"]+/g,
    quark: /https?:\/\/pan\.quark\.cn\/[^\s<>"]+/g,
    yidong: /https?:\/\/caiyun\.139\.com\/[^\s<>"]+/g,
    // 磁力链接
    magnet: /magnet:\?xt=urn:btih:[a-zA-Z0-9]+(?:&[^\s<>"]*)?/g,
    // 电驴链接
    // eslint-disable-next-line no-useless-escape
    ed2k: /ed2k:\/\/\|[^\s<>"]+\|/g,
  },
  tmdb: {
    apiKey: process.env.TMDB_API_KEY || "",
    baseUrl: process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3",
    imageBaseUrl: process.env.TMDB_IMAGE_BASE_URL || "https://image.tmdb.org/t/p",
    language: process.env.TMDB_LANGUAGE || "zh-CN",
  },
  panSou: {
    baseUrl: process.env.PANSOU_BASE_URL || "http://pansou:8888",
    cloudTypes: (
      process.env.PANSOU_CLOUD_TYPES || "baidu,aliyun,quark,115,xunlei,pikpak,123,magnet,ed2k"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
};
