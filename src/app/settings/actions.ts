"use server";

import { revalidatePath } from "next/cache";
import { saveAnalyticsSettings } from "@/lib/analytics/settings";
import type { AnalyticsSettingsActionState } from "@/lib/analytics/settings-action-state";
import { validateAnalyticsSettings } from "@/lib/analytics/settings-schema";

export async function updateAnalyticsSettings(
  _previousState: AnalyticsSettingsActionState,
  formData: FormData,
): Promise<AnalyticsSettingsActionState> {
  const result = validateAnalyticsSettings({
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
    saveAnalyticsSettings(result.data);
    revalidatePath("/settings");

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
