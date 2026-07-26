import {
  BanIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  CircleIcon,
  Clock3Icon,
  GitMergeIcon,
  GitPullRequestArrowIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  XCircleIcon,
} from "lucide-react";
import { getAzureGitChangeTypes } from "@/lib/azure-devops/git/change-types";
import type {
  AzureGitPullRequest,
  AzureGitPullRequestReviewer,
  AzureGitPullRequestThreadStatus,
  AzureGitPullRequestVote,
} from "@/lib/azure-devops/git/types";

/**
 * Pull request state, review votes, and check results were each styled
 * independently across the detail view, so the same outcome could appear in
 * three different colours. Every presentation decision now resolves here.
 */
const POSITIVE_TONE =
  "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-300";
const NEGATIVE_TONE = "border-destructive/30 bg-destructive/10 text-destructive";
const PENDING_TONE =
  "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:text-amber-300";
const NEUTRAL_TONE = "border-border bg-muted text-muted-foreground";

export type CheckTone = "negative" | "neutral" | "pending" | "positive";

const CHECK_TONE_CLASS: Record<CheckTone, string> = {
  negative: NEGATIVE_TONE,
  neutral: NEUTRAL_TONE,
  pending: PENDING_TONE,
  positive: POSITIVE_TONE,
};

const CHECK_TONE_TEXT: Record<CheckTone, string> = {
  negative: "text-destructive",
  neutral: "text-muted-foreground",
  pending: "text-amber-600 dark:text-amber-400",
  positive: "text-emerald-600 dark:text-emerald-400",
};

const CHECK_TONE_ICON = {
  negative: XCircleIcon,
  neutral: CircleIcon,
  pending: Clock3Icon,
  positive: CheckCircle2Icon,
} as const;

export function getCheckTone(state: string): CheckTone {
  const value = state.toLowerCase();

  if (
    ["approved", "completed", "succeeded", "succeededwithissues"].includes(
      value,
    )
  ) {
    return "positive";
  }

  if (["broken", "error", "failed", "rejected"].includes(value)) {
    return "negative";
  }

  if (value === "notapplicable") {
    return "neutral";
  }

  if (["notset", "pending", "queued", "running"].includes(value)) {
    return "pending";
  }

  return "neutral";
}

export function getCheckToneClassName(tone: CheckTone) {
  return CHECK_TONE_CLASS[tone];
}

export function getCheckToneTextClassName(tone: CheckTone) {
  return CHECK_TONE_TEXT[tone];
}

export function getCheckToneIcon(tone: CheckTone) {
  return CHECK_TONE_ICON[tone];
}

export type ChangeTypePresentation = {
  className: string;
  label: string;
  letter: string;
};

/**
 * Azure DevOps change types are comma-separated flags, so a renamed file with
 * edits arrives as "edit, rename". Precedence picks the flag a reviewer cares
 * about most: whether the file is new or gone outranks how it got that way.
 */
export function getChangeTypePresentation(
  changeType: string,
): ChangeTypePresentation {
  const types = getAzureGitChangeTypes(changeType);

  if (types.has("delete")) {
    return {
      className: "text-destructive",
      label: "Deleted",
      letter: "D",
    };
  }

  if (types.has("add") || types.has("undelete")) {
    return {
      className: "text-emerald-600 dark:text-emerald-400",
      label: "Added",
      letter: "A",
    };
  }

  if (types.has("rename")) {
    return {
      className: "text-purple-600 dark:text-purple-400",
      label: "Renamed",
      letter: "R",
    };
  }

  // Modified is the default state of a file in a pull request, so it stays
  // in the default foreground; only exceptional states carry colour.
  return {
    className: "",
    label: "Modified",
    letter: "M",
  };
}

export function getPullRequestStatePresentation(
  pullRequest: Pick<AzureGitPullRequest, "isDraft" | "status">,
) {
  const status = pullRequest.status.toLowerCase();

  if (status === "active" && pullRequest.isDraft) {
    return {
      className: NEUTRAL_TONE,
      icon: GitPullRequestDraftIcon,
      label: "Draft",
      tone: "neutral" as const,
    };
  }

  switch (status) {
    case "completed":
      return {
        className: POSITIVE_TONE,
        icon: GitMergeIcon,
        label: "Completed",
        tone: "positive" as const,
      };
    case "abandoned":
      return {
        className: NEGATIVE_TONE,
        icon: GitPullRequestClosedIcon,
        label: "Abandoned",
        tone: "negative" as const,
      };
    default:
      return {
        className: PENDING_TONE,
        icon: GitPullRequestArrowIcon,
        label: "Active",
        tone: "pending" as const,
      };
  }
}

const VOTE_PRESENTATION: Record<
  AzureGitPullRequestVote,
  {
    className: string;
    icon: typeof CheckCircle2Icon;
    label: string;
    tone: CheckTone;
  }
> = {
  "-10": {
    className: NEGATIVE_TONE,
    icon: BanIcon,
    label: "Rejected",
    tone: "negative",
  },
  "-5": {
    className: PENDING_TONE,
    icon: Clock3Icon,
    label: "Waiting for author",
    tone: "pending",
  },
  "0": {
    className: NEUTRAL_TONE,
    icon: CircleDotIcon,
    label: "No vote",
    tone: "neutral",
  },
  "5": {
    className: POSITIVE_TONE,
    icon: CheckCircle2Icon,
    label: "Approved with suggestions",
    tone: "positive",
  },
  "10": {
    className: POSITIVE_TONE,
    icon: CheckCircle2Icon,
    label: "Approved",
    tone: "positive",
  },
};

export function getVotePresentation(vote: AzureGitPullRequestVote) {
  return VOTE_PRESENTATION[vote];
}

export function getPullRequestReviewSummary(
  reviewers: readonly AzureGitPullRequestReviewer[],
) {
  const requiredReviewers = reviewers.filter(
    (reviewer) => reviewer.isRequired,
  );
  const approvals = reviewers.filter((reviewer) => reviewer.vote > 0).length;
  const requiredApprovals = requiredReviewers.filter(
    (reviewer) => reviewer.vote > 0,
  ).length;
  const rejections = reviewers.filter(
    (reviewer) => reviewer.vote === -10,
  ).length;

  if (requiredReviewers.length > 0) {
    return {
      label: `${requiredApprovals} of ${requiredReviewers.length} required approvals`,
      tone:
        rejections > 0
          ? ("negative" as const)
          : requiredApprovals >= requiredReviewers.length
            ? ("positive" as const)
            : ("pending" as const),
    };
  }

  return {
    label: `${approvals} ${approvals === 1 ? "approval" : "approvals"}`,
    tone: rejections > 0 ? ("negative" as const) : ("pending" as const),
  };
}

const THREAD_STATUS_PRESENTATION: Record<
  AzureGitPullRequestThreadStatus,
  { className: string; label: string }
> = {
  active: { className: PENDING_TONE, label: "Active" },
  byDesign: { className: POSITIVE_TONE, label: "By design" },
  closed: { className: NEUTRAL_TONE, label: "Closed" },
  fixed: { className: POSITIVE_TONE, label: "Resolved" },
  pending: { className: PENDING_TONE, label: "Pending" },
  unknown: { className: NEUTRAL_TONE, label: "Discussion" },
  wontFix: { className: NEUTRAL_TONE, label: "Won't fix" },
};

export function getThreadStatusPresentation(
  status: AzureGitPullRequestThreadStatus,
) {
  return THREAD_STATUS_PRESENTATION[status];
}

/**
 * Azure DevOps reports merge state as a loose string, so only the values that
 * change what a reviewer should do are surfaced as a merge verdict.
 */
export function getMergeStatePresentation(mergeStatus: string | null) {
  switch (mergeStatus?.toLowerCase()) {
    case "conflicts":
      return {
        description: "This branch has conflicts with the target branch.",
        label: "Conflicts",
        tone: "negative" as const,
      };
    case "failure":
      return {
        description: "Azure DevOps could not merge this pull request.",
        label: "Merge failed",
        tone: "negative" as const,
      };
    case "rejectedbypolicy":
      return {
        description: "A branch policy rejected this pull request.",
        label: "Policy rejected",
        tone: "negative" as const,
      };
    case "notset":
    case "queued":
      return {
        description: "Azure DevOps is still evaluating the merge.",
        label: "Merge pending",
        tone: "pending" as const,
      };
    case "succeeded":
      return {
        description: "No conflicts with the target branch.",
        label: "Mergeable",
        tone: "positive" as const,
      };
    default:
      return null;
  }
}
