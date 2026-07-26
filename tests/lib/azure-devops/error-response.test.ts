import { createAzureDevOpsErrorResponse } from "@/lib/azure-devops/error-response";
import { AzureDevOpsError } from "@/lib/azure-devops/errors";

describe("Azure DevOps error responses", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs private upstream diagnostics before returning a safe response", async () => {
    const cause = new Error("socket closed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new AzureDevOpsError(
      "Azure DevOps returned private upstream details.",
      {
        cause,
        code: "server",
        status: 503,
      },
    );

    const response = createAzureDevOpsErrorResponse(error);

    expect(consoleError).toHaveBeenCalledWith(
      "Azure DevOps request failed.",
      {
        cause,
        code: "server",
        message: "Azure DevOps returned private upstream details.",
        retryAfterSeconds: null,
        status: 503,
      },
    );
    await expect(response.json()).resolves.toMatchObject({
      errorDetails: {
        code: "server",
        message:
          "Azure DevOps returned a server error. The service may be temporarily unavailable.",
      },
    });
  });

  it("does not log expected access failures", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    createAzureDevOpsErrorResponse(
      new AzureDevOpsError("Access denied.", {
        code: "permission_denied",
        status: 403,
      }),
    );

    expect(consoleError).not.toHaveBeenCalled();
  });
});
