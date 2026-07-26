import { NextResponse } from "next/server";
import {
  getAzureDevOpsErrorHttpStatus,
  getPublicAzureDevOpsError,
} from "@/lib/azure-devops/errors";
import { reportAzureDevOpsError } from "@/lib/azure-devops/report-error";

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
