// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { AnalyticsSettingsForm } from "@/components/settings/analytics-settings-form";
import type { AnalyticsSettingsActionState } from "@/lib/analytics/settings-action-state";

describe("AnalyticsSettingsForm", () => {
  it("shows the saved values and supported ranges", () => {
    const action = vi.fn(
      async (): Promise<AnalyticsSettingsActionState> => ({
        errors: {},
        message: "",
        status: "idle",
      }),
    );

    render(
      <AnalyticsSettingsForm
        action={action}
        settings={{
          historyWindowDays: 365,
          refreshIntervalHours: 12,
        }}
      />,
    );

    expect(screen.getByLabelText("Refresh interval")).toHaveValue(12);
    expect(screen.getByLabelText("Refresh interval")).toHaveAttribute(
      "max",
      "168",
    );
    expect(screen.getByLabelText("History range")).toHaveValue(365);
    expect(
      screen.getByRole("button", { name: "Save settings" }),
    ).toBeEnabled();
  });
});
