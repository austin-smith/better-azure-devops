import { getAzureDevOpsConfig } from "@/lib/azure-devops/config";

type AzureDevOpsRequestOptions = {
  accessToken: string;
  baseUrl?: string;
  body?: BodyInit;
  cache?: RequestCache;
  contentType?: string;
  method?: "GET" | "PATCH" | "POST";
  next?: {
    revalidate?: number;
    tags?: string[];
  };
  projectName?: string | null;
};

export async function azureDevOpsRequest<T>(
  path: string,
  options: AzureDevOpsRequestOptions,
) {
  const config = getAzureDevOpsConfig();
  const requestPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl =
    options.baseUrl ??
    (options.projectName ? `${config.orgUrl}/${options.projectName}` : config.orgUrl);
  const url = new URL(`${baseUrl}${requestPath}`);

  if (!url.searchParams.has("api-version")) {
    url.searchParams.set("api-version", config.apiVersion);
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${options.accessToken}`,
      ...(options.body
        ? {
            "Content-Type": options.contentType ?? "application/json",
          }
        : {}),
    },
    body: options.body,
    cache: options.cache ?? "no-store",
    next: options.next,
  });

  if (!response.ok) {
    const details = await response.text();

    throw new Error(
      `Azure DevOps request failed (${response.status} ${response.statusText}): ${details || "No response body."}`,
    );
  }

  return (await response.json()) as T;
}
