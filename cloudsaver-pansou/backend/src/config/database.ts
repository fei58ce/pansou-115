// backend/src/config/database.ts
import { Sequelize } from "sequelize";

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: process.env.DATABASE_PATH || "./data/database.sqlite",
  logging: process.env.NODE_ENV === "test" ? false : undefined,
});

export default sequelize;
