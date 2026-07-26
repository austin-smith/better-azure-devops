import { AzureDevOpsError } from "@/lib/azure-devops/errors";

export function reportAzureDevOpsError(error: unknown) {
  const code =
    error instanceof AzureDevOpsError ? error.code : ("unknown" as const);

  if (
    code !== "create_status_unknown" &&
    code !== "network" &&
    code !== "server" &&
    code !== "unknown"
  ) {
    return;
  }

  console.error("Azure DevOps request failed.", {
    cause: error instanceof AzureDevOpsError ? error.cause : error,
    code,
    message:
      error instanceof Error
        ? error.message
        : "Unexpected Azure DevOps error.",
    retryAfterSeconds:
      error instanceof AzureDevOpsError ? error.retryAfterSeconds : null,
    status: error instanceof AzureDevOpsError ? error.status : null,
  });
}
