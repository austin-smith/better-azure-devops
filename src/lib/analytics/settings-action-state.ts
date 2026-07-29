import type { AnalyticsSettingsFieldErrors } from "@/lib/analytics/settings-schema";

export type AnalyticsSettingsActionState = {
  errors: AnalyticsSettingsFieldErrors;
  message: string;
  status: "idle" | "error" | "success";
};

export const INITIAL_ANALYTICS_SETTINGS_ACTION_STATE:
  AnalyticsSettingsActionState = {
    errors: {},
    message: "",
    status: "idle",
  };
