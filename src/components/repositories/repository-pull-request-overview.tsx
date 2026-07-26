import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import {
  createGeneralPullRequestComment,
  voteOnPullRequest,
} from "@/app/repos/[projectId]/[repositoryId]/pulls/[pullRequestId]/actions";
import { AzureDevOpsMarkupView } from "@/components/azure-devops/azure-devops-markup";
import { IdentityImage } from "@/components/identity-image";
import { RepositoryCheckIcon } from "@/components/repositories/repository-check-icon";
import { RepositoryPullRequestActivity } from "@/components/repositories/repository-pull-request-activity";
import { RepositoryPullRequestCommentForm } from "@/components/repositories/repository-pull-request-comment-form";
import type {
  RepositoryPullRequestData,
  RepositoryPullRequestDiscussionFilter,
} from "@/components/repositories/repository-pull-request-detail";
import { RepositoryPullRequestThread } from "@/components/repositories/repository-pull-request-thread";
import { RepositoryPullRequestVoteForm } from "@/components/repositories/repository-pull-request-vote-form";
import { RepositoryTabNav } from "@/components/repositories/repository-tab-nav";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  AzureGitPolicyEvaluation,
  AzureGitPullRequestReviewer,
  AzureGitPullRequestStatusCheck,
} from "@/lib/azure-devops/git/types";
import type { AzureDevOpsTask } from "@/lib/azure-devops/tasks";
import { getRepositoryHref } from "@/lib/azure-devops/git/urls";
import { getTaskStateBadgeVariant } from "@/lib/tasks/state";
import { getWorkItemTypeMeta } from "@/lib/tasks/work-item-type";
import { DateLabel } from "@/components/date-label";
import { isPullRequestActivityThread } from "@/lib/repositories/pull-request-activity";
import {
  getCheckTone,
  getVotePresentation,
} from "@/lib/repositories/pull-request-presentation";
import { cn } from "@/lib/utils";

function RailSection({
  action,
  children,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-1.5">
        <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Check rows show state as an icon only, so the state has to stay reachable on
 * hover and focus rather than living in a native browser tooltip.
 */
function CheckStateIcon({ state }: { state: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="flex shrink-0 items-center" tabIndex={0} />}
      >
        <RepositoryCheckIcon tone={getCheckTone(state)} />
        <span className="sr-only">{state}</span>
      </TooltipTrigger>
      <TooltipContent side="left" className="capitalize">
        {state}
      </TooltipContent>
    </Tooltip>
  );
}

function ReviewerRow({ reviewer }: { reviewer: AzureGitPullRequestReviewer }) {
  const vote = getVotePresentation(reviewer.vote);
  const VoteIcon = vote.icon;

  return (
    <li className="flex items-center gap-2 px-3 py-1.5">
      <IdentityImage
        imageUrl={reviewer.imageUrl}
        label={reviewer.displayName}
        size="sm"
      />
      <span className="min-w-0 flex-1 truncate text-sm">
        {reviewer.displayName}
        {reviewer.isRequired ? (
          <span className="ml-1.5 text-xs text-muted-foreground">required</span>
        ) : null}
      </span>
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge
              aria-label={vote.label}
              className={cn("shrink-0", vote.className)}
              variant="outline"
            />
          }
        >
          <VoteIcon />
        </TooltipTrigger>
        <TooltipContent side="left">{vote.label}</TooltipContent>
      </Tooltip>
    </li>
  );
}

function Checks({
  policies,
  policiesAvailable,
  statuses,
  statusesAvailable,
}: {
  policies: AzureGitPolicyEvaluation[];
  policiesAvailable: boolean;
  statuses: AzureGitPullRequestStatusCheck[];
  statusesAvailable: boolean;
}) {
  const unavailable = !policiesAvailable || !statusesAvailable;

  if (policies.length === 0 && statuses.length === 0 && !unavailable) {
    return (
      <p className="px-3 py-4 text-center text-sm text-muted-foreground">
        No policies or checks are configured.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {policies.map((policy) => (
        <li
          className="flex min-w-0 items-center gap-2 px-3 py-1.5"
          key={policy.evaluationId}
        >
          <CheckStateIcon state={policy.status} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{policy.type}</span>
            {policy.detail ? (
              <span className="block truncate text-xs text-muted-foreground">
                {policy.detail}
              </span>
            ) : null}
          </span>
          {policy.blocking ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              required
            </span>
          ) : null}
        </li>
      ))}
      {statuses.map((status) => {
        const targetUrl =
          status.targetUrl && /^https?:\/\//i.test(status.targetUrl)
            ? status.targetUrl
            : null;

        return (
          <li
            className="flex min-w-0 items-center gap-2 px-3 py-1.5"
            key={status.id}
          >
            <CheckStateIcon state={status.state} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">
                {status.context.name}
              </span>
              {status.description ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {status.description}
                </span>
              ) : null}
            </span>
            {targetUrl ? (
              <a
                aria-label={`Open ${status.context.name}`}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                href={targetUrl}
                rel="noreferrer noopener"
                target="_blank"
              >
                <ExternalLinkIcon className="size-3.5" />
              </a>
            ) : null}
          </li>
        );
      })}
      {unavailable ? (
        <li className="px-3 py-2 text-xs text-muted-foreground">
          Some checks could not be loaded. Azure DevOps may restrict policy or
          status access for this project.
        </li>
      ) : null}
    </ul>
  );
}

function LinkedWorkItems({
  workItemIds,
  workItems,
}: {
  workItemIds: string[];
  workItems: AzureDevOpsTask[];
}) {
  if (workItemIds.length === 0) {
    return (
      <p className="px-3 py-4 text-center text-sm text-muted-foreground">
        No linked work items.
      </p>
    );
  }

  // Batch loading omits items the current user cannot read (and returns
  // nothing at all when the request fails), so any id without details keeps
  // the old bare-id badge instead of disappearing.
  const detailedIds = new Set(workItems.map((workItem) => String(workItem.id)));
  const undetailedIds = workItemIds.filter(
    (workItemId) => !detailedIds.has(workItemId),
  );

  return (
    <>
      {workItems.length > 0 ? (
        <ul className="divide-y">
          {workItems.map((workItem) => {
            const typeMeta = getWorkItemTypeMeta(workItem.type);
            const TypeIcon = typeMeta.icon;

            return (
              <li key={workItem.id}>
                <Link
                  className="flex items-start gap-2 px-3 py-2 hover:bg-muted/50"
                  href={`/tasks/${workItem.id}`}
                  title={workItem.title}
                >
                  <TypeIcon
                    aria-hidden
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      typeMeta.colorClass,
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {workItem.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {typeMeta.label} #{workItem.id} ·{" "}
                      <span
                        className={cn(
                          getTaskStateBadgeVariant(workItem.state) ===
                            "destructive" && "text-destructive",
                        )}
                      >
                        {workItem.state}
                      </span>{" "}
                      · <DateLabel value={workItem.updatedAt} />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      {undetailedIds.length > 0 ? (
        <div
          className={cn(
            "flex flex-wrap gap-1.5 p-3",
            workItems.length > 0 && "border-t",
          )}
        >
          {undetailedIds.map((workItemId) => (
            <Badge
              key={workItemId}
              render={
                <Link href={`/tasks/${encodeURIComponent(workItemId)}`} />
              }
              variant="secondary"
            >
              #{workItemId}
            </Badge>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function RepositoryPullRequestOverview({
  data,
  discussionFilter,
  projectId,
  repositoryId,
}: {
  data: RepositoryPullRequestData;
  discussionFilter: RepositoryPullRequestDiscussionFilter;
  projectId: string;
  repositoryId: string;
}) {
  const { pullRequest } = data;
  const canComment = pullRequest.status === "active";
  const baseHref = `${getRepositoryHref(
    projectId,
    repositoryId,
  )}/pulls/${pullRequest.pullRequestId}`;
  // Azure DevOps tags system events with a thread type. Without that split,
  // votes, pushes, and policy updates all counted and rendered as discussion.
  const visibleThreads = data.threads.filter((thread) => !thread.isDeleted);
  const activityThreads = visibleThreads.filter(isPullRequestActivityThread);
  // File threads belong in the conversation the way they do in Azure DevOps and
  // GitHub. They were hidden here entirely, so review comments left on code
  // were invisible unless the Files tab happened to be open.
  const conversationThreads = visibleThreads.filter(
    (thread) => !isPullRequestActivityThread(thread),
  );
  const discussionThreads = conversationThreads.filter(
    (thread) =>
      discussionFilter === "all" ||
      thread.status === "active" ||
      thread.status === "pending",
  );
  const currentReviewer = pullRequest.reviewers.find(
    (reviewer) =>
      reviewer.id &&
      data.currentUserId &&
      reviewer.id.toLowerCase() === data.currentUserId.toLowerCase(),
  );
  const commentAction = createGeneralPullRequestComment.bind(null, {
    projectId,
    pullRequestId: pullRequest.pullRequestId,
    repositoryId,
  });
  const voteAction = data.currentUserId
    ? voteOnPullRequest.bind(null, {
        projectId,
        pullRequestId: pullRequest.pullRequestId,
        repositoryId,
        reviewerId: data.currentUserId,
      })
    : null;

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {/* The rail leads on narrow screens: review state decides what to do
          with the pull request, and it must not sit below an unbounded
          discussion thread. */}
      <aside className="flex flex-col gap-3 lg:order-2">
        <RailSection title={`Reviewers (${pullRequest.reviewers.length})`}>
          {pullRequest.reviewers.length > 0 ? (
            <ul className="divide-y">
              {pullRequest.reviewers.map((reviewer) => (
                <ReviewerRow
                  key={reviewer.id ?? reviewer.displayName}
                  reviewer={reviewer}
                />
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No reviewers are assigned.
            </p>
          )}
          {canComment && voteAction ? (
            <div className="border-t p-3">
              <RepositoryPullRequestVoteForm
                action={voteAction}
                vote={currentReviewer?.vote ?? 0}
              />
            </div>
          ) : null}
        </RailSection>

        <RailSection title="Policies and checks">
          <Checks
            policies={data.policies}
            policiesAvailable={data.policiesAvailable}
            statuses={data.statuses}
            statusesAvailable={data.statusesAvailable}
          />
        </RailSection>

        <RailSection title="Linked work items">
          <LinkedWorkItems
            workItemIds={pullRequest.workItemIds}
            workItems={data.workItems}
          />
        </RailSection>
      </aside>

      <div className="flex min-w-0 flex-col gap-3 lg:order-1">
        <section className="overflow-hidden rounded-lg border bg-card">
          <h2 className="border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Description
          </h2>
          <div className="p-3">
            <AzureDevOpsMarkupView
              blockExternalImages
              className="prose-sm"
              emptyMessage="No description was provided."
              markup={{
                content: pullRequest.description ?? "",
                format: "markdown",
              }}
            />
          </div>
        </section>

        {/* Threads are standalone cards separated by whitespace. Wrapping them
            in another bordered box nested a card inside a card and erased the
            boundary between one conversation and the next. */}
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-medium text-muted-foreground">
              Discussion ({conversationThreads.length})
            </h2>
            <RepositoryTabNav
              ariaLabel="Discussion filter"
              items={[
                {
                  active: discussionFilter === "active",
                  href: baseHref,
                  label: "Active",
                },
                {
                  active: discussionFilter === "all",
                  href: `${baseHref}?discussion=all`,
                  label: "All",
                },
              ]}
              size="sm"
            />
          </div>

          {discussionThreads.length > 0 ? (
            <ol className="flex flex-col gap-3">
              {discussionThreads.map((thread) => (
                <li key={thread.id}>
                  <RepositoryPullRequestThread
                    canComment={canComment}
                    createdBy={pullRequest.createdBy}
                    projectId={projectId}
                    pullRequestId={pullRequest.pullRequestId}
                    repositoryId={repositoryId}
                    snippet={data.threadSnippets[thread.id]}
                    thread={thread}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
              {discussionFilter === "active"
                ? "No active discussion threads."
                : "No discussion threads yet."}
            </p>
          )}

          {canComment ? (
            <div className="rounded-lg border bg-card p-3">
              <RepositoryPullRequestCommentForm action={commentAction} />
            </div>
          ) : (
            <p className="rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
              This pull request is {pullRequest.status}; comments and votes are
              read-only here.
            </p>
          )}
        </section>

        <RepositoryPullRequestActivity threads={activityThreads} />
      </div>
    </div>
  );
}
