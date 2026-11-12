import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";
import { MediaFile, SubscriptionConfig } from "./rules";

export interface SubscriptionData {
  id: string;
  userId: string;
  config: SubscriptionConfig;
  enabled: boolean;
  archived: boolean;
  initialized: boolean;
  baseline: string[];
  watermark: number;
  revision: number;
  lastChecked: string;
  lastError: string;
  createdAt?: Date;
}
export interface RunData {
  id: string;
  subscriptionId: string;
  userId: string;
  slot: string;
  mode: string;
  state: string;
  report: string[];
  startedAt: string;
  finishedAt: string;
  createdAt?: Date;
}
export interface EntryData {
  key: string;
  subscriptionId: string;
  userId: string;
  episode: number;
  file: MediaFile;
  state: string;
  targetId: string;
  targetCid: string;
  accountId: string;
  notified: boolean;
  updatedAt?: Date;
}
const str = (value = "") => ({ type: DataTypes.STRING, allowNull: false, defaultValue: value });
export const Subscription = sequelize.define<Model<SubscriptionData, Partial<SubscriptionData>>>(
  "Subscription",
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    userId: { type: DataTypes.STRING, allowNull: false },
    config: { type: DataTypes.JSON, allowNull: false },
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    initialized: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    baseline: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    watermark: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    lastChecked: str(),
    lastError: str(),
  },
  { tableName: "subscriptions", indexes: [{ fields: ["userId"] }] }
);
export const SubscriptionRun = sequelize.define<Model<RunData, Partial<RunData>>>(
  "SubscriptionRun",
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    subscriptionId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.STRING, allowNull: false },
    slot: { type: DataTypes.STRING, allowNull: false },
    mode: str("manual"),
    state: str("queued"),
    report: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    startedAt: str(),
    finishedAt: str(),
  },
  {
    tableName: "subscription_runs",
    indexes: [{ unique: true, fields: ["subscriptionId", "slot"] }],
  }
);
export const SubscriptionEntry = sequelize.define<Model<EntryData, Partial<EntryData>>>(
  "SubscriptionEntry",
  {
    key: { type: DataTypes.STRING, primaryKey: true },
    subscriptionId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.STRING, allowNull: false },
    episode: { type: DataTypes.INTEGER, allowNull: false },
    file: { type: DataTypes.JSON, allowNull: false },
    state: str("uncertain"),
    targetId: str(),
    targetCid: str(),
    accountId: str(),
    notified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { tableName: "subscription_entries", indexes: [{ fields: ["subscriptionId", "userId"] }] }
);
export const SubscriptionLease = sequelize.define(
  "SubscriptionLease",
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    owner: str(),
    expiresAt: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
  },
  { tableName: "subscription_leases", timestamps: false }
);

export async function initSubscriptionTables(): Promise<void> {
  // 独立增量建表，不使用alter，不修改既有用户表。
  await Subscription.sync();
  await SubscriptionRun.sync();
  await SubscriptionEntry.sync();
  await SubscriptionLease.sync();
  await sequelize.query(
    "INSERT OR IGNORE INTO subscription_leases (id, owner, expiresAt) VALUES ('worker', '', 0)"
  );
}
