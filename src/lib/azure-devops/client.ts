import { getAzureDevOpsConfig } from "@/lib/azure-devops/config";
import {
  AzureDevOpsError,
  type AzureDevOpsErrorCode,
} from "@/lib/azure-devops/errors";

export type AzureDevOpsRequestOptions = {
  accessToken: string;
  accept?: string;
  baseUrl?: string;
  body?: BodyInit;
  cache?: RequestCache;
  contentType?: string;
  headers?: HeadersInit;
  method?: "DELETE" | "GET" | "HEAD" | "PATCH" | "POST" | "PUT";
  next?: {
    revalidate?: number;
    tags?: string[];
  };
  projectName?: string | null;
  revisionConflictOnBadRequest?: boolean;
  signal?: AbortSignal;
  timeoutMilliseconds?: number;
};

export const DEFAULT_AZURE_DEVOPS_REQUEST_TIMEOUT_MILLISECONDS = 60_000;

function readAzureDevOpsErrorMessage(details: string) {
  try {
    const payload = JSON.parse(details) as unknown;

    if (
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
    ) {
      return payload.message;
    }
  } catch {
    // Azure DevOps can also return plain-text error bodies.
  }

  return details;
}

function isRevisionConflictResponse(
  status: number,
  details: string,
  revisionConflictOnBadRequest: boolean,
) {
  if (status === 412) {
    return true;
  }

  if (status !== 400 || !revisionConflictOnBadRequest) {
    return false;
  }

  return /\brev(?:ision)?\b/i.test(readAzureDevOpsErrorMessage(details));
}

function getResponseErrorCode(
  status: number,
  details: string,
  revisionConflictOnBadRequest: boolean,
): AzureDevOpsErrorCode {
  if (
    isRevisionConflictResponse(
      status,
      details,
      revisionConflictOnBadRequest,
    )
  ) {
    return "revision_conflict";
  }

  switch (status) {
    case 401:
      return "authentication_required";
    case 403:
      return "permission_denied";
    case 404:
      return "not_found";
    case 429:
      return "throttled";
    default:
      return status >= 500 ? "server" : "unknown";
  }
}

function parseRetryAfterSeconds(value: string | null) {
  if (!value) {
    return null;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds);
  }

  const retryAt = Date.parse(value);

  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
}

function createAzureDevOpsUrl(
  path: string,
  options: AzureDevOpsRequestOptions,
) {
  const config = getAzureDevOpsConfig();
  const requestPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl =
    options.baseUrl ??
    (options.projectName
      ? `${config.orgUrl}/${options.projectName}`
      : config.orgUrl);
  const url = new URL(`${baseUrl}${requestPath}`);

  if (!url.searchParams.has("api-version")) {
    url.searchParams.set("api-version", config.apiVersion);
  }

  return url;
}

function getRequestHeaders(options: AzureDevOpsRequestOptions) {
  const headers: Record<string, string> = {
    Accept: options.accept ?? "application/json",
    Authorization: `Bearer ${options.accessToken}`,
  };

  new Headers(options.headers).forEach((value, key) => {
    headers[key] = value;
  });

  if (
    options.body &&
    !Object.keys(headers).some(
      (key) => key.toLowerCase() === "content-type",
    )
  ) {
    headers["Content-Type"] = options.contentType ?? "application/json";
  }

  return headers;
}

function createRequestDeadline(options: AzureDevOpsRequestOptions) {
  const timeoutMilliseconds =
    options.timeoutMilliseconds ??
    DEFAULT_AZURE_DEVOPS_REQUEST_TIMEOUT_MILLISECONDS;
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => {
    timeoutController.abort(
      new DOMException(
        "The Azure DevOps request timed out.",
        "TimeoutError",
      ),
    );
  }, timeoutMilliseconds);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;

  return {
    clear: () => clearTimeout(timeout),
    signal,
    timedOut: () =>
      timeoutController.signal.aborted && !options.signal?.aborted,
    timeoutMilliseconds,
  };
}

async function performAzureDevOpsRequest<T>(
  path: string,
  options: AzureDevOpsRequestOptions,
  readResponse: (response: Response) => T | Promise<T>,
) {
  const url = createAzureDevOpsUrl(path, options);
  const deadline = createRequestDeadline(options);
  let receivedResponse = false;

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: getRequestHeaders(options),
      body: options.body,
      cache: options.cache ?? "no-store",
      next: options.next,
      signal: deadline.signal,
    });
    receivedResponse = true;

    if (!response.ok) {
      const details = (await response.text()).trim();

      throw new AzureDevOpsError(
        `Azure DevOps request failed (${response.status} ${response.statusText}): ${details || "No response body."}`,
        {
          code: getResponseErrorCode(
            response.status,
            details,
            options.revisionConflictOnBadRequest ?? false,
          ),
          correlationId:
            response.headers.get("x-vss-e2eid") ??
            response.headers.get("x-tfs-session"),
          retryAfterSeconds: parseRetryAfterSeconds(
            response.headers.get("retry-after"),
          ),
          status: response.status,
        },
      );
    }

    return await readResponse(response);
  } catch (error) {
    if (error instanceof AzureDevOpsError) {
      throw error;
    }

    if (deadline.timedOut()) {
      throw new AzureDevOpsError(
        receivedResponse
          ? `Azure DevOps did not finish sending the response within ${Math.ceil(deadline.timeoutMilliseconds / 1_000)} seconds.`
          : `Azure DevOps did not respond within ${Math.ceil(deadline.timeoutMilliseconds / 1_000)} seconds.`,
        {
          cause: error,
          code: "network",
        },
      );
    }

    if (options.signal?.aborted) {
      throw new AzureDevOpsError(
        "Azure DevOps request was cancelled.",
        {
          cause: error,
          code: "network",
        },
      );
    }

    if (!receivedResponse || error instanceof TypeError) {
      throw new AzureDevOpsError(
        receivedResponse
          ? "Azure DevOps stopped sending the response."
          : `Azure DevOps request could not reach ${url.origin}.`,
        {
          cause: error,
          code: "network",
        },
      );
    }

    throw error;
  } finally {
    deadline.clear();
  }
}

export function readAzureDevOpsResponse<T>(
  path: string,
  options: AzureDevOpsRequestOptions,
  readResponse: (response: Response) => T | Promise<T>,
) {
  return performAzureDevOpsRequest(path, options, readResponse);
}

export function streamAzureDevOpsResponse(
  path: string,
  options: AzureDevOpsRequestOptions,
) {
  return performAzureDevOpsRequest(path, options, (response) => response);
}

export async function azureDevOpsRequest<T>(
  path: string,
  options: AzureDevOpsRequestOptions,
) {
  return readAzureDevOpsResponse(
    path,
    options,
    async (response) => (await response.json()) as T,
  );
}
