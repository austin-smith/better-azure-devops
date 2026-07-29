import { defineConfig } from "drizzle-kit";
import {
  ensureDatabaseDirectory,
  getDatabasePath,
} from "./src/db/database-path";

const databasePath = getDatabasePath();

ensureDatabaseDirectory(databasePath);

export default defineConfig({
  dialect: "sqlite",
  dbCredentials: {
    url: databasePath,
  },
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  strict: true,
});
