import { FileWarningIcon } from "lucide-react";
import { createInlinePullRequestComment } from "@/app/repos/[projectId]/[repositoryId]/pulls/[pullRequestId]/actions";
import type { RepositoryPullRequestData } from "@/components/repositories/repository-pull-request-detail";
import { RepositoryPager } from "@/components/repositories/repository-pager";
import { RepositoryPullRequestFileDiff } from "@/components/repositories/repository-pull-request-file-diff";
import { RepositoryPathIcon } from "@/components/repositories/repository-path-icon";
import { RepositoryPullRequestFileTree } from "@/components/repositories/repository-pull-request-file-tree";
import { RepositoryPullRequestFilesLayout } from "@/components/repositories/repository-pull-request-files-layout";
import { RepositoryPullRequestThread } from "@/components/repositories/repository-pull-request-thread";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { AzureGitIdentity } from "@/lib/azure-devops/git/types";
import { getRepositoryHref } from "@/lib/azure-devops/git/urls";
import { PULL_REQUEST_FILES_PAGE_SIZE } from "@/lib/repositories/loaders";

type PullRequestFile = NonNullable<
  RepositoryPullRequestData["files"]
>["files"][number];

function getUnavailableDescription(
  file: PullRequestFile["before"] | PullRequestFile["after"],
) {
  switch (file.kind) {
    case "binary":
      return `${file.path} is binary and cannot be rendered as a text diff.`;
    case "folder":
      return `${file.path} resolves to a directory.`;
    case "image":
      return `${file.path} is an image and cannot be rendered as a text diff.`;
    case "submodule":
      return `${file.path} is a Git submodule reference rather than a text file.`;
    case "too-large":
      return `${file.path} exceeds the safe inline diff limit.`;
    default:
      return `${file.path} is unavailable in this comparison.`;
  }
}

function PullRequestFileCard({
  canComment,
  createdBy,
  file,
  latestIterationId,
  projectId,
  pullRequestId,
  repositoryId,
}: {
  canComment: boolean;
  createdBy: AzureGitIdentity | null;
  file: PullRequestFile;
  latestIterationId: number;
  projectId: string;
  pullRequestId: number;
  repositoryId: string;
}) {
  const unavailableFile = [file.before, file.after].find(
    (candidate) =>
      candidate.kind !== "text" && candidate.kind !== "missing",
  );
  const commentAction =
    canComment && file.diff?.kind === "ready"
      ? createInlinePullRequestComment.bind(null, {
          changeTrackingId: file.change.changeTrackingId,
          filePath: file.change.path,
          firstComparingIteration: 0,
          projectId,
          pullRequestId,
          repositoryId,
          secondComparingIteration: latestIterationId,
        })
      : undefined;

  return (
    <article
      className="scroll-mt-20 overflow-hidden rounded-lg border bg-card"
      id={`file-${file.change.changeTrackingId}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <RepositoryPathIcon kind="file" path={file.change.path} />
          <span className="truncate font-mono text-sm">
            {file.change.path}
          </span>
          {file.change.originalPath &&
          file.change.originalPath !== file.change.path ? (
            <span className="truncate text-xs text-muted-foreground">
              from {file.change.originalPath}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant="outline">{file.change.changeType}</Badge>
          {file.diff ? (
            <>
              <Badge variant="secondary">+{file.diff.additions}</Badge>
              <Badge variant="destructive">−{file.diff.deletions}</Badge>
            </>
          ) : null}
          {file.threads.length > 0 ? (
            <Badge variant="secondary">
              {file.threads.length} thread
              {file.threads.length === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </div>
      </header>

      {unavailableFile ? (
        <div className="p-4">
          <Alert>
            <FileWarningIcon />
            <AlertTitle>Text diff unavailable</AlertTitle>
            <AlertDescription>
              {getUnavailableDescription(unavailableFile)}
            </AlertDescription>
          </Alert>
        </div>
      ) : file.diff?.kind === "too-large" ? (
        <div className="p-4">
          <Alert>
            <FileWarningIcon />
            <AlertTitle>Diff is too large to preview</AlertTitle>
            <AlertDescription>
              This change would render {file.diff.lineCount.toLocaleString()}{" "}
              lines, exceeding the safe inline diff limit.
            </AlertDescription>
          </Alert>
        </div>
      ) : file.diff?.kind === "ready" ? (
        <>
          <RepositoryPullRequestFileDiff
            ariaLabel={`Changes to ${file.change.path}`}
            canComment={canComment}
            commentAction={commentAction}
            createdBy={createdBy}
            preloadedDiff={file.diff.preloadedDiff}
            projectId={projectId}
            pullRequestId={pullRequestId}
            repositoryId={repositoryId}
          />
          {file.diff.additions === 0 && file.diff.deletions === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No textual differences were found.
            </div>
          ) : null}
        </>
      ) : null}

      {/* With a rendered diff, threads live inside it at their lines (with
          the unanchored fallback handled there). This list only remains for
          files whose diff cannot render at all. */}
      {file.diff?.kind !== "ready" && file.threads.length > 0 ? (
        <div className="flex flex-col gap-4 border-t p-3">
          <h3 className="text-xs font-medium text-muted-foreground">
            Inline discussion
          </h3>
          {file.threads.map((thread) => (
            <RepositoryPullRequestThread
              canComment={canComment}
              createdBy={createdBy}
              key={thread.id}
              projectId={projectId}
              pullRequestId={pullRequestId}
              repositoryId={repositoryId}
              thread={thread}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function RepositoryPullRequestFiles({
  data,
  projectId,
  repositoryId,
}: {
  data: RepositoryPullRequestData;
  projectId: string;
  repositoryId: string;
}) {
  const { changedFiles, files, latestIteration, pullRequest } = data;
  const baseHref = `${getRepositoryHref(
    projectId,
    repositoryId,
  )}/pulls/${pullRequest.pullRequestId}`;

  if (!latestIteration || !files) {
    return (
      <Alert>
        <FileWarningIcon />
        <AlertTitle>File comparison unavailable</AlertTitle>
        <AlertDescription>
          Azure DevOps did not return an iteration that can be compared.
        </AlertDescription>
      </Alert>
    );
  }

  // Totals are only truthful when every diff is loaded; on a paged comparison
  // they would silently describe one page while the file count describes all.
  const isFullyLoaded = !files.nextCursor && !files.cursor;
  const loadedTotals = files.files.reduce(
    (accumulator, file) => ({
      additions: accumulator.additions + (file.diff?.additions ?? 0),
      deletions: accumulator.deletions + (file.diff?.deletions ?? 0),
    }),
    { additions: 0, deletions: 0 },
  );
  const totals = isFullyLoaded
    ? loadedTotals
    : { additions: null, deletions: null };

  // The tree covers every changed file even though only one page of diffs is
  // loaded, so a large pull request stays navigable. Entries outside the page
  // link to the page that holds them.
  const loadedByTrackingId = new Map(
    files.files.map((file) => [file.change.changeTrackingId, file]),
  );
  const treeEntries = (changedFiles?.items ?? files.files.map((f) => f.change))
    .map((change, index) => {
      const loaded = loadedByTrackingId.get(change.changeTrackingId);
      const pageStart =
        Math.floor(index / PULL_REQUEST_FILES_PAGE_SIZE) *
        PULL_REQUEST_FILES_PAGE_SIZE;
      const anchorId = `file-${change.changeTrackingId}`;

      return {
        additions: loaded?.diff?.additions ?? null,
        anchorId,
        changeType: change.changeType,
        deletions: loaded?.diff?.deletions ?? null,
        href: loaded
          ? null
          : `${baseHref}?tab=files${pageStart > 0 ? `&filesCursor=${pageStart}` : ""}#${anchorId}`,
        path: change.path,
        threadCount: loaded?.threads.length ?? 0,
      };
    });

  if (files.files.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border bg-card px-3 py-12 text-center text-sm text-muted-foreground">
          No changed files were returned for this comparison.
        </div>
      </div>
    );
  }

  return (
    <RepositoryPullRequestFilesLayout
      toolbar={<Badge variant="outline">Update {latestIteration.id}</Badge>}
      tree={
        <RepositoryPullRequestFileTree entries={treeEntries} totals={totals} />
      }
    >
      {files.files.map((file) => (
        <PullRequestFileCard
          canComment={pullRequest.status === "active"}
          createdBy={pullRequest.createdBy}
          file={file}
          key={file.change.changeTrackingId}
          latestIterationId={latestIteration.id}
          projectId={projectId}
          pullRequestId={pullRequest.pullRequestId}
          repositoryId={repositoryId}
        />
      ))}

      <RepositoryPager
        buildHref={(cursor) =>
          `${baseHref}?tab=files${cursor ? `&filesCursor=${encodeURIComponent(cursor)}` : ""}`
        }
        cursor={files.cursor}
        label="Changed files pages"
        nextCursor={files.nextCursor}
        pageSize={25}
      />
    </RepositoryPullRequestFilesLayout>
  );
}
