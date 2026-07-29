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

  const cause =
    error instanceof AzureDevOpsError ? error.cause : error;
  const details = {
    cause:
      cause instanceof Error
        ? `${cause.name}: ${cause.message}`
        : cause === undefined
          ? null
          : String(cause),
    code,
    message:
      error instanceof Error
        ? error.message
        : "Unexpected Azure DevOps error.",
    retryAfterSeconds:
      error instanceof AzureDevOpsError ? error.retryAfterSeconds : null,
    status: error instanceof AzureDevOpsError ? error.status : null,
  };

  console.error("Azure DevOps request failed.", JSON.stringify(details));
}
