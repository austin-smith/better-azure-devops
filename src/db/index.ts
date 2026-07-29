import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/db/schema";
import {
  ensureDatabaseDirectory,
  getDatabasePath,
} from "@/db/database-path";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

let cachedDatabase:
  | {
      client: Database.Database;
      db: ReturnType<typeof drizzle<typeof schema>>;
      path: string;
    }
  | null = null;

const migratedPaths = new Set<string>();

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
  client.pragma("foreign_keys = ON");
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
