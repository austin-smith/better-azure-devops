import { eq } from "drizzle-orm";
import { getLocalSettingsDb } from "@/db";
import { appSettings } from "@/db/schema";

export function readAppSetting(key: string) {
  const db = getLocalSettingsDb();
  const row = db.query.appSettings
    .findFirst({
      columns: {
        value: true,
      },
      where: eq(appSettings.key, key),
    })
    .sync();

  return typeof row?.value === "string" ? row.value : null;
}

export function writeAppSetting(key: string, value: string) {
  const db = getLocalSettingsDb();

  db.insert(appSettings)
    .values({
      key,
      value,
    })
    .onConflictDoUpdate({
      set: {
        updatedAt: new Date().toISOString(),
        value,
      },
      target: appSettings.key,
    })
    .run();
}
