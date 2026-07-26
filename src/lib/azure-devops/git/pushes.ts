import { azureDevOpsRequest } from "@/lib/azure-devops/client";
import {
  getGitRepositoryApiPath,
  parsePageCursor,
} from "@/lib/azure-devops/git/api-path";
import {
  parseCommitList,
  parsePushList,
} from "@/lib/azure-devops/git/parsers";

const MAX_COMMITS_PER_PUSH = 100;
const PUSH_HYDRATION_CONCURRENCY = 5;

async function loadPushCommits(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  pushId: number,
) {
  // The dedicated Get Push Commits operation documents these unprefixed
  // parameters even though it shares the repository commits route.
  const searchParams = new URLSearchParams({
    includeLinks: "true",
    pushId: String(pushId),
    skip: "0",
    top: String(MAX_COMMITS_PER_PUSH + 1),
  });
  const response = await azureDevOpsRequest<unknown>(
    `${getGitRepositoryApiPath(projectId, repositoryId)}/commits?${searchParams}`,
    { accessToken },
  );
  const commits = parseCommitList(response);

  return {
    commits: commits.slice(0, MAX_COMMITS_PER_PUSH),
    commitsTruncated: commits.length > MAX_COMMITS_PER_PUSH,
  };
}

export async function listRepositoryPushes(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  options: {
    cursor?: string | null;
    refName?: string | null;
    top?: number;
  } = {},
) {
  const skip = parsePageCursor(options.cursor);
  const top = Math.min(Math.max(options.top ?? 25, 1), 100);
  const searchParams = new URLSearchParams({
    "$skip": String(skip),
    "$top": String(top),
    "searchCriteria.includeLinks": "true",
    "searchCriteria.includeRefUpdates": "true",
  });

  if (options.refName?.trim()) {
    const refName = options.refName.startsWith("refs/")
      ? options.refName
      : `refs/heads/${options.refName}`;

    searchParams.set("searchCriteria.refName", refName);
  }

  const response = await azureDevOpsRequest<unknown>(
    `${getGitRepositoryApiPath(projectId, repositoryId)}/pushes?${searchParams}`,
    { accessToken },
  );
  const shallowItems = parsePushList(response);
  const items = [];

  for (
    let index = 0;
    index < shallowItems.length;
    index += PUSH_HYDRATION_CONCURRENCY
  ) {
    const batch = shallowItems.slice(
      index,
      index + PUSH_HYDRATION_CONCURRENCY,
    );
    const hydrated = await Promise.all(
      batch.map(async (push) => ({
        ...push,
        ...(await loadPushCommits(
          accessToken,
          projectId,
          repositoryId,
          push.pushId,
        )),
      })),
    );

    items.push(...hydrated);
  }

  return {
    items,
    nextCursor: items.length === top ? String(skip + items.length) : null,
  };
}
