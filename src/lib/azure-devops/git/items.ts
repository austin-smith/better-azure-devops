import {
  azureDevOpsRequest,
  readAzureDevOpsResponse,
  streamAzureDevOpsResponse,
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
import { readTextResponseWithinLimit } from "@/lib/azure-devops/text-response";

type RepositoryItemOptions = {
  includeContent?: boolean;
  includeContentMetadata?: boolean;
  recursionLevel?: "Full" | "None" | "OneLevel" | "OneLevelPlusNestedEmptyFolders";
  sanitize?: boolean;
  signal?: AbortSignal;
};

type RepositoryItemContentOptions = {
  download?: boolean;
  resolveLfs?: boolean;
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
    options.signal
      ? { accessToken, signal: options.signal }
      : { accessToken },
  );

  return parseGitItemResponse(response);
}

function getRepositoryItemContentPath(
  projectId: string,
  repositoryId: string,
  path: string,
  version: GitVersionDescriptor,
  options: RepositoryItemContentOptions = {},
) {
  const searchParams = getVersionDescriptorSearchParams(version);

  searchParams.set("path", normalizeRepositoryPath(path));
  searchParams.set("download", String(options.download ?? false));
  searchParams.set("resolveLfs", String(options.resolveLfs ?? true));

  if (options.sanitize) {
    searchParams.set("sanitize", "true");
  }

  return `${getGitRepositoryApiPath(projectId, repositoryId)}/items?${searchParams}`;
}

export function getRepositoryItemText(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  path: string,
  version: GitVersionDescriptor,
  options: {
    encoding: number | null;
    fatal?: boolean;
    maxBytes: number;
    resolveLfs?: boolean;
    signal?: AbortSignal;
  },
) {
  const requestPath = getRepositoryItemContentPath(
    projectId,
    repositoryId,
    path,
    version,
    { resolveLfs: options.resolveLfs },
  );

  return readAzureDevOpsResponse(
    requestPath,
    {
      accept: "*/*",
      accessToken,
      ...(options.signal ? { signal: options.signal } : {}),
    },
    (response) =>
      readTextResponseWithinLimit(
        response,
        options.maxBytes,
        options.encoding,
        {
          fatal: options.fatal,
          signal: options.signal,
        },
      ),
  );
}

export function streamRepositoryItemContent(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  path: string,
  version: GitVersionDescriptor,
  options: RepositoryItemContentOptions & {
    signal?: AbortSignal;
  } = {},
) {
  const requestPath = getRepositoryItemContentPath(
    projectId,
    repositoryId,
    path,
    version,
    options,
  );

  return streamAzureDevOpsResponse(requestPath, {
    accept: "*/*",
    accessToken,
    ...(options.signal ? { signal: options.signal } : {}),
  });
}
