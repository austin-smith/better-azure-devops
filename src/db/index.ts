import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/db/schema";

const APP_NAME = "better-azure-devops";
const SETTINGS_DATA_DIR = getDefaultSettingsDataDirectory();
const DEFAULT_DATABASE_PATH = path.join(SETTINGS_DATA_DIR, "settings.sqlite");
const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

let cachedDatabase:
  | {
      client: Database.Database;
      db: ReturnType<typeof drizzle<typeof schema>>;
      path: string;
    }
  | null = null;

const migratedPaths = new Set<string>();

function getDefaultSettingsDataDirectory() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA?.trim() || path.join(os.homedir(), "AppData", "Roaming"), APP_NAME);
  }

  return path.join(os.homedir(), `.${APP_NAME}`);
}

function getDatabasePath() {
  return process.env.LOCAL_SETTINGS_DATABASE_PATH?.trim() || DEFAULT_DATABASE_PATH;
}

function ensureDatabaseDirectory(databasePath: string) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

function ensureMigrations(databasePath: string, db: ReturnType<typeof drizzle<typeof schema>>) {
  if (migratedPaths.has(databasePath)) {
    return;
  }

  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  migratedPaths.add(databasePath);
}

export function getLocalSettingsDb() {
  const databasePath = getDatabasePath();

  if (cachedDatabase?.path === databasePath) {
    return cachedDatabase.db;
  }

  ensureDatabaseDirectory(databasePath);

  const client = new Database(databasePath);
  client.pragma("journal_mode = WAL");

  const db = drizzle(client, { schema });
  ensureMigrations(databasePath, db);

  cachedDatabase = {
    client,
    db,
    path: databasePath,
  };

  return db;
}
