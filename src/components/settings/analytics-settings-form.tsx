"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useActionState } from "react";
import {
  INITIAL_ANALYTICS_SETTINGS_ACTION_STATE,
  type AnalyticsSettingsActionState,
} from "@/lib/analytics/settings-action-state";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  MAX_ANALYTICS_HISTORY_WINDOW_DAYS,
  MAX_ANALYTICS_REFRESH_INTERVAL_HOURS,
  MIN_ANALYTICS_REFRESH_INTERVAL_HOURS,
  type AnalyticsSettings,
} from "@/lib/analytics/settings-schema";
import { cn } from "@/lib/utils";

type AnalyticsSettingsFormProps = {
  action: (
    previousState: AnalyticsSettingsActionState,
    formData: FormData,
  ) => Promise<AnalyticsSettingsActionState>;
  settings: AnalyticsSettings;
};

export function AnalyticsSettingsForm({
  action,
  settings,
}: AnalyticsSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_ANALYTICS_SETTINGS_ACTION_STATE,
  );

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <FieldSet>
        <FieldLegend>Analytics</FieldLegend>
        <FieldDescription>
          Control imported history and the repository refresh schedule.
        </FieldDescription>
        <FieldGroup>
          <Field
            data-invalid={Boolean(state.errors.refreshIntervalHours)}
          >
            <FieldLabel htmlFor="refreshIntervalHours">
              Refresh interval
            </FieldLabel>
            <Input
              aria-describedby="refreshIntervalHours-description"
              aria-invalid={Boolean(state.errors.refreshIntervalHours)}
              className="w-32"
              defaultValue={settings.refreshIntervalHours}
              disabled={pending}
              id="refreshIntervalHours"
              max={MAX_ANALYTICS_REFRESH_INTERVAL_HOURS}
              min={MIN_ANALYTICS_REFRESH_INTERVAL_HOURS}
              name="refreshIntervalHours"
              required
              step={1}
              type="number"
            />
            <FieldDescription id="refreshIntervalHours-description">
              Hours between completed repository refreshes. The new interval
              applies after each repository&apos;s next sync.
            </FieldDescription>
            <FieldError>
              {state.errors.refreshIntervalHours}
            </FieldError>
          </Field>

          <Field
            data-invalid={Boolean(state.errors.historyWindowDays)}
          >
            <FieldLabel htmlFor="historyWindowDays">
              History range
            </FieldLabel>
            <Input
              aria-describedby="historyWindowDays-description"
              aria-invalid={Boolean(state.errors.historyWindowDays)}
              className="w-32"
              defaultValue={settings.historyWindowDays ?? ""}
              disabled={pending}
              id="historyWindowDays"
              max={MAX_ANALYTICS_HISTORY_WINDOW_DAYS}
              min={1}
              name="historyWindowDays"
              placeholder="All"
              step={1}
              type="number"
            />
            <FieldDescription id="historyWindowDays-description">
              Days of completed pull-request history to import. Leave blank
              for all history.
            </FieldDescription>
            <FieldError>
              {state.errors.historyWindowDays}
            </FieldError>
          </Field>
        </FieldGroup>
      </FieldSet>

      <div className="flex items-center gap-3">
        <Button disabled={pending} type="submit">
          {pending ? (
            <LoaderCircleIcon
              className="animate-spin"
              data-icon="inline-start"
            />
          ) : null}
          Save settings
        </Button>
        {state.message ? (
          <p
            aria-live="polite"
            className={cn(
              "text-sm",
              state.status === "error"
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
