import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_NAME = "better-ado";
const LEGACY_APP_NAME = "better-azure-devops";

function getDefaultDataDirectory(appName: string) {
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA?.trim() ||
        path.join(
          /* turbopackIgnore: true */ os.homedir(),
          "AppData",
          "Roaming",
        ),
      appName,
    );
  }

  return path.join(
    /* turbopackIgnore: true */ os.homedir(),
    `.${appName}`,
  );
}

function getDefaultDatabasePath() {
  const databasePath = path.join(
    getDefaultDataDirectory(APP_NAME),
    "settings.sqlite",
  );
  const legacyDatabasePath = path.join(
    getDefaultDataDirectory(LEGACY_APP_NAME),
    "settings.sqlite",
  );

  if (
    !fs.existsSync(databasePath) &&
    fs.existsSync(legacyDatabasePath)
  ) {
    return legacyDatabasePath;
  }

  return databasePath;
}

export function getDatabasePath() {
  return (
    process.env.LOCAL_SETTINGS_DATABASE_PATH?.trim() ||
    getDefaultDatabasePath()
  );
}

export function ensureDatabaseDirectory(databasePath: string) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}
