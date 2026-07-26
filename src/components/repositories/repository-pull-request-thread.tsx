import Link from "next/link";
import { ThumbsUpIcon } from "lucide-react";
import {
  changePullRequestThreadStatus,
  replyToPullRequestComment,
} from "@/app/repos/[projectId]/[repositoryId]/pulls/[pullRequestId]/actions";
import { AzureDevOpsMarkupView } from "@/components/azure-devops/azure-devops-markup";
import { DateLabel } from "@/components/date-label";
import { IdentityImage } from "@/components/identity-image";
import { RepositoryPathIcon } from "@/components/repositories/repository-path-icon";
import { RepositoryPullRequestCommentForm } from "@/components/repositories/repository-pull-request-comment-form";
import { RepositoryPullRequestThreadControl } from "@/components/repositories/repository-pull-request-thread-control";
import { RepositoryPullRequestResolveButton } from "@/components/repositories/repository-pull-request-resolve-button";
import { RepositoryPullRequestThreadSnippet } from "@/components/repositories/repository-pull-request-thread-snippet";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  AzureGitIdentity,
  AzureGitPullRequestThread,
} from "@/lib/azure-devops/git/types";
import { getRepositoryHref } from "@/lib/azure-devops/git/urls";
import { getThreadStatusPresentation } from "@/lib/repositories/pull-request-presentation";
import {
  formatPullRequestThreadLineRange,
  getPullRequestThreadLineRange,
  type PullRequestThreadSnippetLine,
} from "@/lib/repositories/pull-request-threads";
import { cn } from "@/lib/utils";

export function RepositoryPullRequestThread({
  canComment,
  createdBy,
  projectId,
  pullRequestId,
  repositoryId,
  snippet,
  thread,
}: {
  canComment: boolean;
  createdBy: AzureGitIdentity | null;
  projectId: string;
  pullRequestId: number;
  repositoryId: string;
  snippet?: PullRequestThreadSnippetLine[];
  thread: AzureGitPullRequestThread;
}) {
  /* Matched on identity id; display names are not unique. */
  const isPullRequestAuthor = (author: AzureGitIdentity) =>
    Boolean(createdBy?.id && author.id && createdBy.id === author.id);
  const comments = thread.comments.filter((comment) => !comment.isDeleted);
  const lineRange = thread.filePath
    ? getPullRequestThreadLineRange(thread)
    : null;
  const fileName = thread.filePath?.split("/").pop() ?? "";
  const directory = thread.filePath?.slice(
    0,
    Math.max(0, thread.filePath.length - fileName.length - 1),
  );
  const rootComment = comments.find((comment) => comment.parentCommentId === 0);
  const hasUserComment = comments.some((comment) => comment.type !== "system");
  const status = getThreadStatusPresentation(thread.status);
  const isResolved =
    thread.status === "fixed" ||
    thread.status === "closed" ||
    thread.status === "byDesign" ||
    thread.status === "wontFix";
  const statusAction = changePullRequestThreadStatus.bind(null, {
    projectId,
    pullRequestId,
    repositoryId,
    threadId: thread.id,
  });
  const replyAction = rootComment
    ? replyToPullRequestComment.bind(null, {
        parentCommentId: rootComment.id,
        projectId,
        pullRequestId,
        repositoryId,
        threadId: thread.id,
      })
    : null;

  if (comments.length === 0) {
    return null;
  }

  return (
    /* One bordered card per thread. Rendering every comment as its own card
       inside a bordered list produced three competing border weights and no
       visible thread boundaries. */
    <article
      className="scroll-mt-24 overflow-hidden rounded-lg border bg-card"
      id={`thread-${thread.id}`}
    >
      {/* Status is shown once, as the control itself, on the thread header row.
          A separate badge plus a dropdown in the reply footer stated the same
          thing twice and put the action far from the state it changes. */}
      <header className="flex min-w-0 flex-wrap items-start gap-2 border-b bg-muted/30 px-3 py-1.5">
        {thread.filePath ? (
          /* The file name identifies the thread, so it is never the part that
             truncates. Only the leading directories give way. */
          <Link
            className="group/path flex min-w-0 flex-1 flex-col gap-0.5"
            href={`${getRepositoryHref(
              projectId,
              repositoryId,
            )}/pulls/${pullRequestId}?tab=files&threadId=${thread.id}#thread-${thread.id}`}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <RepositoryPathIcon
                className="size-3.5"
                kind="file"
                path={thread.filePath}
              />
              <span className="truncate font-mono text-xs font-medium group-hover/path:underline">
                {fileName}
              </span>
              {lineRange ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatPullRequestThreadLineRange(lineRange)}
                </span>
              ) : null}
            </span>
            {directory ? (
              <span className="truncate font-mono text-xs text-muted-foreground">
                {directory}
              </span>
            ) : null}
          </Link>
        ) : null}
        {/* A pull request level thread has no file context, so the header is
            just its status rather than a filler comment count. */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {canComment && hasUserComment ? (
            <RepositoryPullRequestThreadControl
              action={statusAction}
              status={thread.status}
            />
          ) : (
            <Badge className={status.className} variant="outline">
              {status.label}
            </Badge>
          )}
        </div>
      </header>

      {snippet && snippet.length > 0 ? (
        <RepositoryPullRequestThreadSnippet lines={snippet} />
      ) : null}

      <ol className={cn("divide-y", isResolved && "opacity-75")}>
        {comments.map((comment) => {
          const isReply = comment.parentCommentId !== 0;

          return (
            <li
              className={cn(
                "px-3 py-2.5",
                // Replies align under the author line of the comment they
                // answer, so a long thread reads as a conversation.
                isReply && "border-l-2 border-muted/60 pl-5",
                comment.type === "system" && "bg-muted/20",
              )}
              key={comment.id}
            >
              <div className="flex min-w-0 items-center gap-2">
                <IdentityImage
                  className="shrink-0"
                  imageUrl={comment.author.imageUrl}
                  label={comment.author.displayName}
                  size="sm"
                />
                <span className="truncate text-sm font-medium">
                  {comment.author.displayName}
                </span>
                {isPullRequestAuthor(comment.author) ? (
                  <Badge className="shrink-0" variant="secondary">
                    Author
                  </Badge>
                ) : null}
                {comment.publishedDate ? (
                  <DateLabel
                    className="shrink-0 text-xs text-muted-foreground"
                    value={comment.publishedDate}
                  />
                ) : null}
                {comment.usersLiked.length > 0 ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Badge
                          aria-label={`${comment.usersLiked.length} likes`}
                          className="ml-auto shrink-0"
                          variant="outline"
                        />
                      }
                    >
                      <ThumbsUpIcon />
                      {comment.usersLiked.length}
                    </TooltipTrigger>
                    <TooltipContent>
                      Liked by{" "}
                      {comment.usersLiked
                        .map((identity) => identity.displayName)
                        .join(", ")}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              <AzureDevOpsMarkupView
                blockExternalImages
                className="prose-sm mt-1.5 pl-8"
                emptyMessage="No comment text."
                markup={{
                  content: comment.content,
                  format: comment.type === "system" ? "unknown" : "markdown",
                }}
              />
            </li>
          );
        })}
      </ol>

      {/* The composer owns the resolve button so the two never split across
          rows: collapsed they share the single line, open the resolve action
          joins Cancel and Reply on the bottom row. */}
      {canComment && hasUserComment && replyAction ? (
        <div className="border-t bg-muted/20 p-3">
          <RepositoryPullRequestCommentForm
            action={replyAction}
            collapsible
            placeholder="Write a reply…"
            secondaryActions={
              <RepositoryPullRequestResolveButton
                action={statusAction}
                isResolved={isResolved}
              />
            }
            submitLabel="Reply"
          />
        </div>
      ) : null}
    </article>
  );
}
