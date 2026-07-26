import {
  AzureDevOpsError,
  createPublicAzureDevOpsError,
  getAzureDevOpsErrorHttpStatus,
  getAzureDevOpsWorkItemCreateError,
  getPublicAzureDevOpsError,
} from "@/lib/azure-devops/errors";

describe("Azure DevOps errors", () => {
  it.each([
    ["authentication_required", 401, "Sign in to Azure"],
    ["permission_denied", 403, "Azure DevOps access denied"],
    ["not_found", 404, "Azure DevOps resource not found"],
    ["revision_conflict", 409, "This work item changed"],
    [
      "create_status_unknown",
      500,
      "Confirm the work item before retrying",
    ],
    ["throttled", 429, "Azure DevOps is busy"],
    ["network", 502, "Cannot reach Azure DevOps"],
    ["server", 503, "Azure DevOps is unavailable"],
  ] as const)("maps %s to safe public recovery details", (code, status, title) => {
    const error = new AzureDevOpsError("private diagnostic details", {
      code,
    });

    expect(getPublicAzureDevOpsError(error)).toMatchObject({
      code,
      title,
    });
    expect(getPublicAzureDevOpsError(error).message).not.toContain("private");
    expect(getAzureDevOpsErrorHttpStatus(error)).toBe(status);
  });

  it("preserves retry timing without exposing upstream response details", () => {
    const error = new AzureDevOpsError(
      "Azure DevOps request failed: secret upstream response",
      {
        code: "throttled",
        retryAfterSeconds: 30,
        status: 429,
      },
    );

    expect(getPublicAzureDevOpsError(error)).toMatchObject({
      code: "throttled",
      retryAfterSeconds: 30,
    });
    expect(getPublicAzureDevOpsError(error).message).not.toContain("secret");
  });

  it("provides actionable setup instructions for missing configuration", () => {
    expect(createPublicAzureDevOpsError("missing_config")).toMatchObject({
      canRetry: false,
      code: "missing_config",
      recoveryCommands: [
        {
          label: "Environment",
          value: "AZURE_DEVOPS_ORG_URL=https://dev.azure.com/<organization>",
        },
      ],
    });
  });

  it("marks only ambiguous create outcomes as uncertain", () => {
    const networkError = new AzureDevOpsError(
      "The create response was lost.",
      {
        code: "network",
      },
    );
    const validationError = new AzureDevOpsError(
      "Azure DevOps rejected the document.",
      {
        code: "unknown",
        status: 400,
      },
    );

    expect(
      getAzureDevOpsWorkItemCreateError(networkError),
    ).toMatchObject({
      cause: networkError,
      code: "create_status_unknown",
      status: null,
    });
    expect(
      getAzureDevOpsWorkItemCreateError(validationError),
    ).toBe(validationError);
  });
});
