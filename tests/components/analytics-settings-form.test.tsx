// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
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
          enabled: true,
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
    expect(
      screen.getByRole("switch", { name: "Repository analytics" }),
    ).toBeChecked();
    expect(
      screen.queryByText("Enable repository analytics"),
    ).not.toBeInTheDocument();
  });

  it("hides schedule controls until analytics is enabled", () => {
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
          enabled: false,
          historyWindowDays: null,
          refreshIntervalHours: 6,
        }}
      />,
    );

    const toggle = screen.getByRole("switch", {
      name: "Repository analytics",
    });

    expect(screen.getByLabelText("Refresh interval")).not.toBeVisible();
    expect(screen.getByLabelText("History range")).not.toBeVisible();

    fireEvent.click(toggle);

    expect(screen.getByLabelText("Refresh interval")).toBeVisible();
    expect(screen.getByLabelText("History range")).toBeVisible();
  });
});
