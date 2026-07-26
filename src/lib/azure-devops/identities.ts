import {
  AZURE_DEVOPS_METADATA_REVALIDATE_SECONDS,
  getAzureDevOpsMetadataCacheTags,
} from "@/lib/azure-devops/cache-scope";
import { azureDevOpsRequest } from "@/lib/azure-devops/client";
import { getAzureDevOpsOrganizationName } from "@/lib/azure-devops/config";
import { isRecord, readArray, readString } from "@/lib/azure-devops/git/parsers";

const MAX_IDENTITY_IDS_PER_REQUEST = 100;

export async function getAzureDevOpsIdentityLabels(
  accessToken: string,
  identityIds: readonly string[],
) {
  const normalizedIds = [
    ...new Set(
      identityIds
        .map((identityId) => identityId.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, MAX_IDENTITY_IDS_PER_REQUEST);

  if (normalizedIds.length === 0) {
    return new Map<string, string>();
  }

  const organization = getAzureDevOpsOrganizationName();
  const searchParams = new URLSearchParams({
    "api-version": "7.1-preview.1",
    identityIds: normalizedIds.join(","),
    queryMembership: "None",
  });
  const response = await azureDevOpsRequest<unknown>(
    `/_apis/identities?${searchParams}`,
    {
      accessToken,
      baseUrl: `https://vssps.dev.azure.com/${encodeURIComponent(organization)}`,
      cache: "force-cache",
      next: {
        revalidate: AZURE_DEVOPS_METADATA_REVALIDATE_SECONDS,
        tags: getAzureDevOpsMetadataCacheTags(
          accessToken,
          `identities:${normalizedIds.join(",")}`,
        ),
      },
    },
  );
  const labels = new Map<string, string>();

  if (!isRecord(response)) {
    return labels;
  }

  for (const identity of readArray(response.value)) {
    if (!isRecord(identity)) {
      continue;
    }

    const id = readString(identity.id)?.toLowerCase();
    const label =
      readString(identity.customDisplayName) ??
      readString(identity.providerDisplayName) ??
      readString(identity.displayName);

    if (id && label) {
      labels.set(id, label);
    }
  }

  return labels;
}
