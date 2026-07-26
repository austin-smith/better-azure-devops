import { getAzureDevOpsConfig } from "@/lib/azure-devops/config";

const AZURE_DEVOPS_ALLOWED_ASSET_HOSTS = new Set([
  "aex.dev.azure.com",
  "dev.azure.com",
  "vssps.dev.azure.com",
]);

export function buildAzureDevOpsAssetProxyPath(source: string) {
  return `/api/azure-devops/asset?src=${encodeURIComponent(source)}`;
}

const AZURE_DEVOPS_ASSET_HOST_PATTERN =
  /(^|\.)(dev\.azure\.com|visualstudio\.com)$/i;

/**
 * Attachments embedded in descriptions and comments are protected by the same
 * authentication as the API, so a browser requesting them directly is
 * redirected to sign-in and the image breaks. They have to go through the asset
 * proxy instead.
 *
 * The organization URL is server-only, so this recognizes Azure DevOps hosts by
 * shape rather than by configuration. Anything unrecognized is deliberately
 * left alone: proxying an unrelated host would break images that load today.
 */
export function isProxyableAzureDevOpsAssetUrl(source: string) {
  try {
    const url = new URL(source);

    return (
      url.protocol === "https:" &&
      AZURE_DEVOPS_ASSET_HOST_PATTERN.test(url.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Pull request and push identities expose this same avatar href, so resolving
 * commit authors to it keeps one person's avatar identical across every view.
 */
export function buildAzureDevOpsMemberAvatarUrl(descriptor: string) {
  const { orgUrl } = getAzureDevOpsConfig();

  return `${orgUrl}/_apis/GraphProfile/MemberAvatars/${encodeURIComponent(descriptor)}`;
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
