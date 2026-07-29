export const DEFAULT_ANALYTICS_REFRESH_INTERVAL_HOURS = 6;
export const MAX_ANALYTICS_HISTORY_WINDOW_DAYS = 36_500;
export const MIN_ANALYTICS_REFRESH_INTERVAL_HOURS = 1;
export const MAX_ANALYTICS_REFRESH_INTERVAL_HOURS = 168;

export type AnalyticsSettings = {
  enabled: boolean;
  historyWindowDays: number | null;
  refreshIntervalHours: number;
};

export type AnalyticsSettingsFieldErrors = Partial<
  Record<keyof AnalyticsSettings, string>
>;

type AnalyticsSettingsInput = {
  enabled: FormDataEntryValue | null;
  historyWindowDays: FormDataEntryValue | null;
  refreshIntervalHours: FormDataEntryValue | null;
};

export type AnalyticsSettingsValidationResult =
  | {
      data: AnalyticsSettings;
      errors: null;
    }
  | {
      data: null;
      errors: AnalyticsSettingsFieldErrors;
    };

function parseInputInteger(
  value: FormDataEntryValue | null,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (typeof value !== "string" || value.trim() === "") {
    return { error: `${label} is required.`, value: null } as const;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    return {
      error: `${label} must be a whole number from ${minimum} through ${maximum}.`,
      value: null,
    } as const;
  }

  return { error: null, value: parsed } as const;
}

function parseOptionalPositiveInteger(
  value: FormDataEntryValue | null,
  label: string,
  maximum: number,
) {
  if (typeof value !== "string" || value.trim() === "") {
    return { error: null, value: null } as const;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > maximum
  ) {
    return {
      error: `${label} must be a whole number from 1 through ${maximum} or left blank.`,
      value: null,
    } as const;
  }

  return { error: null, value: parsed } as const;
}

function parseEnabled(value: FormDataEntryValue | null) {
  if (value === null) {
    return { error: null, value: false } as const;
  }

  if (value === "on") {
    return { error: null, value: true } as const;
  }

  return {
    error: "Repository analytics must be on or off.",
    value: null,
  } as const;
}

export function validateAnalyticsSettings(
  input: AnalyticsSettingsInput,
): AnalyticsSettingsValidationResult {
  const enabled = parseEnabled(input.enabled);
  const refreshIntervalHours = parseInputInteger(
    input.refreshIntervalHours,
    "Refresh interval",
    MIN_ANALYTICS_REFRESH_INTERVAL_HOURS,
    MAX_ANALYTICS_REFRESH_INTERVAL_HOURS,
  );
  const historyWindowDays = parseOptionalPositiveInteger(
    input.historyWindowDays,
    "History range",
    MAX_ANALYTICS_HISTORY_WINDOW_DAYS,
  );
  const errors: AnalyticsSettingsFieldErrors = {};

  if (enabled.error) {
    errors.enabled = enabled.error;
  }

  if (refreshIntervalHours.error) {
    errors.refreshIntervalHours = refreshIntervalHours.error;
  }

  if (historyWindowDays.error) {
    errors.historyWindowDays = historyWindowDays.error;
  }

  if (
    enabled.value === null ||
    refreshIntervalHours.value === null ||
    historyWindowDays.error
  ) {
    return { data: null, errors };
  }

  return {
    data: {
      enabled: enabled.value,
      historyWindowDays: historyWindowDays.value,
      refreshIntervalHours: refreshIntervalHours.value,
    },
    errors: null,
  };
}
