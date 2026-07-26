import { stripRefPrefix } from "@/lib/azure-devops/git/urls";
import type {
  AzureGitPullRequestThread,
  AzureGitPullRequestThreadActivity,
  AzureGitPullRequestVote,
} from "@/lib/azure-devops/git/types";

const VOTE_VERBS: Record<AzureGitPullRequestVote, string> = {
  "-10": "rejected this pull request",
  "-5": "is waiting for the author",
  "0": "reset their vote",
  "5": "approved with suggestions",
  "10": "approved this pull request",
};

/**
 * Azure DevOps records pull request activity as system comments whose text
 * leaks raw API values, most visibly `voted 10`. The thread properties carry
 * the same events in structured form, so the label is built from those and the
 * comment text is only a fallback for events without a known shape.
 */
export function describePullRequestActivity(
  thread: AzureGitPullRequestThread,
): string {
  const activity = thread.activity;
  const fallback =
    thread.comments.find((comment) => !comment.isDeleted)?.content.trim() ?? "";
  const actor =
    activity?.actor?.displayName ??
    thread.comments.find((comment) => !comment.isDeleted)?.author.displayName;

  if (!activity) {
    return fallback;
  }

  switch (activity.type) {
    case "voteUpdate": {
      if (activity.voteResult === null || !actor) {
        return fallback;
      }

      return `${actor} ${VOTE_VERBS[activity.voteResult]}`;
    }
    case "refUpdate": {
      if (!activity.refName) {
        return fallback;
      }

      const branch = stripRefPrefix(activity.refName);
      const count = activity.newCommitCount;

      return count && count > 0
        ? `Pushed ${count} ${count === 1 ? "commit" : "commits"} to ${branch}`
        : `Updated ${branch}`;
    }
    case "policyStatusUpdate":
      return "Policy status updated";
    default:
      return fallback;
  }
}

export function isPullRequestActivityThread(thread: AzureGitPullRequestThread) {
  return thread.activity !== null;
}

export function getPullRequestActivityIconKind(
  activity: AzureGitPullRequestThreadActivity | null,
) {
  return activity?.type ?? "other";
}
