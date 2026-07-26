import { azureDevOpsRequest } from "@/lib/azure-devops/client";
import { getGitRepositoryApiPath } from "@/lib/azure-devops/git/api-path";
import {
  parseRepository,
  parseRepositoryList,
} from "@/lib/azure-devops/git/parsers";

export async function listRepositories(
  accessToken: string,
  projectId: string,
) {
  const path = getGitRepositoryApiPath(projectId);
  const searchParams = new URLSearchParams({
    includeAllUrls: "true",
    includeHidden: "true",
  });
  const response = await azureDevOpsRequest<unknown>(
    `${path}?${searchParams}`,
    { accessToken },
  );

  return parseRepositoryList(response).sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

export async function getRepository(
  accessToken: string,
  projectId: string,
  repositoryId: string,
) {
  const response = await azureDevOpsRequest<unknown>(
    getGitRepositoryApiPath(projectId, repositoryId),
    { accessToken },
  );

  return parseRepository(response);
}
