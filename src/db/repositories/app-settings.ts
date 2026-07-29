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
  writeAppSettings([{ key, value }]);
}

export function writeAppSettings(
  settings: readonly { key: string; value: string }[],
) {
  const db = getLocalSettingsDb();

  db.transaction((transaction) => {
    const updatedAt = new Date().toISOString();

    for (const setting of settings) {
      transaction
        .insert(appSettings)
        .values(setting)
        .onConflictDoUpdate({
          set: {
            updatedAt,
            value: setting.value,
          },
          target: appSettings.key,
        })
        .run();
    }
  });
}
