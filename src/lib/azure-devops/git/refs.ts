import { readAzureDevOpsResponse } from "@/lib/azure-devops/client";
import { getGitRepositoryApiPath } from "@/lib/azure-devops/git/api-path";
import { parseRefList } from "@/lib/azure-devops/git/parsers";
import type { AzureGitRef } from "@/lib/azure-devops/git/types";
import { getContinuationToken } from "@/lib/azure-devops/pagination";

export type ListRepositoryRefsOptions = {
  cursor?: string | null;
  filter?: "branches" | "tags";
  query?: string;
  top?: number;
};

export async function listRepositoryRefs(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  options: ListRepositoryRefsOptions = {},
) {
  const top = Math.min(Math.max(options.top ?? 200, 1), 1_000);
  const searchParams = new URLSearchParams({
    "$top": String(top),
    filter:
      options.filter === "tags"
        ? "tags/"
        : options.filter === "branches"
          ? "heads/"
          : "",
  });

  if (options.cursor) {
    searchParams.set("continuationToken", options.cursor);
  }

  if (options.query?.trim()) {
    searchParams.set("filterContains", options.query.trim());
  }

  const page = await readAzureDevOpsResponse(
    `${getGitRepositoryApiPath(projectId, repositoryId)}/refs?${searchParams}`,
    { accessToken },
    async (response) => ({
      nextCursor: getContinuationToken(response.headers),
      payload: await response.json(),
    }),
  );

  return {
    items: parseRefList(page.payload),
    nextCursor: page.nextCursor,
  } satisfies {
    items: AzureGitRef[];
    nextCursor: string | null;
  };
}

export async function listRepositoryBranchesAndTags(
  accessToken: string,
  projectId: string,
  repositoryId: string,
) {
  const [branches, tags] = await Promise.all([
    listRepositoryRefs(accessToken, projectId, repositoryId, {
      filter: "branches",
      top: 1_000,
    }),
    listRepositoryRefs(accessToken, projectId, repositoryId, {
      filter: "tags",
      top: 200,
    }),
  ]);

  return {
    branches: branches.items,
    branchesTruncated: branches.nextCursor !== null,
    tags: tags.items,
    tagsTruncated: tags.nextCursor !== null,
  };
}
