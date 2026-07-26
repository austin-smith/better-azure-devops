import {
  azureDevOpsFetch,
  azureDevOpsRequest,
} from "@/lib/azure-devops/client";
import { getGitRepositoryApiPath } from "@/lib/azure-devops/git/api-path";
import {
  parseGitItemList,
  parseGitItemResponse,
} from "@/lib/azure-devops/git/parsers";
import type { GitVersionDescriptor } from "@/lib/azure-devops/git/types";
import {
  getVersionDescriptorSearchParams,
  normalizeRepositoryPath,
} from "@/lib/azure-devops/git/urls";

type RepositoryItemOptions = {
  includeContent?: boolean;
  includeContentMetadata?: boolean;
  recursionLevel?: "Full" | "None" | "OneLevel" | "OneLevelPlusNestedEmptyFolders";
  sanitize?: boolean;
};

function getItemSearchParams(
  path: string,
  version: GitVersionDescriptor,
  options: RepositoryItemOptions,
) {
  const searchParams = getVersionDescriptorSearchParams(version);

  searchParams.set("path", normalizeRepositoryPath(path));
  searchParams.set(
    "includeContentMetadata",
    String(options.includeContentMetadata ?? true),
  );

  if (options.includeContent) {
    searchParams.set("includeContent", "true");
  }

  if (options.recursionLevel) {
    searchParams.set("recursionLevel", options.recursionLevel);
  }

  if (options.sanitize) {
    searchParams.set("sanitize", "true");
  }

  return searchParams;
}

export async function listRepositoryItems(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  path: string,
  version: GitVersionDescriptor,
) {
  const searchParams = getVersionDescriptorSearchParams(version);

  searchParams.set("includeContentMetadata", "true");
  searchParams.set("latestProcessedChange", "true");
  searchParams.set("recursionLevel", "OneLevel");
  searchParams.set("scopePath", normalizeRepositoryPath(path));

  const response = await azureDevOpsRequest<unknown>(
    `${getGitRepositoryApiPath(projectId, repositoryId)}/items?${searchParams}`,
    { accessToken },
  );
  const scopePath = normalizeRepositoryPath(path);

  return parseGitItemList(response).filter(
    (item) => normalizeRepositoryPath(item.path) !== scopePath,
  );
}

export async function getRepositoryItem(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  path: string,
  version: GitVersionDescriptor,
  options: RepositoryItemOptions = {},
) {
  const searchParams = getItemSearchParams(path, version, options);
  const response = await azureDevOpsRequest<unknown>(
    `${getGitRepositoryApiPath(projectId, repositoryId)}/items?${searchParams}`,
    { accessToken },
  );

  return parseGitItemResponse(response);
}

export async function getRepositoryItemContent(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  path: string,
  version: GitVersionDescriptor,
  options: {
    download?: boolean;
    resolveLfs?: boolean;
    sanitize?: boolean;
  } = {},
) {
  const searchParams = getVersionDescriptorSearchParams(version);

  searchParams.set("path", normalizeRepositoryPath(path));
  searchParams.set("download", String(options.download ?? false));
  searchParams.set("resolveLfs", String(options.resolveLfs ?? true));

  if (options.sanitize) {
    searchParams.set("sanitize", "true");
  }

  return azureDevOpsFetch(
    `${getGitRepositoryApiPath(projectId, repositoryId)}/items?${searchParams}`,
    {
      accept: "*/*",
      accessToken,
    },
  );
}
