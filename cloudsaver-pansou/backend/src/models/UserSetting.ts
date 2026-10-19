import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import User from "./User";

interface UserSettingAttributes {
  id: number;
  userId: string;
  cloud115UserId?: string;
  cloud115Cookie: string;
  cloud115AppType?: string;
  cloud115UserName?: string;
  cloud115ValidatedAt?: Date;
  quarkCookie: string;
}

interface UserSettingCreationAttributes extends Optional<UserSettingAttributes, "id"> {}

class UserSetting
  extends Model<UserSettingAttributes, UserSettingCreationAttributes>
  implements UserSettingAttributes
{
  public id!: number;
  public userId!: string;
  public cloud115UserId?: string;
  public cloud115Cookie!: string;
  public cloud115AppType?: string;
  public cloud115UserName?: string;
  public cloud115ValidatedAt?: Date;
  public quarkCookie!: string;
}

UserSetting.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: User,
        key: "userId",
      },
      onDelete: "CASCADE",
    },
    cloud115UserId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cloud115Cookie: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cloud115AppType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cloud115UserName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cloud115ValidatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    quarkCookie: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "UserSetting",
    tableName: "user_settings",
  }
);

User.hasOne(UserSetting, {
  foreignKey: "userId",
  as: "settings",
});
UserSetting.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

export default UserSetting;
