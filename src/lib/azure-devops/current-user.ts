import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import {
  AZURE_DEVOPS_METADATA_REVALIDATE_SECONDS,
  getAzureDevOpsMetadataCacheTags,
} from "@/lib/azure-devops/cache-scope";
import { azureDevOpsRequest } from "@/lib/azure-devops/client";
import { listAssignableUsers } from "@/lib/azure-devops/tasks";

type AzureDevOpsProfileResponse = {
  displayName?: string;
  emailAddress?: string;
};

export type AzureDevOpsCurrentUser = {
  avatarUrl: string | null;
  email: string | null;
  id: string | null;
  name: string;
};

type AzureDevOpsConnectionDataResponse = {
  authenticatedUser?: {
    id?: string;
  };
};

export async function getCurrentAzureDevOpsIdentityId(
  accessToken: string,
) {
  const connectionData =
    await azureDevOpsRequest<AzureDevOpsConnectionDataResponse>(
      "/_apis/connectionData?connectOptions=1&lastChangeId=-1&lastChangeId64=-1&api-version=7.1-preview.1",
      {
        accessToken,
        cache: "force-cache",
        next: {
          revalidate: AZURE_DEVOPS_METADATA_REVALIDATE_SECONDS,
          tags: getAzureDevOpsMetadataCacheTags(
            accessToken,
            "current-user-identity",
          ),
        },
      },
    );

  return readString(connectionData.authenticatedUser?.id);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function loadCurrentAzureDevOpsUser() {
  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const [response, identityId] = await Promise.all([
      azureDevOpsRequest<AzureDevOpsProfileResponse>(
        "/_apis/profile/profiles/me?api-version=7.1",
        {
          accessToken,
          baseUrl: "https://app.vssps.visualstudio.com",
          cache: "force-cache",
          next: {
            revalidate: AZURE_DEVOPS_METADATA_REVALIDATE_SECONDS,
            tags: getAzureDevOpsMetadataCacheTags(accessToken, "current-user"),
          },
        },
      ),
      getCurrentAzureDevOpsIdentityId(accessToken).catch(() => null),
    ]);

    const email = readString(response.emailAddress);
    const profileName = readString(response.displayName);
    const identityQuery = email ?? profileName;
    const matchedUser = identityQuery
      ? (await listAssignableUsers(accessToken, identityQuery).catch(() => []))[0] ??
        null
      : null;
    const name = profileName ?? matchedUser?.name ?? email ?? "Azure DevOps user";

    return {
      avatarUrl: matchedUser?.avatarUrl ?? null,
      email,
      id: identityId,
      name,
    } satisfies AzureDevOpsCurrentUser;
  } catch {
    return null;
  }
}
