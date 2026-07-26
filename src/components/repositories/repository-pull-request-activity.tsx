import {
  GitCommitHorizontalIcon,
  GitPullRequestDraftIcon,
  ShieldCheckIcon,
  UserPlusIcon,
} from "lucide-react";
import { DateLabel } from "@/components/date-label";
import { IdentityImage } from "@/components/identity-image";
import type { AzureGitPullRequestThread } from "@/lib/azure-devops/git/types";
import { describePullRequestActivity } from "@/lib/repositories/pull-request-activity";
import {
  getCheckToneTextClassName,
  getVotePresentation,
} from "@/lib/repositories/pull-request-presentation";
import { cn } from "@/lib/utils";

const ACTIVITY_ICONS = {
  isDraftUpdate: GitPullRequestDraftIcon,
  other: ShieldCheckIcon,
  policyStatusUpdate: ShieldCheckIcon,
  refUpdate: GitCommitHorizontalIcon,
  reviewersUpdate: UserPlusIcon,
  statusUpdate: ShieldCheckIcon,
  voteUpdate: ShieldCheckIcon,
} as const;

/**
 * A vote already has an icon and a tone defined alongside every other place a
 * vote is rendered, so the activity row reuses those rather than picking its
 * own symbol for the same outcome.
 */
function ActivityIcon({ thread }: { thread: AzureGitPullRequestThread }) {
  const activity = thread.activity;

  if (activity?.type === "voteUpdate" && activity.voteResult !== null) {
    const vote = getVotePresentation(activity.voteResult);
    const VoteIcon = vote.icon;

    return (
      <VoteIcon
        className={cn(
          "size-3.5 shrink-0",
          getCheckToneTextClassName(vote.tone),
        )}
      />
    );
  }

  const Icon = ACTIVITY_ICONS[activity?.type ?? "other"];

  return <Icon className="size-3.5 shrink-0 text-muted-foreground" />;
}

/**
 * Activity is rendered as a compact timeline rather than as comment cards. Bot
 * and system events outnumber real replies on most pull requests, and giving
 * them the same treatment turned the conversation into an undifferentiated wall.
 */
export function RepositoryPullRequestActivity({
  threads,
}: {
  threads: AzureGitPullRequestThread[];
}) {
  if (threads.length === 0) {
    return null;
  }

  // Azure DevOps returns activity oldest first. Every other list in the app
  // leads with the most recent entry, and the newest event is the one worth
  // seeing without scrolling.
  const ordered = [...threads].sort((left, right) => {
    const byDate = (right.publishedDate ?? "").localeCompare(
      left.publishedDate ?? "",
    );

    return byDate || right.id - left.id;
  });

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <h2 className="border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        Activity ({threads.length})
      </h2>
      <ol className="divide-y">
        {ordered.map((thread) => {
          // Azure DevOps authors most activity comments as its own service
          // account, so the actor named in the thread properties is preferred
          // and the comment author is only a fallback.
          const author =
            thread.activity?.actor ??
            thread.comments.find((comment) => !comment.isDeleted)?.author;

          return (
            <li
              className="flex min-w-0 items-center gap-2 px-3 py-1.5"
              key={thread.id}
            >
              <ActivityIcon thread={thread} />
              {author ? (
                <IdentityImage
                  className="shrink-0"
                  imageUrl={author.imageUrl}
                  label={author.displayName}
                  size="sm"
                />
              ) : null}
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {describePullRequestActivity(thread)}
              </span>
              {thread.publishedDate ? (
                <DateLabel
                  className="shrink-0 text-xs text-muted-foreground"
                  value={thread.publishedDate}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
