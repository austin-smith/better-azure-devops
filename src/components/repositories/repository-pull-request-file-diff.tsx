"use client";

import type { DiffLineAnnotation } from "@pierre/diffs";
import type { PreloadMultiFileDiffResult } from "@pierre/diffs/ssr";
import { useCallback, useMemo, useState } from "react";
import { RepositoryMultiFileDiff } from "@/components/repositories/repository-multi-file-diff";
import { RepositoryPullRequestThread } from "@/components/repositories/repository-pull-request-thread";
import type {
  AzureGitIdentity,
  AzureGitPullRequestThread,
} from "@/lib/azure-devops/git/types";
import type { PullRequestActionState } from "@/lib/repositories/pull-request-action-state";

/**
 * Pull request file diff with review threads rendered inline at the lines
 * they discuss, the way Azure DevOps and GitHub anchor review comments.
 * Threads whose line is not part of the rendered diff (deleted context,
 * unexpanded hunks) fall back to a list below the diff so nothing is lost.
 */
export function RepositoryPullRequestFileDiff({
  ariaLabel,
  canComment,
  commentAction,
  createdBy,
  preloadedDiff,
  projectId,
  pullRequestId,
  repositoryId,
}: {
  ariaLabel: string;
  canComment: boolean;
  commentAction?: (
    previousState: PullRequestActionState,
    formData: FormData,
  ) => Promise<PullRequestActionState>;
  createdBy: AzureGitIdentity | null;
  preloadedDiff: PreloadMultiFileDiffResult<AzureGitPullRequestThread>;
  projectId: string;
  pullRequestId: number;
  repositoryId: string;
}) {
  const { annotations, newFile, oldFile, options, prerenderedHTML } =
    preloadedDiff;
  const [unanchoredKeys, setUnanchoredKeys] = useState<readonly string[]>([]);
  const getAnnotationKey = useCallback(
    (annotation: DiffLineAnnotation<AzureGitPullRequestThread>) =>
      String(annotation.metadata.id),
    [],
  );
  const renderThread = useCallback(
    (annotation: DiffLineAnnotation<AzureGitPullRequestThread>) => (
      <div className="px-2 py-1.5">
        <RepositoryPullRequestThread
          canComment={canComment}
          createdBy={createdBy}
          projectId={projectId}
          pullRequestId={pullRequestId}
          repositoryId={repositoryId}
          thread={annotation.metadata}
        />
      </div>
    ),
    [canComment, createdBy, projectId, pullRequestId, repositoryId],
  );
  const unanchoredThreads = useMemo(() => {
    if (unanchoredKeys.length === 0) {
      return [];
    }

    const threadsById = new Map(
      (annotations ?? []).map((annotation) => [
        String(annotation.metadata.id),
        annotation.metadata,
      ]),
    );

    return unanchoredKeys.flatMap((key) => {
      const thread = threadsById.get(key);

      return thread ? [thread] : [];
    });
  }, [annotations, unanchoredKeys]);

  return (
    <>
      <RepositoryMultiFileDiff
        annotations={annotations}
        ariaLabel={ariaLabel}
        commentAction={commentAction}
        getAnnotationKey={getAnnotationKey}
        newFile={newFile}
        oldFile={oldFile}
        onUnanchoredAnnotationsChange={setUnanchoredKeys}
        options={options}
        prerenderedHTML={prerenderedHTML}
        renderAnnotation={renderThread}
        syncSelectionHash={false}
      />
      {unanchoredThreads.length > 0 ? (
        <div className="flex flex-col gap-3 border-t p-3">
          <h3 className="text-xs font-medium text-muted-foreground">
            Comments on lines outside the rendered diff
          </h3>
          {unanchoredThreads.map((thread) => (
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
    </>
  );
}
