// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { AzureDevOpsFailure } from "@/components/azure-devops-failure";
import { createPublicAzureDevOpsError } from "@/lib/azure-devops/errors";

describe("AzureDevOpsFailure", () => {
  it("shows retry timing and invokes the supplied recovery action", () => {
    const onRetry = vi.fn();

    render(
      <AzureDevOpsFailure
        error={{
          ...createPublicAzureDevOpsError("throttled"),
          retryAfterSeconds: 18,
        }}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Try again in about 18 seconds.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows shell-specific Azure CLI recovery commands for expired authentication", () => {
    render(
      <AzureDevOpsFailure
        error={createPublicAzureDevOpsError("authentication_required")}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("macOS and Linux")).toBeVisible();
    expect(screen.getByText("AZURE_CONFIG_DIR=.azure az login")).toBeVisible();
    expect(screen.getByText("Windows PowerShell")).toBeVisible();
    expect(
      screen.getByText('$env:AZURE_CONFIG_DIR=".azure"; az login'),
    ).toBeVisible();
  });
});
