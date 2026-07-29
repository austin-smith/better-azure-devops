"use server";

import { revalidatePath } from "next/cache";
import {
  loadAnalyticsSettings,
  saveAnalyticsSettings,
} from "@/lib/analytics/settings";
import { requestRepositoryCatalogRefresh } from "@/lib/analytics/scheduler";
import type { AnalyticsSettingsActionState } from "@/lib/analytics/settings-action-state";
import { validateAnalyticsSettings } from "@/lib/analytics/settings-schema";

export async function updateAnalyticsSettings(
  _previousState: AnalyticsSettingsActionState,
  formData: FormData,
): Promise<AnalyticsSettingsActionState> {
  const result = validateAnalyticsSettings({
    enabled: formData.get("enabled"),
    historyWindowDays: formData.get("historyWindowDays"),
    refreshIntervalHours: formData.get("refreshIntervalHours"),
  });

  if (!result.data) {
    return {
      errors: result.errors,
      message: "Check the highlighted settings.",
      status: "error",
    };
  }

  try {
    const previousSettings = loadAnalyticsSettings();

    saveAnalyticsSettings(result.data);

    if (result.data.enabled && !previousSettings.enabled) {
      requestRepositoryCatalogRefresh();
    }

    revalidatePath("/", "layout");

    return {
      errors: {},
      message: "Analytics settings saved.",
      status: "success",
    };
  } catch {
    return {
      errors: {},
      message: "Analytics settings could not be saved.",
      status: "error",
    };
  }
}
