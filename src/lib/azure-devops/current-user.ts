import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { azureDevOpsRequest } from "@/lib/azure-devops/client";
import { listAssignableUsers } from "@/lib/azure-devops/tasks";

type AzureDevOpsProfileResponse = {
  displayName?: string;
  emailAddress?: string;
};

export type AzureDevOpsCurrentUser = {
  avatarUrl: string | null;
  email: string | null;
  name: string;
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function loadCurrentAzureDevOpsUser() {
  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const response = await azureDevOpsRequest<AzureDevOpsProfileResponse>(
      "/_apis/profile/profiles/me?api-version=7.1",
      {
        accessToken,
        baseUrl: "https://app.vssps.visualstudio.com",
      },
    );

    const email = readString(response.emailAddress);
    const profileName = readString(response.displayName);
    const identityQuery = email ?? profileName;
    const matchedUser = identityQuery
      ? (await listAssignableUsers(accessToken, identityQuery))[0] ?? null
      : null;
    const name = profileName ?? matchedUser?.name ?? email ?? "Azure DevOps user";

    return {
      avatarUrl: matchedUser?.avatarUrl ?? null,
      email,
      name,
    } satisfies AzureDevOpsCurrentUser;
  } catch {
    return null;
  }
}
