import { NextResponse } from "next/server";
import {
  AzureDevOpsError,
  getAzureDevOpsErrorHttpStatus,
  getPublicAzureDevOpsError,
} from "@/lib/azure-devops/errors";

function reportAzureDevOpsError(error: unknown) {
  const code =
    error instanceof AzureDevOpsError ? error.code : ("unknown" as const);

  if (code !== "network" && code !== "server" && code !== "unknown") {
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

export function createAzureDevOpsErrorResponse(error: unknown) {
  reportAzureDevOpsError(error);

  const publicError = getPublicAzureDevOpsError(error);
  const headers =
    publicError.retryAfterSeconds === null
      ? undefined
      : { "Retry-After": String(publicError.retryAfterSeconds) };

  return NextResponse.json(
    {
      error: publicError.message,
      errorDetails: publicError,
    },
    {
      headers,
      status: getAzureDevOpsErrorHttpStatus(error),
    },
  );
}
