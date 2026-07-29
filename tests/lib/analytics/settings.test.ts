import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeAppSetting } from "@/db/repositories/app-settings";
import {
  ANALYTICS_ENABLED_KEY,
  ANALYTICS_HISTORY_WINDOW_DAYS_KEY,
  ANALYTICS_REFRESH_INTERVAL_HOURS_KEY,
  loadAnalyticsSettings,
  saveAnalyticsSettings,
} from "@/lib/analytics/settings";
import {
  DEFAULT_ANALYTICS_REFRESH_INTERVAL_HOURS,
  MAX_ANALYTICS_HISTORY_WINDOW_DAYS,
  validateAnalyticsSettings,
} from "@/lib/analytics/settings-schema";

vi.mock("server-only", () => ({}));

describe("analytics settings", () => {
  beforeEach(() => {
    process.env.LOCAL_SETTINGS_DATABASE_PATH =
      path.join(
        tmpdir(),
        `better-ado-analytics-settings-${randomUUID()}.sqlite`,
      );
  });

  it("uses the default when the setting has not been saved", () => {
    expect(loadAnalyticsSettings()).toEqual({
      enabled: false,
      historyWindowDays: null,
      refreshIntervalHours: DEFAULT_ANALYTICS_REFRESH_INTERVAL_HOURS,
    });
  });

  it("saves and reloads the refresh interval", () => {
    saveAnalyticsSettings({
      enabled: true,
      historyWindowDays: 365,
      refreshIntervalHours: 12,
    });

    expect(loadAnalyticsSettings()).toEqual({
      enabled: true,
      historyWindowDays: 365,
      refreshIntervalHours: 12,
    });
  });

  it("falls back safely when the stored value is invalid", () => {
    writeAppSetting(ANALYTICS_REFRESH_INTERVAL_HOURS_KEY, "not-a-number");
    writeAppSetting(ANALYTICS_HISTORY_WINDOW_DAYS_KEY, "not-a-number");
    writeAppSetting(ANALYTICS_ENABLED_KEY, "not-a-boolean");

    expect(loadAnalyticsSettings()).toEqual({
      enabled: false,
      historyWindowDays: null,
      refreshIntervalHours: DEFAULT_ANALYTICS_REFRESH_INTERVAL_HOURS,
    });
  });

  it("validates the form field at the settings boundary", () => {
    expect(
      validateAnalyticsSettings({
        enabled: "on",
        historyWindowDays: "",
        refreshIntervalHours: "12",
      }),
    ).toEqual({
      data: {
        enabled: true,
        historyWindowDays: null,
        refreshIntervalHours: 12,
      },
      errors: null,
    });

    expect(
      validateAnalyticsSettings({
        enabled: null,
        historyWindowDays: "-1",
        refreshIntervalHours: "0",
      }),
    ).toEqual({
      data: null,
      errors: {
        historyWindowDays:
          `History range must be a whole number from 1 through ${MAX_ANALYTICS_HISTORY_WINDOW_DAYS} or left blank.`,
        refreshIntervalHours:
          "Refresh interval must be a whole number from 1 through 168.",
      },
    });

    expect(
      validateAnalyticsSettings({
        enabled: null,
        historyWindowDays: String(
          MAX_ANALYTICS_HISTORY_WINDOW_DAYS + 1,
        ),
        refreshIntervalHours: "12",
      }),
    ).toEqual({
      data: null,
      errors: {
        historyWindowDays:
          `History range must be a whole number from 1 through ${MAX_ANALYTICS_HISTORY_WINDOW_DAYS} or left blank.`,
      },
    });

    expect(
      validateAnalyticsSettings({
        enabled: "invalid",
        historyWindowDays: "",
        refreshIntervalHours: "12",
      }),
    ).toEqual({
      data: null,
      errors: {
        enabled: "Repository analytics must be on or off.",
      },
    });
  });
});
