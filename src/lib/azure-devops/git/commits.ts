import { azureDevOpsRequest } from "@/lib/azure-devops/client";
import {
  getGitRepositoryApiPath,
  parsePageCursor,
} from "@/lib/azure-devops/git/api-path";
import {
  parseCommitChanges,
  parseCommitDetail,
  parseCommitList,
} from "@/lib/azure-devops/git/parsers";
import type { GitVersionDescriptor } from "@/lib/azure-devops/git/types";
import {
  normalizeRepositoryPath,
} from "@/lib/azure-devops/git/urls";

export type ListRepositoryCommitsOptions = {
  cursor?: string | null;
  path?: string | null;
  top?: number;
  version: GitVersionDescriptor;
};

export async function listRepositoryCommits(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  options: ListRepositoryCommitsOptions,
) {
  const skip = parsePageCursor(options.cursor);
  const top = Math.min(Math.max(options.top ?? 50, 1), 100);
  const searchParams = new URLSearchParams({
    "$skip": String(skip),
    "$top": String(top),
    "searchCriteria.includePushData": "true",
    "searchCriteria.includeUserImageUrl": "true",
    "searchCriteria.itemVersion.version": options.version.value,
    "searchCriteria.itemVersion.versionOptions": "none",
    "searchCriteria.itemVersion.versionType": options.version.type,
  });

  if (options.path) {
    searchParams.set(
      "searchCriteria.itemPath",
      normalizeRepositoryPath(options.path),
    );
  }

  const response = await azureDevOpsRequest<unknown>(
    `${getGitRepositoryApiPath(projectId, repositoryId)}/commits?${searchParams}`,
    { accessToken },
  );
  const items = parseCommitList(response);

  return {
    items,
    nextCursor: items.length === top ? String(skip + items.length) : null,
  };
}

export async function getRepositoryCommit(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  commitId: string,
) {
  const searchParams = new URLSearchParams({
    includePushData: "true",
    includeUserImageUrl: "true",
    includeWorkItems: "true",
  });
  const response = await azureDevOpsRequest<unknown>(
    `${getGitRepositoryApiPath(projectId, repositoryId)}/commits/${encodeURIComponent(commitId)}?${searchParams}`,
    { accessToken },
  );

  return parseCommitDetail(response);
}

export async function getRepositoryCommitChanges(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  commitId: string,
  options: {
    cursor?: string | null;
    top?: number;
  } = {},
) {
  const skip = parsePageCursor(options.cursor);
  const top = Math.min(Math.max(options.top ?? 100, 1), 500);
  const searchParams = new URLSearchParams({
    skip: String(skip),
    top: String(top),
  });
  const response = await azureDevOpsRequest<unknown>(
    `${getGitRepositoryApiPath(projectId, repositoryId)}/commits/${encodeURIComponent(commitId)}/changes?${searchParams}`,
    { accessToken },
  );
  const items = parseCommitChanges(response);

  return {
    items,
    nextCursor: items.length === top ? String(skip + items.length) : null,
  };
}
