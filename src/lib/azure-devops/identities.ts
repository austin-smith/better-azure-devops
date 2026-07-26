import {
  AZURE_DEVOPS_METADATA_REVALIDATE_SECONDS,
  getAzureDevOpsMetadataCacheTags,
} from "@/lib/azure-devops/cache-scope";
import { azureDevOpsRequest } from "@/lib/azure-devops/client";
import { getAzureDevOpsOrganizationName } from "@/lib/azure-devops/config";
import { isRecord, readArray, readString } from "@/lib/azure-devops/git/parsers";

const MAX_IDENTITY_IDS_PER_REQUEST = 100;

function getIdentitiesBaseUrl() {
  return `https://vssps.dev.azure.com/${encodeURIComponent(
    getAzureDevOpsOrganizationName(),
  )}`;
}

/**
 * Groups and teams the identity belongs to, as the same ids reviewers carry.
 *
 * A pull request assigned to a team lists the team as the reviewer and does not
 * list its members, and `searchCriteria.reviewerId` matches only the reviewer
 * named on the pull request. Recognizing a review assigned to a person through
 * a team therefore needs the memberships, which the identity itself does not
 * carry: it exposes them as descriptors that have to be resolved separately.
 */
export async function getAzureDevOpsIdentityGroupIds(
  accessToken: string,
  identityId: string,
) {
  const normalizedId = identityId.trim().toLowerCase();

  if (!normalizedId) {
    return [] as string[];
  }

  const baseUrl = getIdentitiesBaseUrl();
  const membershipParams = new URLSearchParams({
    "api-version": "7.1-preview.1",
    identityIds: normalizedId,
    queryMembership: "Expanded",
  });
  const membershipResponse = await azureDevOpsRequest<unknown>(
    `/_apis/identities?${membershipParams}`,
    {
      accessToken,
      baseUrl,
      cache: "force-cache",
      next: {
        revalidate: AZURE_DEVOPS_METADATA_REVALIDATE_SECONDS,
        tags: getAzureDevOpsMetadataCacheTags(
          accessToken,
          `identity-memberships:${normalizedId}`,
        ),
      },
    },
  );

  if (!isRecord(membershipResponse)) {
    return [] as string[];
  }

  const descriptors = readArray(membershipResponse.value)
    .flatMap((identity) => (isRecord(identity) ? readArray(identity.memberOf) : []))
    .map((descriptor) => readString(descriptor))
    .filter((descriptor): descriptor is string => Boolean(descriptor));

  if (descriptors.length === 0) {
    return [] as string[];
  }

  const groupParams = new URLSearchParams({
    "api-version": "7.1-preview.1",
    descriptors: descriptors.slice(0, MAX_IDENTITY_IDS_PER_REQUEST).join(","),
    queryMembership: "None",
  });
  const groupResponse = await azureDevOpsRequest<unknown>(
    `/_apis/identities?${groupParams}`,
    {
      accessToken,
      baseUrl,
      cache: "force-cache",
      next: {
        revalidate: AZURE_DEVOPS_METADATA_REVALIDATE_SECONDS,
        tags: getAzureDevOpsMetadataCacheTags(
          accessToken,
          `identity-groups:${normalizedId}`,
        ),
      },
    },
  );

  if (!isRecord(groupResponse)) {
    return [] as string[];
  }

  // A descriptor that cannot be resolved comes back as a null entry.
  return [
    ...new Set(
      readArray(groupResponse.value)
        .map((group) => (isRecord(group) ? readString(group.id) : null))
        .filter((id): id is string => Boolean(id))
        .map((id) => id.toLowerCase()),
    ),
  ];
}

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
