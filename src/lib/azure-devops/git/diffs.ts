import { azureDevOpsRequest } from "@/lib/azure-devops/client";
import { getGitRepositoryApiPath } from "@/lib/azure-devops/git/api-path";
import {
  isRecord,
  parseCommitChanges,
  readBoolean,
} from "@/lib/azure-devops/git/parsers";
import { createMalformedResponseError } from "@/lib/azure-devops/errors";

export async function listRepositoryCommitDiffs(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  options: {
    baseCommitId: string;
    cursor?: string | null;
    signal?: AbortSignal;
    targetCommitId: string;
    top?: number;
  },
) {
  const parsedCursor = Number(options.cursor);
  const skip =
    Number.isSafeInteger(parsedCursor) && parsedCursor >= 0
      ? parsedCursor
      : 0;
  const top = Math.min(Math.max(options.top ?? 2_000, 1), 2_000);
  const searchParams = new URLSearchParams({
    "$skip": String(skip),
    "$top": String(top),
    baseVersion: options.baseCommitId,
    baseVersionOptions: "none",
    baseVersionType: "commit",
    diffCommonCommit: "false",
    targetVersion: options.targetCommitId,
    targetVersionOptions: "none",
    targetVersionType: "commit",
  });
  const response = await azureDevOpsRequest<unknown>(
    `${getGitRepositoryApiPath(projectId, repositoryId)}/diffs/commits?${searchParams}`,
    options.signal
      ? { accessToken, signal: options.signal }
      : { accessToken },
  );

  if (!isRecord(response) || !Array.isArray(response.changes)) {
    throw createMalformedResponseError("loading a commit diff");
  }

  const rawChanges = response.changes;
  const items = parseCommitChanges(response);
  const rawItemCount = rawChanges.length;
  const allChangesIncluded = readBoolean(
    response.allChangesIncluded,
    rawItemCount < top,
  );

  if (
    items.length !== rawItemCount ||
    (!allChangesIncluded && rawItemCount === 0)
  ) {
    throw createMalformedResponseError("loading a commit diff");
  }

  return {
    allChangesIncluded,
    items,
    nextCursor:
      !allChangesIncluded && rawItemCount > 0
        ? String(skip + rawItemCount)
        : null,
  };
}
