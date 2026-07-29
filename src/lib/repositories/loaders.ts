import { cache } from "react";
import type { DiffLineAnnotation } from "@pierre/diffs";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { getCurrentAzureDevOpsIdentityId } from "@/lib/azure-devops/current-user";
import {
  describeAzureDevOpsError,
  type AzureDevOpsErrorDescriptor,
} from "@/lib/azure-devops/errors";
import { hasAzureGitChangeType } from "@/lib/azure-devops/git/change-types";
import {
  getRepositoryCommit,
  getRepositoryCommitChanges,
  listRepositoryCommits,
} from "@/lib/azure-devops/git/commits";
import {
  getRepositoryItem,
  getRepositoryItemText,
  listRepositoryItems,
} from "@/lib/azure-devops/git/items";
import {
  listPullRequestIterationChanges,
  listPullRequestIterations,
  listPullRequestPolicyEvaluations,
  listPullRequestStatuses,
  listPullRequestThreads,
  getRepositoryPullRequest,
  listRepositoryPullRequests,
  type PullRequestStatus,
} from "@/lib/azure-devops/git/pull-requests";
import { listRepositoryBranchesAndTags } from "@/lib/azure-devops/git/refs";
import {
  getRepository,
  listRepositories,
} from "@/lib/azure-devops/git/repositories";
import { listRepositoryPushes } from "@/lib/azure-devops/git/pushes";
import { searchRepositoryCode } from "@/lib/azure-devops/git/search";
import { getAzureDevOpsIdentityLabels } from "@/lib/azure-devops/identities";
import { getWorkItemSummaries } from "@/lib/azure-devops/tasks";
import {
  buildPullRequestThreadSnippet,
  getPullRequestThreadLineRange,
  type PullRequestThreadSnippetLine,
} from "@/lib/repositories/pull-request-threads";
import { normalizeAzureDevOpsMarkdownMentions } from "@/lib/azure-devops/markup";
import type {
  AzureGitItem,
  AzureGitPolicyEvaluation,
  AzureGitPullRequest,
  AzureGitPullRequestChange,
  AzureGitPullRequestIteration,
  AzureGitPullRequestThread,
  AzureGitRepository,
  GitVersionDescriptor,
} from "@/lib/azure-devops/git/types";
import { stripRefPrefix } from "@/lib/azure-devops/git/urls";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import type { AzureDevOpsProject } from "@/lib/azure-devops/projects";

const MAX_INLINE_TEXT_BYTES = 1_000_000;
const MAX_DIFF_TEXT_BYTES = 500_000;
const README_NAMES = [
  "readme.md",
  "readme.markdown",
  "readme.mdown",
  "readme",
];

async function loadRepositoryTextContent(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  path: string,
  version: GitVersionDescriptor,
  maxBytes: number,
  encoding: number | null,
) {
  return getRepositoryItemText(
    accessToken,
    projectId,
    repositoryId,
    path,
    version,
    {
      encoding,
      maxBytes,
    },
  );
}

export type RepositoryListEntry = AzureGitRepository & {
  projectImageUrl: string | null;
};

export type RepositoryListPageData = {
  errors: Array<{
    error: AzureDevOpsErrorDescriptor;
    project: AzureDevOpsProject;
  }>;
  projectCount: number;
  repositories: RepositoryListEntry[];
  selectedProjects: AzureDevOpsProject[];
};

export async function loadRepositoryListPage(): Promise<RepositoryListPageData> {
  const accessToken = await getAzureDevOpsAccessToken();
  const selection = await loadAzureDevOpsProjectSelection(accessToken);
  const results = await Promise.allSettled(
    selection.selectedProjects.map(async (project) => ({
      project,
      repositories: await listRepositories(accessToken, project.id),
    })),
  );
  const repositories: RepositoryListEntry[] = [];
  const errors: RepositoryListPageData["errors"] = [];

  results.forEach((result, index) => {
    const project = selection.selectedProjects[index];

    if (!project) {
      return;
    }

    if (result.status === "rejected") {
      errors.push({
        error: describeAzureDevOpsError(result.reason),
        project,
      });
      return;
    }

    repositories.push(
      ...result.value.repositories.map((repository) => ({
        ...repository,
        projectImageUrl: project.defaultTeamImageUrl,
      })),
    );
  });

  repositories.sort((left, right) => {
    const projectComparison = left.project.name.localeCompare(
      right.project.name,
      undefined,
      { numeric: true, sensitivity: "base" },
    );

    return (
      projectComparison ||
      left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  });

  return {
    errors,
    projectCount: selection.selectedProjects.length,
    repositories,
    selectedProjects: selection.selectedProjects,
  };
}

export const loadRepositoryContext = cache(
  async (projectId: string, repositoryId: string) => {
    const accessToken = await getAzureDevOpsAccessToken();
    const repository = await getRepository(
      accessToken,
      projectId,
      repositoryId,
    );
    const refs = repository.defaultBranch
      ? await listRepositoryBranchesAndTags(
          accessToken,
          projectId,
          repositoryId,
        )
      : {
          branches: [],
          branchesTruncated: false,
          tags: [],
          tagsTruncated: false,
        };

    return {
      accessToken,
      refs,
      repository,
    };
  },
);

export function getDefaultRepositoryVersion(
  repository: AzureGitRepository,
): GitVersionDescriptor | null {
  return repository.defaultBranch
    ? {
        type: "branch",
        value: stripRefPrefix(repository.defaultBranch),
      }
    : null;
}

function findReadme(items: readonly AzureGitItem[]) {
  return items.find((item) =>
    README_NAMES.includes(item.path.split("/").pop()?.toLowerCase() ?? ""),
  );
}

export async function loadRepositoryOverview(
  projectId: string,
  repositoryId: string,
  version: GitVersionDescriptor,
) {
  const context = await loadRepositoryContext(projectId, repositoryId);
  const [items, commits] = await Promise.all([
    listRepositoryItems(
      context.accessToken,
      projectId,
      repositoryId,
      "/",
      version,
    ),
    listRepositoryCommits(
      context.accessToken,
      projectId,
      repositoryId,
      {
        top: 8,
        version,
      },
    ),
  ]);
  const readmeItem = findReadme(items);
  const readmeContent =
    readmeItem &&
    !readmeItem.contentMetadata.isBinary &&
    (readmeItem.size === null || readmeItem.size <= MAX_INLINE_TEXT_BYTES)
      ? await loadRepositoryTextContent(
          context.accessToken,
          projectId,
          repositoryId,
          readmeItem.path,
          version,
          MAX_INLINE_TEXT_BYTES,
          readmeItem.contentMetadata.encoding,
        )
      : null;
  const readme =
    readmeItem && readmeContent !== null
      ? {
          ...readmeItem,
          content: readmeContent,
        }
      : null;

  return {
    ...context,
    commits: commits.items,
    items,
    readme,
    version,
  };
}

export async function loadRepositoryDirectory(
  projectId: string,
  repositoryId: string,
  path: string,
  version: GitVersionDescriptor,
) {
  const context = await loadRepositoryContext(projectId, repositoryId);
  const [items, commits] = await Promise.all([
    listRepositoryItems(
      context.accessToken,
      projectId,
      repositoryId,
      path,
      version,
    ),
    listRepositoryCommits(
      context.accessToken,
      projectId,
      repositoryId,
      {
        path,
        top: 1,
        version,
      },
    ),
  ]);

  return {
    ...context,
    items,
    latestCommit: commits.items[0] ?? null,
    path,
    version,
  };
}

const MARKDOWN_EXTENSIONS = new Set([
  "markdown",
  "md",
  "mdown",
  "mdx",
  "mkd",
]);

function getFileExtension(path: string) {
  const fileName = path.split("/").pop() ?? "";
  const dotIndex = fileName.lastIndexOf(".");

  return dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : "";
}

export async function loadRepositoryBlob(
  projectId: string,
  repositoryId: string,
  path: string,
  version: GitVersionDescriptor,
) {
  const context = await loadRepositoryContext(projectId, repositoryId);
  const metadata = await getRepositoryItem(
    context.accessToken,
    projectId,
    repositoryId,
    path,
    version,
    {
      includeContentMetadata: true,
    },
  );
  const extension = getFileExtension(path);
  const canRenderText =
    !metadata.isFolder &&
    metadata.gitObjectType === "blob" &&
    !metadata.contentMetadata.isBinary &&
    !metadata.contentMetadata.isImage &&
    (metadata.size === null || metadata.size <= MAX_INLINE_TEXT_BYTES);
  const content = canRenderText
    ? await loadRepositoryTextContent(
        context.accessToken,
        projectId,
        repositoryId,
        path,
        version,
        MAX_INLINE_TEXT_BYTES,
        metadata.contentMetadata.encoding,
      )
    : null;
  const canRenderBoundedText = canRenderText && content !== null;
  const item = canRenderBoundedText
    ? {
        ...metadata,
        content,
      }
    : metadata;

  return {
    ...context,
    item,
    kind: metadata.isFolder
      ? ("folder" as const)
      : metadata.gitObjectType === "commit"
        ? ("submodule" as const)
      : metadata.contentMetadata.isImage
        ? ("image" as const)
        : metadata.contentMetadata.isBinary
          ? ("binary" as const)
          : !canRenderBoundedText
            ? ("too-large" as const)
            : MARKDOWN_EXTENSIONS.has(extension)
              ? ("markdown" as const)
              : ("text" as const),
    path,
    version,
  };
}

export async function loadRepositoryCommits(
  projectId: string,
  repositoryId: string,
  options: {
    cursor?: string | null;
    path?: string | null;
    version: GitVersionDescriptor;
  },
) {
  const context = await loadRepositoryContext(projectId, repositoryId);
  const commits = await listRepositoryCommits(
    context.accessToken,
    projectId,
    repositoryId,
    options,
  );

  return {
    ...context,
    ...commits,
    path: options.path ?? null,
    version: options.version,
  };
}

export async function loadRepositoryCommitDetail(
  projectId: string,
  repositoryId: string,
  commitId: string,
  cursor?: string | null,
) {
  const context = await loadRepositoryContext(projectId, repositoryId);
  const [commit, changes] = await Promise.all([
    getRepositoryCommit(
      context.accessToken,
      projectId,
      repositoryId,
      commitId,
    ),
    getRepositoryCommitChanges(
      context.accessToken,
      projectId,
      repositoryId,
      commitId,
      { cursor },
    ),
  ]);

  return {
    ...context,
    ...changes,
    commit,
  };
}

type RepositoryDiffFile = {
  content: string | null;
  kind:
    | "binary"
    | "folder"
    | "image"
    | "missing"
    | "submodule"
    | "text"
    | "too-large";
  path: string;
  size: number | null;
};

async function loadRepositoryDiffFile(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  path: string,
  commitId: string | null,
): Promise<RepositoryDiffFile> {
  if (!commitId) {
    return {
      content: null,
      kind: "missing",
      path,
      size: null,
    };
  }

  const version = {
    type: "commit" as const,
    value: commitId,
  };
  let metadata;

  try {
    metadata = await getRepositoryItem(
      accessToken,
      projectId,
      repositoryId,
      path,
      version,
      {
        includeContentMetadata: true,
      },
    );
  } catch (error) {
    if (describeAzureDevOpsError(error).kind === "not-found") {
      return {
        content: null,
        kind: "missing",
        path,
        size: null,
      };
    }

    throw error;
  }

  const kind = metadata.isFolder
    ? ("folder" as const)
    : metadata.gitObjectType === "commit"
      ? ("submodule" as const)
    : metadata.contentMetadata.isImage
      ? ("image" as const)
      : metadata.contentMetadata.isBinary
        ? ("binary" as const)
        : metadata.size !== null && metadata.size > MAX_DIFF_TEXT_BYTES
          ? ("too-large" as const)
          : ("text" as const);

  if (kind !== "text") {
    return {
      content: null,
      kind,
      path,
      size: metadata.size,
    };
  }

  const content = await loadRepositoryTextContent(
    accessToken,
    projectId,
    repositoryId,
    path,
    version,
    MAX_DIFF_TEXT_BYTES,
    metadata.contentMetadata.encoding,
  );

  return {
    content,
    kind: content === null ? "too-large" : kind,
    path,
    size: metadata.size,
  };
}

export async function loadRepositoryCommitFileDiff(
  projectId: string,
  repositoryId: string,
  commitId: string,
  path: string,
  basePath?: string | null,
) {
  const context = await loadRepositoryContext(projectId, repositoryId);
  const commit = await getRepositoryCommit(
    context.accessToken,
    projectId,
    repositoryId,
    commitId,
  );
  const parentCommitId = commit.parents[0] ?? null;
  const [before, after] = await Promise.all([
    loadRepositoryDiffFile(
      context.accessToken,
      projectId,
      repositoryId,
      basePath ?? path,
      parentCommitId,
    ),
    loadRepositoryDiffFile(
      context.accessToken,
      projectId,
      repositoryId,
      path,
      commit.commitId,
    ),
  ]);

  return {
    ...context,
    after,
    before,
    commit,
    parentCommitId,
  };
}

export async function loadRepositoryPushActivity(
  projectId: string,
  repositoryId: string,
  options: {
    cursor?: string | null;
    refName?: string | null;
  },
) {
  const context = await loadRepositoryContext(projectId, repositoryId);
  const pushes = await listRepositoryPushes(
    context.accessToken,
    projectId,
    repositoryId,
    options,
  );

  return {
    ...context,
    ...pushes,
    refName: options.refName ?? null,
  };
}

const ACTIVE_PULL_REQUEST_COUNT_LIMIT = 100;

export type RepositoryPullRequestCount = {
  isCapped: boolean;
  value: number;
};

/**
 * Azure DevOps does not return a total for pull request queries, so the badge
 * counts one capped page and marks anything beyond it as capped.
 */
export const loadActivePullRequestCount = cache(
  async (
    projectId: string,
    repositoryId: string,
  ): Promise<RepositoryPullRequestCount | null> => {
    try {
      const accessToken = await getAzureDevOpsAccessToken();
      const { items, nextCursor } = await listRepositoryPullRequests(
        accessToken,
        projectId,
        repositoryId,
        { status: "active", top: ACTIVE_PULL_REQUEST_COUNT_LIMIT },
      );

      return { isCapped: nextCursor !== null, value: items.length };
    } catch {
      return null;
    }
  },
);

export async function loadRepositoryPullRequests(
  projectId: string,
  repositoryId: string,
  options: {
    cursor?: string | null;
    status?: PullRequestStatus;
  },
) {
  const context = await loadRepositoryContext(projectId, repositoryId);
  const pullRequests = await listRepositoryPullRequests(
    context.accessToken,
    projectId,
    repositoryId,
    options,
  );

  return {
    ...context,
    ...pullRequests,
    status: options.status ?? "active",
  };
}

export async function loadRepositoryPullRequest(
  projectId: string,
  repositoryId: string,
  pullRequestId: number,
  options: {
    filesCursor?: string | null;
    includeFiles?: boolean;
    threadId?: number | null;
  } = {},
) {
  const context = await loadRepositoryContext(projectId, repositoryId);
  const [
    pullRequest,
    threads,
    iterations,
    statusesResult,
    policiesResult,
    currentUserIdResult,
  ] = await Promise.all([
    getRepositoryPullRequest(
      context.accessToken,
      projectId,
      repositoryId,
      pullRequestId,
    ),
    listPullRequestThreads(
      context.accessToken,
      projectId,
      repositoryId,
      pullRequestId,
    ),
    listPullRequestIterations(
      context.accessToken,
      projectId,
      repositoryId,
      pullRequestId,
    ),
    listPullRequestStatuses(
      context.accessToken,
      projectId,
      repositoryId,
      pullRequestId,
    ).then(
      (value) => ({ available: true as const, value }),
      () => ({ available: false as const, value: [] }),
    ),
    listPullRequestPolicyEvaluations(
      context.accessToken,
      projectId,
      pullRequestId,
    ).then(
      (value) => ({ available: true as const, value }),
      () => ({ available: false as const, value: [] }),
    ),
    getCurrentAzureDevOpsIdentityId(context.accessToken).catch(() => null),
  ]);
  const latestIteration = iterations.at(-1) ?? null;
  // Work item refs on the pull request carry ids only. The rail shows type,
  // title, state, and freshness, so the referenced items are batch-loaded
  // here; on failure the card falls back to plain id badges.
  const [normalizedThreads, workItems, changedFiles] = await Promise.all([
    normalizePullRequestThreadMentions(context.accessToken, threads),
    getWorkItemSummaries(
      context.accessToken,
      pullRequest.workItemIds
        .map((workItemId) => Number.parseInt(workItemId, 10))
        .filter((workItemId) => Number.isInteger(workItemId)),
    ).catch(() => []),
    // The Files tab count must be known on every tab, but file diffs are only
    // loaded on the Files tab itself. Change entries are metadata-only, so
    // one capped page is cheap; the same 2000-entry ceiling as the changes
    // API marks larger pull requests as capped instead of paging further.
    loadPullRequestChangedFiles({
      accessToken: context.accessToken,
      latestIteration,
      projectId,
      pullRequestId,
      repositoryId,
    }),
  ]);
  const requestedFileCursor =
    options.includeFiles &&
    latestIteration &&
    options.filesCursor === null &&
    options.threadId
      ? await findPullRequestThreadFileCursor({
          accessToken: context.accessToken,
          latestIteration,
          projectId,
          pullRequestId,
          repositoryId,
          thread:
            normalizedThreads.find(
              (thread) => thread.id === options.threadId,
            ) ?? null,
        })
      : options.filesCursor;
  const files =
    options.includeFiles && latestIteration
      ? await loadPullRequestFiles({
          accessToken: context.accessToken,
          cursor: requestedFileCursor,
          latestIteration,
          projectId,
          pullRequest,
          pullRequestId,
          repositoryId,
        })
      : null;
  const sourceRepository = pullRequest.sourceRepository ?? {
    id: repositoryId,
    projectId,
  };

  return {
    ...context,
    changedFileCount: changedFiles
      ? { isCapped: changedFiles.isCapped, value: changedFiles.items.length }
      : null,
    changedFiles,
    currentUserId: currentUserIdResult,
    files,
    iterations,
    latestIteration,
    policies: await describePolicyRequiredReviewers(
      context.accessToken,
      policiesResult.value,
    ),
    policiesAvailable: policiesResult.available,
    pullRequest,
    statuses: statusesResult.value,
    statusesAvailable: statusesResult.available,
    threadSnippets: await loadPullRequestThreadSnippets(
      context.accessToken,
      sourceRepository.projectId,
      sourceRepository.id,
      pullRequest.lastMergeSourceCommitId,
      normalizedThreads,
    ),
    threads: normalizedThreads,
    workItems,
  };
}

export const PULL_REQUEST_FILES_PAGE_SIZE = 25;
const MAX_CHANGED_FILE_ENTRIES = 2_000;
const MAX_SNIPPET_FILES = 20;
const THREAD_SNIPPET_CONTEXT_LINES = 3;

export type PullRequestThreadSnippets = Record<
  number,
  PullRequestThreadSnippetLine[]
>;

/**
 * A file thread shown outside the diff is just a path without the code it
 * refers to. Line positions on the right side address the merge source commit,
 * so that content is fetched once per file and sliced for each thread.
 *
 * Left side positions address the target branch and are deliberately skipped:
 * resolving them against the source commit would show unrelated lines.
 */
async function loadPullRequestThreadSnippets(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  sourceCommitId: string | null,
  threads: readonly AzureGitPullRequestThread[],
): Promise<PullRequestThreadSnippets> {
  if (!sourceCommitId) {
    return {};
  }

  const candidates = threads.flatMap((thread) => {
    const range = thread.filePath
      ? getPullRequestThreadLineRange(thread)
      : null;

    return !thread.isDeleted && thread.filePath && range?.side === "right"
      ? [{ filePath: thread.filePath, range, threadId: thread.id }]
      : [];
  });
  const filePaths = [
    ...new Set(candidates.map((candidate) => candidate.filePath)),
  ];
  const includedPaths = new Set(filePaths.slice(0, MAX_SNIPPET_FILES));

  if (filePaths.length > includedPaths.size) {
    console.warn(
      `Pull request thread snippets limited to ${includedPaths.size} of ${filePaths.length} files.`,
    );
  }

  const version: GitVersionDescriptor = {
    type: "commit",
    value: sourceCommitId,
  };
  const contents = new Map(
    await Promise.all(
      [...includedPaths].map(
        async (filePath): Promise<[string, string | null]> => [
          filePath,
          await loadPullRequestThreadSnippetContent(
            accessToken,
            projectId,
            repositoryId,
            filePath,
            version,
          ).catch(() => null),
        ],
      ),
    ),
  );
  const snippets: PullRequestThreadSnippets = {};

  for (const candidate of candidates) {
    const content = contents.get(candidate.filePath);

    if (!content) {
      continue;
    }

    const lines = buildPullRequestThreadSnippet(
      content,
      candidate.range,
      THREAD_SNIPPET_CONTEXT_LINES,
    );

    if (lines.length > 0) {
      snippets[candidate.threadId] = lines;
    }
  }

  return snippets;
}

async function loadPullRequestThreadSnippetContent(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  path: string,
  version: GitVersionDescriptor,
) {
  const metadata = await getRepositoryItem(
    accessToken,
    projectId,
    repositoryId,
    path,
    version,
    { includeContentMetadata: true },
  );

  if (
    metadata.isFolder ||
    metadata.gitObjectType !== "blob" ||
    metadata.contentMetadata.isBinary ||
    metadata.contentMetadata.isImage ||
    (metadata.size !== null && metadata.size > MAX_INLINE_TEXT_BYTES)
  ) {
    return null;
  }

  return loadRepositoryTextContent(
    accessToken,
    projectId,
    repositoryId,
    path,
    version,
    MAX_INLINE_TEXT_BYTES,
    metadata.contentMetadata.encoding,
  );
}

/**
 * Several "Required reviewers" configurations can apply to one pull request,
 * each naming a different reviewer. Without resolving those identities the rows
 * are indistinguishable from duplicates.
 */
async function describePolicyRequiredReviewers(
  accessToken: string,
  policies: readonly AzureGitPolicyEvaluation[],
): Promise<AzureGitPolicyEvaluation[]> {
  const reviewerIds = policies.flatMap((policy) => policy.requiredReviewerIds);

  if (reviewerIds.length === 0) {
    return [...policies];
  }

  const labels = await getAzureDevOpsIdentityLabels(
    accessToken,
    reviewerIds,
  ).catch(() => new Map<string, string>());

  return policies.map((policy) => {
    if (policy.requiredReviewerIds.length === 0) {
      return policy;
    }

    const names = policy.requiredReviewerIds
      .map((id) => labels.get(id.toLowerCase()))
      .filter((name): name is string => Boolean(name));

    return names.length > 0
      ? { ...policy, detail: names.join(", ") }
      : policy;
  });
}

async function normalizePullRequestThreadMentions(
  accessToken: string,
  threads: readonly AzureGitPullRequestThread[],
) {
  const mentionIds = threads.flatMap((thread) =>
    thread.comments.flatMap((comment) =>
      [...comment.content.matchAll(/@<([^>]+)>/g)].flatMap((match) => {
        const id = match[1]?.trim().toLowerCase();
        return id ? [id] : [];
      }),
    ),
  );

  if (mentionIds.length === 0) {
    return threads;
  }

  const labels = await getAzureDevOpsIdentityLabels(
    accessToken,
    mentionIds,
  ).catch(() => new Map<string, string>());

  if (labels.size === 0) {
    return threads;
  }

  return threads.map((thread) => ({
    ...thread,
    comments: thread.comments.map((comment) => ({
      ...comment,
      content: normalizeAzureDevOpsMarkdownMentions(
        comment.content,
        labels,
      ),
    })),
  }));
}

function getPullRequestThreadAnnotations(
  threads: readonly AzureGitPullRequestThread[],
) {
  return threads.flatMap(
    (
      thread,
    ): DiffLineAnnotation<AzureGitPullRequestThread>[] => {
      if (thread.rightFileStart) {
        return [
          {
            lineNumber: thread.rightFileStart.line,
            metadata: thread,
            side: "additions",
          },
        ];
      }

      if (thread.leftFileStart) {
        return [
          {
            lineNumber: thread.leftFileStart.line,
            metadata: thread,
            side: "deletions",
          },
        ];
      }

      return [
        {
          lineNumber: 0,
          metadata: thread,
          side: "additions",
        },
      ];
    },
  );
}

async function loadPullRequestFileDiff({
  accessToken,
  change,
  latestIteration,
  projectId,
  pullRequest,
  repositoryId,
  threads,
}: {
  accessToken: string;
  change: Awaited<
    ReturnType<typeof listPullRequestIterationChanges>
  >["items"][number];
  latestIteration: AzureGitPullRequestIteration;
  projectId: string;
  pullRequest: AzureGitPullRequest;
  repositoryId: string;
  threads: AzureGitPullRequestThread[];
}) {
  const sourceRepository = pullRequest.sourceRepository ?? {
    id: repositoryId,
    projectId,
  };
  const beforePath = change.originalPath ?? change.path;
  const [before, after] = await Promise.all([
    loadRepositoryDiffFile(
      accessToken,
      projectId,
      repositoryId,
      beforePath,
      hasAzureGitChangeType(change.changeType, "add")
        ? null
        : latestIteration.commonRefCommitId,
    ),
    loadRepositoryDiffFile(
      accessToken,
      sourceRepository.projectId,
      sourceRepository.id,
      change.path,
      hasAzureGitChangeType(change.changeType, "delete")
        ? null
        : latestIteration.sourceRefCommitId,
    ),
  ]);
  const annotations = getPullRequestThreadAnnotations(threads);
  const canBuildDiff =
    (before.kind === "text" || before.kind === "missing") &&
    (after.kind === "text" || after.kind === "missing");
  const diff = canBuildDiff
    ? await import("@/lib/repositories/pierre-diff-server").then(
        ({ preloadRepositoryDiff }) =>
          preloadRepositoryDiff(
            {
              contents: before.content ?? "",
              name: before.path,
            },
            {
              contents: after.content ?? "",
              name: after.path,
            },
            annotations,
          ),
      )
    : null;

  return {
    after,
    annotations,
    before,
    change,
    diff,
    threads,
  };
}

function isPullRequestThreadOnChange(
  thread: AzureGitPullRequestThread,
  change: Awaited<
    ReturnType<typeof listPullRequestIterationChanges>
  >["items"][number],
) {
  return (
    thread.changeTrackingId === change.changeTrackingId ||
    (thread.changeTrackingId === null && thread.filePath === change.path)
  );
}

async function findPullRequestThreadFileCursor({
  accessToken,
  latestIteration,
  projectId,
  pullRequestId,
  repositoryId,
  thread,
}: {
  accessToken: string;
  latestIteration: AzureGitPullRequestIteration;
  projectId: string;
  pullRequestId: number;
  repositoryId: string;
  thread: AzureGitPullRequestThread | null;
}) {
  if (!thread?.filePath) {
    return null;
  }

  let cursor: string | null = null;
  const visitedCursors = new Set<string>();

  while (true) {
    const changes = await listPullRequestIterationChanges(
      accessToken,
      projectId,
      repositoryId,
      pullRequestId,
      latestIteration.id,
      {
        compareTo: 0,
        cursor,
        top: 25,
      },
    );

    if (
      changes.items.some((change) =>
        isPullRequestThreadOnChange(thread, change),
      )
    ) {
      return cursor;
    }

    if (
      !changes.nextCursor ||
      visitedCursors.has(changes.nextCursor)
    ) {
      return null;
    }

    visitedCursors.add(changes.nextCursor);
    cursor = changes.nextCursor;
  }
}

export type PullRequestChangedFiles = {
  isCapped: boolean;
  items: AzureGitPullRequestChange[];
};

/**
 * Change entries are metadata only, so the whole set is affordable in one
 * request even when the diffs behind them are not. The file tree is built from
 * this list rather than from a page of diffs: a tree that only covers the
 * current page hides most of a large pull request, which is precisely the case
 * a tree exists for.
 */
async function loadPullRequestChangedFiles({
  accessToken,
  latestIteration,
  projectId,
  pullRequestId,
  repositoryId,
}: {
  accessToken: string;
  latestIteration: AzureGitPullRequestIteration | null;
  projectId: string;
  pullRequestId: number;
  repositoryId: string;
}): Promise<PullRequestChangedFiles | null> {
  if (!latestIteration) {
    return null;
  }

  try {
    const changes = await listPullRequestIterationChanges(
      accessToken,
      projectId,
      repositoryId,
      pullRequestId,
      latestIteration.id,
      { compareTo: 0, top: MAX_CHANGED_FILE_ENTRIES },
    );

    return {
      isCapped: changes.nextCursor !== null,
      items: changes.items,
    };
  } catch {
    return null;
  }
}

async function loadPullRequestFiles({
  accessToken,
  cursor,
  latestIteration,
  projectId,
  pullRequest,
  pullRequestId,
  repositoryId,
}: {
  accessToken: string;
  cursor?: string | null;
  latestIteration: AzureGitPullRequestIteration;
  projectId: string;
  pullRequest: AzureGitPullRequest;
  pullRequestId: number;
  repositoryId: string;
}) {
  const [changes, trackedThreads] = await Promise.all([
    listPullRequestIterationChanges(
      accessToken,
      projectId,
      repositoryId,
      pullRequestId,
      latestIteration.id,
      {
        compareTo: 0,
        cursor,
        top: PULL_REQUEST_FILES_PAGE_SIZE,
      },
    ),
    listPullRequestThreads(
      accessToken,
      projectId,
      repositoryId,
      pullRequestId,
      {
        baseIteration: 0,
        iteration: latestIteration.id,
      },
    ),
  ]);
  const normalizedTrackedThreads =
    await normalizePullRequestThreadMentions(accessToken, trackedThreads);
  const files = await Promise.all(
    changes.items.map((change) => {
      const threads = normalizedTrackedThreads.filter(
        (thread) => isPullRequestThreadOnChange(thread, change),
      );

      return loadPullRequestFileDiff({
        accessToken,
        change,
        latestIteration,
        projectId,
        pullRequest,
        repositoryId,
        threads,
      });
    }),
  );

  return {
    cursor: cursor ?? null,
    files,
    nextCursor: changes.nextCursor,
  };
}

export async function loadRepositorySearch(
  projectId: string,
  repositoryId: string,
  options: {
    branch?: string | null;
    cursor?: string | null;
    path?: string | null;
    query: string;
  },
) {
  const context = await loadRepositoryContext(projectId, repositoryId);
  const search = await searchRepositoryCode(
    context.accessToken,
    projectId,
    context.repository.project.name,
    repositoryId,
    context.repository.name,
    options,
  );

  return {
    ...context,
    ...search,
    query: options.query,
  };
}
