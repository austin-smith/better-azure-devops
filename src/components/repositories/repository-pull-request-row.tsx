import Link from "next/link";
import { DateLabel } from "@/components/date-label";
import { IdentityImage } from "@/components/identity-image";
import { RepositoryPullRequestReviewers } from "@/components/repositories/repository-pull-request-reviewers";
import { Badge } from "@/components/ui/badge";
import type { AzureGitPullRequest } from "@/lib/azure-devops/git/types";
import {
  getRepositoryHref,
  stripRefPrefix,
} from "@/lib/azure-devops/git/urls";
import {
  getCheckToneClassName,
  getCheckToneTextClassName,
  getMergeStatePresentation,
  getPullRequestStatePresentation,
} from "@/lib/repositories/pull-request-presentation";
import { cn } from "@/lib/utils";

/**
 * Shared by the repository pull request list and the dashboard so the two can
 * not drift apart. The dashboard spans repositories, so it also names the
 * repository each pull request belongs to.
 */
export function RepositoryPullRequestRow({
  pullRequest,
  showRepository = false,
}: {
  pullRequest: AzureGitPullRequest;
  showRepository?: boolean;
}) {
  const state = getPullRequestStatePresentation(pullRequest);
  const StateIcon = state.icon;
  const merge = getMergeStatePresentation(pullRequest.mergeStatus);
  const href = `${getRepositoryHref(
    pullRequest.repository.projectId,
    pullRequest.repository.id,
  )}/pulls/${pullRequest.pullRequestId}`;

  return (
    <li className="flex min-w-0 items-center gap-2.5 px-3 py-2 transition-colors hover:bg-muted/50">
      {/* The author identifies the row, so their avatar leads it rather than
          trailing at the far right edge. */}
      {pullRequest.createdBy ? (
        <IdentityImage
          className="shrink-0"
          imageUrl={pullRequest.createdBy.imageUrl}
          label={pullRequest.createdBy.displayName}
          size="sm"
        />
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <StateIcon
            aria-label={state.label}
            className={cn(
              "size-3.5 shrink-0",
              getCheckToneTextClassName(state.tone),
            )}
          />
          <Link
            className="truncate text-sm font-medium hover:underline"
            href={href}
          >
            {pullRequest.title}
          </Link>
          {pullRequest.isDraft ? (
            <Badge className="shrink-0" variant="outline">
              Draft
            </Badge>
          ) : null}
          {merge?.tone === "negative" ? (
            <Badge
              className={cn("shrink-0", getCheckToneClassName("negative"))}
              variant="outline"
            >
              {merge.label}
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {showRepository ? (
            <>
              <span className="truncate font-medium text-foreground">
                {pullRequest.repository.name}
              </span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span className="font-mono">#{pullRequest.pullRequestId}</span>
          {pullRequest.creationDate ? (
            <>
              <span aria-hidden="true">·</span>
              <DateLabel value={pullRequest.creationDate} />
            </>
          ) : null}
          {pullRequest.createdBy ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">
                {pullRequest.createdBy.displayName}
              </span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span className="min-w-0 truncate font-mono">
            {stripRefPrefix(pullRequest.sourceRefName)} →{" "}
            {stripRefPrefix(pullRequest.targetRefName)}
          </span>
        </p>
      </div>

      <RepositoryPullRequestReviewers reviewers={pullRequest.reviewers} />
    </li>
  );
}
