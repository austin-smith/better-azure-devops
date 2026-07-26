import { createHash } from "node:crypto";
import { getAzureDevOpsConfig } from "@/lib/azure-devops/config";

type AccessTokenClaims = {
  oid?: unknown;
  sub?: unknown;
  tid?: unknown;
};

export const AZURE_DEVOPS_METADATA_REVALIDATE_SECONDS = 300;

function hashScope(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

function readAccessTokenIdentity(accessToken: string) {
  const payload = accessToken.split(".")[1];

  if (payload) {
    try {
      const claims = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      ) as AccessTokenClaims;
      const tenantId = typeof claims.tid === "string" ? claims.tid : "";
      const userId =
        typeof claims.oid === "string"
          ? claims.oid
          : typeof claims.sub === "string"
            ? claims.sub
            : "";

      if (tenantId || userId) {
        return `${tenantId}:${userId}`;
      }
    } catch {
      // A token fingerprint still isolates opaque or non-JWT credentials.
    }
  }

  return hashScope(accessToken);
}

export function getAzureDevOpsMetadataCacheTags(
  accessToken: string,
  resource: string,
  projectId?: string,
) {
  const { orgUrl } = getAzureDevOpsConfig();
  const userScope = hashScope(
    `${orgUrl}:${readAccessTokenIdentity(accessToken)}`,
  );
  const resourceTag = `ado-metadata:${userScope}:${hashScope(resource)}`;

  if (!projectId) {
    return [resourceTag];
  }

  return [
    resourceTag,
    `ado-metadata:${userScope}:project:${hashScope(projectId)}`,
  ];
}
