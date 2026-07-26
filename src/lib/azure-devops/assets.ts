import {
  getAzureDevOpsConfig,
  getAzureDevOpsOrganizationName,
} from "@/lib/azure-devops/config";

const AZURE_DEVOPS_ALLOWED_ASSET_HOSTS = new Set([
  "aex.dev.azure.com",
  "dev.azure.com",
  "vssps.dev.azure.com",
]);

/**
 * Raised when a source is not an asset this organization will fetch, as opposed
 * to Azure DevOps failing to return one. The two are different answers: the
 * first is a bad request, the second an upstream fault.
 */
export class AzureDevOpsAssetError extends Error {}

export function buildAzureDevOpsAssetProxyPath(source: string) {
  return `/api/azure-devops/asset?src=${encodeURIComponent(source)}`;
}

/**
 * Only the shared `dev.azure.com` hosts, which the proxy accepts whatever
 * organization is configured.
 *
 * A `visualstudio.com` host is somebody's organization, and which one cannot be
 * told apart from the host alone. Claiming all of them sends another
 * organization's image to a proxy that will refuse it, breaking an image that
 * would otherwise have loaded; claiming none leaves an attachment on the
 * configured organization's own legacy host unproxied, which is how it behaved
 * before the proxy existed. The second is the safer failure, so those hosts are
 * left exactly as authored.
 */
const AZURE_DEVOPS_ASSET_HOST_PATTERN = /(^|\.)dev\.azure\.com$/i;

/**
 * An attachment written without a host, resolved against the organization by
 * the proxy. Only API paths qualify: a plain relative image is a page asset and
 * proxying it would break images that load today.
 */
function isAzureDevOpsAssetPath(source: string) {
  if (!source.startsWith("/") || source.startsWith("//")) {
    return false;
  }

  return /(?:^|\/)_apis\//i.test(source.split(/[?#]/)[0] ?? "");
}

/**
 * Attachments embedded in descriptions and comments are protected by the same
 * authentication as the API, so a browser requesting them directly is
 * redirected to sign-in and the image breaks. They have to go through the asset
 * proxy instead.
 *
 * The organization URL is server-only, so this recognizes Azure DevOps assets
 * by shape rather than by configuration, and is deliberately the looser of the
 * two checks: it decides only whether to hand a source to the proxy, which
 * resolves it against the organization and is the one that decides whether it
 * will be fetched. Anything unrecognized is left alone, because proxying an
 * unrelated host would break images that load today.
 */
export function isProxyableAzureDevOpsAssetUrl(source: string) {
  if (isAzureDevOpsAssetPath(source)) {
    return true;
  }

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

/**
 * Hosts this organization's attachments can live on.
 *
 * The organization's own legacy `visualstudio.com` host is included so that
 * attachments written before the move to `dev.azure.com` still resolve. Every
 * other `visualstudio.com` host belongs to somebody else's organization and is
 * left out, because the proxy attaches this organization's token to whatever it
 * fetches.
 */
function getAllowedAssetHosts(orgUrl: string) {
  const hosts = new Set(AZURE_DEVOPS_ALLOWED_ASSET_HOSTS);

  hosts.add(new URL(orgUrl).host);

  try {
    hosts.add(`${getAzureDevOpsOrganizationName()}.visualstudio.com`);
  } catch {
    // An organization name that cannot be parsed only costs the legacy host.
  }

  return hosts;
}

/**
 * Azure DevOps writes attachments as absolute URLs, but a source without a host
 * belongs to the organization and has to be joined onto it. `new URL(source,
 * orgUrl)` cannot do this: a root-relative path replaces the base's path, so
 * `/_apis/…` against `https://dev.azure.com/org` drops the organization and
 * silently resolves to a URL that will never hold the attachment.
 */
function buildAssetUrl(source: string, orgUrl: string) {
  const base = new URL(orgUrl);

  if (source.startsWith("//")) {
    return new URL(source, base.origin);
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(source)) {
    return new URL(source);
  }

  const organizationPath = base.pathname.replace(/\/+$/, "");
  const path = source.startsWith("/") ? source : `/${source}`;

  return new URL(`${organizationPath}${path}`, base.origin);
}

export function resolveAzureDevOpsAssetUrl(source: string) {
  const config = getAzureDevOpsConfig();
  let url: URL;

  try {
    url = buildAssetUrl(source, config.orgUrl);
  } catch {
    throw new AzureDevOpsAssetError("Azure DevOps asset URL is malformed.");
  }

  if (url.protocol !== "https:") {
    throw new AzureDevOpsAssetError("Azure DevOps asset URL must use HTTPS.");
  }

  if (!getAllowedAssetHosts(config.orgUrl).has(url.host)) {
    throw new AzureDevOpsAssetError(
      "Azure DevOps asset URL host is not allowed.",
    );
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
