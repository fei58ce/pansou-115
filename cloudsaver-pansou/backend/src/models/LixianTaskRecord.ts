import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface LixianTaskRecordAttributes {
  id: string;
  userId: string;
  url: string;
  cid: string;
  taskId: string;
  name: string;
  status: number;
  statusText: string;
  percent: number;
  lastError: string;
  renameTo: string;
  renameApplied: boolean;
}

interface LixianTaskRecordCreationAttributes
  extends Optional<
    LixianTaskRecordAttributes,
    | "id"
    | "taskId"
    | "name"
    | "status"
    | "statusText"
    | "percent"
    | "lastError"
    | "renameTo"
    | "renameApplied"
  > {}

class LixianTaskRecord
  extends Model<LixianTaskRecordAttributes, LixianTaskRecordCreationAttributes>
  implements LixianTaskRecordAttributes
{
  public id!: string;
  public userId!: string;
  public url!: string;
  public cid!: string;
  public taskId!: string;
  public name!: string;
  public status!: number;
  public statusText!: string;
  public percent!: number;
  public lastError!: string;
  public renameTo!: string;
  public renameApplied!: boolean;
}

LixianTaskRecord.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    cid: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "0",
    },
    taskId: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "",
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "未命名任务",
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    statusText: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "已提交",
    },
    percent: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },
    renameTo: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "",
    },
    renameApplied: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: "LixianTaskRecord",
    tableName: "lixian_task_records",
  }
);

export default LixianTaskRecord;
