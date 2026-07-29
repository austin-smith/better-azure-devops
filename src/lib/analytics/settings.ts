import "server-only";
import {
  readAppSetting,
  writeAppSettings,
} from "@/db/repositories/app-settings";
import {
  DEFAULT_ANALYTICS_REFRESH_INTERVAL_HOURS,
  MAX_ANALYTICS_HISTORY_WINDOW_DAYS,
  MAX_ANALYTICS_REFRESH_INTERVAL_HOURS,
  MIN_ANALYTICS_REFRESH_INTERVAL_HOURS,
  type AnalyticsSettings,
} from "@/lib/analytics/settings-schema";

export const ANALYTICS_REFRESH_INTERVAL_HOURS_KEY =
  "analytics.refreshIntervalHours";
export const ANALYTICS_HISTORY_WINDOW_DAYS_KEY =
  "analytics.historyWindowDays";
export const ANALYTICS_ENABLED_KEY = "analytics.enabled";

function parseStoredInteger(
  value: string | null,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  if (value === null || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) &&
    parsed >= minimum &&
    parsed <= maximum
    ? parsed
    : fallback;
}

export function loadAnalyticsSettings(): AnalyticsSettings {
  const storedHistoryWindowDays = readAppSetting(
    ANALYTICS_HISTORY_WINDOW_DAYS_KEY,
  );
  const parsedHistoryWindowDays = Number(storedHistoryWindowDays);

  return {
    enabled: isRepositoryAnalyticsEnabled(),
    historyWindowDays:
      storedHistoryWindowDays !== null &&
      Number.isSafeInteger(parsedHistoryWindowDays) &&
      parsedHistoryWindowDays >= 1 &&
      parsedHistoryWindowDays <= MAX_ANALYTICS_HISTORY_WINDOW_DAYS
        ? parsedHistoryWindowDays
        : null,
    refreshIntervalHours: parseStoredInteger(
      readAppSetting(ANALYTICS_REFRESH_INTERVAL_HOURS_KEY),
      MIN_ANALYTICS_REFRESH_INTERVAL_HOURS,
      MAX_ANALYTICS_REFRESH_INTERVAL_HOURS,
      DEFAULT_ANALYTICS_REFRESH_INTERVAL_HOURS,
    ),
  };
}

export function isRepositoryAnalyticsEnabled() {
  return readAppSetting(ANALYTICS_ENABLED_KEY) === "true";
}

export function saveAnalyticsSettings(settings: AnalyticsSettings) {
  writeAppSettings([
    {
      key: ANALYTICS_ENABLED_KEY,
      value: String(settings.enabled),
    },
    {
      key: ANALYTICS_REFRESH_INTERVAL_HOURS_KEY,
      value: String(settings.refreshIntervalHours),
    },
    {
      key: ANALYTICS_HISTORY_WINDOW_DAYS_KEY,
      value:
        settings.historyWindowDays === null
          ? "all"
          : String(settings.historyWindowDays),
    },
  ]);
}
