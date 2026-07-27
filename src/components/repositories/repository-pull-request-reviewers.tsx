import { IdentityImage } from "@/components/identity-image";
import { RepositoryCheckIcon } from "@/components/repositories/repository-check-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AzureGitPullRequestReviewer } from "@/lib/azure-devops/git/types";
import { getVotePresentation } from "@/lib/repositories/pull-request-presentation";

/**
 * Deliberately not an overlapping stack. Each avatar carries a vote badge on
 * its lower right, which is exactly the area an overlap would cover, so the
 * avatars stay spaced and the list caps instead.
 */
const MAX_VISIBLE_REVIEWERS = 4;

/**
 * Azure DevOps returns reviewers and their votes on the list endpoint, so the
 * review state of every pull request is available without an extra request.
 * Votes reuse the shared vote presentation rather than defining new colours.
 */
export function RepositoryPullRequestReviewers({
  reviewers,
}: {
  reviewers: AzureGitPullRequestReviewer[];
}) {
  if (reviewers.length === 0) {
    return null;
  }

  // A blocking vote is the reason to open the pull request, so it leads.
  const ordered = [...reviewers].sort((left, right) => {
    if (left.vote !== right.vote) {
      return left.vote - right.vote;
    }

    return Number(right.isRequired) - Number(left.isRequired);
  });
  const visible = ordered.slice(0, MAX_VISIBLE_REVIEWERS);
  const overflow = ordered.length - visible.length;

  // Positioned so the avatars stay above a stretched row link and keep their
  // tooltips hoverable.
  return (
    <span className="relative flex shrink-0 items-center gap-1">
      {visible.map((reviewer) => {
        const vote = getVotePresentation(reviewer.vote);

        return (
          <Tooltip key={reviewer.id ?? reviewer.displayName}>
            <TooltipTrigger render={<span className="relative inline-flex" />}>
              <IdentityImage
                imageUrl={reviewer.imageUrl}
                label={reviewer.displayName}
                size="sm"
              />
              {reviewer.vote === 0 ? null : (
                <RepositoryCheckIcon
                  className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-card"
                  tone={vote.tone}
                />
              )}
            </TooltipTrigger>
            <TooltipContent>
              {reviewer.displayName} — {vote.label}
              {reviewer.isRequired ? " (required)" : ""}
            </TooltipContent>
          </Tooltip>
        );
      })}
      {overflow > 0 ? (
        <span className="text-xs text-muted-foreground">+{overflow}</span>
      ) : null}
    </span>
  );
}
