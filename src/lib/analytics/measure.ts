import "server-only";
import { AzureDevOpsError } from "@/lib/azure-devops/errors";
import type { AzureGitCommitChange } from "@/lib/azure-devops/git/types";
import { hasAzureGitChangeType } from "@/lib/azure-devops/git/change-types";
import { listRepositoryCommitDiffs } from "@/lib/azure-devops/git/diffs";
import {
  getRepositoryItem,
  getRepositoryItemContent,
} from "@/lib/azure-devops/git/items";
import {
  readTextResponseWithinLimit,
  TextResponseReadError,
} from "@/lib/azure-devops/text-response";
import { countAnalyticsTextDiff } from "@/lib/analytics/diff-count";

const MAX_ANALYTICS_FILE_BYTES = 1_000_000;
const FILE_MEASUREMENT_CONCURRENCY = 4;
const LFS_POINTER_PREFIX = "version https://git-lfs.github.com/spec/v1";

export type AnalyticsFileMeasurement = {
  additions: number;
  changeType: string;
  deletions: number;
  measurementStatus:
    | "binary"
    | "lfs"
    | "measured"
    | "submodule"
    | "too_large"
    | "unavailable";
  originalPath: string | null;
  path: string;
};

type FileSide =
  | { contents: string; kind: "text" }
  | {
      kind:
        | "binary"
        | "lfs"
        | "submodule"
        | "too_large"
        | "unavailable";
    };

async function loadFileSide(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  path: string,
  commitId: string,
  signal: AbortSignal,
): Promise<FileSide> {
  const version = { type: "commit" as const, value: commitId };
  let item;

  try {
    item = await getRepositoryItem(
      accessToken,
      projectId,
      repositoryId,
      path,
      version,
      { includeContentMetadata: true, signal },
    );
  } catch (error) {
    if (
      error instanceof AzureDevOpsError &&
      error.code === "not_found"
    ) {
      return { kind: "unavailable" };
    }

    throw error;
  }

  if (item.gitObjectType === "commit") {
    return { kind: "submodule" };
  }

  if (item.isFolder || item.gitObjectType === "tree") {
    return { kind: "binary" };
  }

  if (item.gitObjectType !== "blob") {
    return { kind: "unavailable" };
  }

  if (item.contentMetadata.isBinary) {
    return { kind: "binary" };
  }

  if (item.size !== null && item.size > MAX_ANALYTICS_FILE_BYTES) {
    return { kind: "too_large" };
  }

  let response: Response;

  try {
    response = await getRepositoryItemContent(
      accessToken,
      projectId,
      repositoryId,
      path,
      version,
      { resolveLfs: false, signal },
    );
  } catch (error) {
    if (
      error instanceof AzureDevOpsError &&
      error.code === "not_found"
    ) {
      return { kind: "unavailable" };
    }

    throw error;
  }

  let contents: string | null;

  try {
    contents = await readTextResponseWithinLimit(
      response,
      MAX_ANALYTICS_FILE_BYTES,
      item.contentMetadata.encoding,
      { fatal: true, signal },
    );
  } catch (error) {
    if (error instanceof TextResponseReadError || signal.aborted) {
      throw error;
    }

    return { kind: "unavailable" };
  }

  if (contents === null) {
    return { kind: "too_large" };
  }

  if (contents.startsWith(LFS_POINTER_PREFIX)) {
    return { kind: "lfs" };
  }

  return { contents, kind: "text" };
}

function fileWithoutTextMeasurement(
  change: AzureGitCommitChange,
  measurementStatus: Exclude<
    AnalyticsFileMeasurement["measurementStatus"],
    "measured"
  >,
): AnalyticsFileMeasurement {
  return {
    additions: 0,
    changeType: change.changeType,
    deletions: 0,
    measurementStatus,
    originalPath: change.originalPath,
    path: change.item.path,
  };
}

async function measureFile(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  baseCommitId: string,
  targetCommitId: string,
  change: AzureGitCommitChange,
  signal: AbortSignal,
): Promise<AnalyticsFileMeasurement> {
  if (change.item.gitObjectType === "commit") {
    return fileWithoutTextMeasurement(change, "submodule");
  }

  const added = hasAzureGitChangeType(change.changeType, "add");
  const deleted = hasAzureGitChangeType(change.changeType, "delete");
  const originalPath = change.originalPath ?? change.item.path;
  const [oldSide, newSide] = await Promise.all([
    added
      ? Promise.resolve<FileSide>({ contents: "", kind: "text" })
      : loadFileSide(
          accessToken,
          projectId,
          repositoryId,
          originalPath,
          baseCommitId,
          signal,
        ),
    deleted
      ? Promise.resolve<FileSide>({ contents: "", kind: "text" })
      : loadFileSide(
          accessToken,
          projectId,
          repositoryId,
          change.item.path,
          targetCommitId,
          signal,
        ),
  ]);

  if (oldSide.kind !== "text" || newSide.kind !== "text") {
    const kind =
      oldSide.kind === "unavailable" || newSide.kind === "unavailable"
        ? "unavailable"
        : oldSide.kind === "too_large" || newSide.kind === "too_large"
            ? "too_large"
            : oldSide.kind === "binary" || newSide.kind === "binary"
              ? "binary"
              : oldSide.kind === "lfs" || newSide.kind === "lfs"
                ? "lfs"
                : "submodule";

    return fileWithoutTextMeasurement(change, kind);
  }

  try {
    const metrics = countAnalyticsTextDiff(
      { contents: oldSide.contents, name: originalPath },
      { contents: newSide.contents, name: change.item.path },
    );

    return {
      additions: metrics.additions,
      changeType: change.changeType,
      deletions: metrics.deletions,
      measurementStatus: "measured",
      originalPath: change.originalPath,
      path: change.item.path,
    };
  } catch {
    return fileWithoutTextMeasurement(change, "unavailable");
  }
}

export async function measurePullRequestFiles(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  options: {
    baseCommitId: string;
    signal: AbortSignal;
    targetCommitId: string;
  },
) {
  const changes: AzureGitCommitChange[] = [];
  let cursor: string | null = null;

  do {
    const page = await listRepositoryCommitDiffs(
      accessToken,
      projectId,
      repositoryId,
      {
        baseCommitId: options.baseCommitId,
        cursor,
        signal: options.signal,
        targetCommitId: options.targetCommitId,
      },
    );

    changes.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);

  const fileChanges = changes.filter(
    (change) =>
      !change.item.isFolder &&
      change.item.gitObjectType !== "tree",
  );
  const measurements = new Array<AnalyticsFileMeasurement>(
    fileChanges.length,
  );
  let nextIndex = 0;

  async function measureNextFile() {
    while (nextIndex < fileChanges.length) {
      const index = nextIndex;
      nextIndex += 1;
      measurements[index] = await measureFile(
        accessToken,
        projectId,
        repositoryId,
        options.baseCommitId,
        options.targetCommitId,
        fileChanges[index],
        options.signal,
      );
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          FILE_MEASUREMENT_CONCURRENCY,
          fileChanges.length,
        ),
      },
      () => measureNextFile(),
    ),
  );

  return measurements;
}
