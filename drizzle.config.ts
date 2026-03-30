import path from "node:path";
import { defineConfig } from "drizzle-kit";

const dataDirectory = path.join(process.cwd(), ".data");
const databasePath =
  process.env.LOCAL_SETTINGS_DATABASE_PATH?.trim() ||
  path.join(dataDirectory, "settings.sqlite");

export default defineConfig({
  dialect: "sqlite",
  dbCredentials: {
    url: databasePath,
  },
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  strict: true,
});
