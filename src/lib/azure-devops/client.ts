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
};

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

export async function azureDevOpsFetch(
  path: string,
  options: AzureDevOpsRequestOptions,
) {
  const url = createAzureDevOpsUrl(path, options);
  let response: Response;

  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: getRequestHeaders(options),
      body: options.body,
      cache: options.cache ?? "no-store",
      next: options.next,
      signal: options.signal,
    });
  } catch (error) {
    throw new AzureDevOpsError(
      `Azure DevOps request could not reach ${url.origin}.`,
      {
        cause: error,
        code: "network",
      },
    );
  }

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

  return response;
}

export async function azureDevOpsRequest<T>(
  path: string,
  options: AzureDevOpsRequestOptions,
) {
  const response = await azureDevOpsFetch(path, options);

  return (await response.json()) as T;
}
