import { getAzureDevOpsConfig } from "@/lib/azure-devops/config";

const AZURE_DEVOPS_ALLOWED_ASSET_HOSTS = new Set([
  "aex.dev.azure.com",
  "dev.azure.com",
  "vssps.dev.azure.com",
]);

export function buildAzureDevOpsAssetProxyPath(source: string) {
  return `/api/azure-devops/asset?src=${encodeURIComponent(source)}`;
}

export function resolveAzureDevOpsAssetUrl(source: string) {
  const config = getAzureDevOpsConfig();
  const orgHost = new URL(config.orgUrl).host;
  const url = new URL(source, config.orgUrl);

  if (url.protocol !== "https:") {
    throw new Error("Azure DevOps asset URL must use HTTPS.");
  }

  if (url.host !== orgHost && !AZURE_DEVOPS_ALLOWED_ASSET_HOSTS.has(url.host)) {
    throw new Error("Azure DevOps asset URL host is not allowed.");
  }

  return url;
}

export function isAzureDevOpsAssetUrl(source: string) {
  try {
    resolveAzureDevOpsAssetUrl(source);
    return true;
  } catch {
    return false;
  }
}
