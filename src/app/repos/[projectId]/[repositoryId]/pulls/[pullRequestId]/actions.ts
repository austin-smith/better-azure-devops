"use server";

import { revalidatePath } from "next/cache";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { describeAzureDevOpsError } from "@/lib/azure-devops/errors";
import {
  createPullRequestThread,
  replyToPullRequestThread,
  setPullRequestReviewerVote,
  updatePullRequestThreadStatus,
} from "@/lib/azure-devops/git/pull-requests";
import type {
  AzureGitPullRequestThreadStatus,
  AzureGitPullRequestVote,
} from "@/lib/azure-devops/git/types";
import {
  getRepositoryHref,
  normalizeRepositoryPath,
} from "@/lib/azure-devops/git/urls";
import type { PullRequestActionState } from "@/lib/repositories/pull-request-action-state";

const MAX_COMMENT_LENGTH = 100_000;

/**
 * A thread's span is described by `CommentPosition`, whose `offset` is a
 * character position within the line. The 7.1 reference says it starts at 0 and
 * the 7.2 reference says it starts at 1; the worked example is identical in
 * both and starts a line's span at 1, so the 7.1 wording is stale. The end
 * position is documented as the position of the span's *last* character, so it
 * is inclusive rather than one-past-the-end.
 *
 * Selection here is whole lines, never a character range, so the end has to be
 * the last character of the line. Rather than measure the line, this writes the
 * same fixed value Azure DevOps' own review UI writes for a line-granularity
 * comment, which its API accepts and clamps to the true end of the line. That
 * is observed behaviour and not documented anywhere: every line comment in this
 * organization authored through Azure DevOps stores exactly this pair. A line
 * longer than the value would be spanned only up to it, which is equally true
 * of comments left through Azure DevOps itself.
 */
const LINE_START_OFFSET = 1;
const LINE_END_OFFSET = 1000;

type PullRequestActionContext = {
  projectId: string;
  pullRequestId: number;
  repositoryId: string;
};

function isPositiveInteger(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

function validateContext(context: PullRequestActionContext) {
  return (
    context.projectId.trim().length > 0 &&
    context.projectId.length <= 200 &&
    context.repositoryId.trim().length > 0 &&
    context.repositoryId.length <= 200 &&
    isPositiveInteger(context.pullRequestId)
  );
}

function readCommentContent(formData: FormData) {
  const value = formData.get("content");
  const content = typeof value === "string" ? value : "";

  if (!content.trim()) {
    return {
      error: "Enter a comment before submitting.",
      value: null,
    } as const;
  }

  if (content.length > MAX_COMMENT_LENGTH) {
    return {
      error: `Comments must be ${MAX_COMMENT_LENGTH.toLocaleString()} characters or fewer.`,
      value: null,
    } as const;
  }

  return { error: null, value: content } as const;
}

function getActionErrorMessage(error: unknown) {
  const descriptor = describeAzureDevOpsError(error);

  if (descriptor.kind === "forbidden") {
    return "You do not have permission to update this pull request.";
  }

  if (descriptor.kind === "authentication-required") {
    return "Azure CLI authentication expired. Sign in again and retry.";
  }

  if (descriptor.kind === "throttled") {
    return "Azure DevOps is limiting requests. Wait briefly and retry.";
  }

  return descriptor.message;
}

function revalidatePullRequest(context: PullRequestActionContext) {
  revalidatePath(
    `${getRepositoryHref(
      context.projectId,
      context.repositoryId,
    )}/pulls/${context.pullRequestId}`,
  );
}

export async function createGeneralPullRequestComment(
  context: PullRequestActionContext,
  _previousState: PullRequestActionState,
  formData: FormData,
): Promise<PullRequestActionState> {
  if (!validateContext(context)) {
    return { message: "Invalid pull request.", status: "error" };
  }

  const content = readCommentContent(formData);

  if (!content.value) {
    return {
      message: content.error ?? "Enter a comment before submitting.",
      status: "error",
    };
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();

    await createPullRequestThread(
      accessToken,
      context.projectId,
      context.repositoryId,
      context.pullRequestId,
      { content: content.value },
    );
    revalidatePullRequest(context);

    return { message: "Comment added.", status: "success" };
  } catch (error) {
    return { message: getActionErrorMessage(error), status: "error" };
  }
}

export async function replyToPullRequestComment(
  context: PullRequestActionContext & {
    parentCommentId: number;
    threadId: number;
  },
  _previousState: PullRequestActionState,
  formData: FormData,
): Promise<PullRequestActionState> {
  if (
    !validateContext(context) ||
    !isPositiveInteger(context.threadId) ||
    !isPositiveInteger(context.parentCommentId)
  ) {
    return { message: "Invalid pull request thread.", status: "error" };
  }

  const content = readCommentContent(formData);

  if (!content.value) {
    return {
      message: content.error ?? "Enter a comment before submitting.",
      status: "error",
    };
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();

    await replyToPullRequestThread(
      accessToken,
      context.projectId,
      context.repositoryId,
      context.pullRequestId,
      context.threadId,
      context.parentCommentId,
      content.value,
    );
    revalidatePullRequest(context);

    return { message: "Reply added.", status: "success" };
  } catch (error) {
    return { message: getActionErrorMessage(error), status: "error" };
  }
}

export async function changePullRequestThreadStatus(
  context: PullRequestActionContext & {
    threadId: number;
  },
  _previousState: PullRequestActionState,
  formData: FormData,
): Promise<PullRequestActionState> {
  const statuses = new Set<AzureGitPullRequestThreadStatus>([
    "active",
    "byDesign",
    "closed",
    "fixed",
    "pending",
    "wontFix",
  ]);
  const rawStatus = formData.get("status");

  if (
    !validateContext(context) ||
    !isPositiveInteger(context.threadId) ||
    typeof rawStatus !== "string" ||
    !statuses.has(rawStatus as AzureGitPullRequestThreadStatus)
  ) {
    return { message: "Invalid pull request thread.", status: "error" };
  }
  const status = rawStatus as Exclude<
    AzureGitPullRequestThreadStatus,
    "unknown"
  >;

  try {
    const accessToken = await getAzureDevOpsAccessToken();

    await updatePullRequestThreadStatus(
      accessToken,
      context.projectId,
      context.repositoryId,
      context.pullRequestId,
      context.threadId,
      status,
    );
    revalidatePullRequest(context);

    return { message: "Thread status updated.", status: "success" };
  } catch (error) {
    return { message: getActionErrorMessage(error), status: "error" };
  }
}

export async function voteOnPullRequest(
  context: PullRequestActionContext & {
    reviewerId: string;
  },
  _previousState: PullRequestActionState,
  formData: FormData,
): Promise<PullRequestActionState> {
  const votes = new Set<AzureGitPullRequestVote>([-10, -5, 0, 5, 10]);
  const voteValue = formData.get("vote");
  const rawVote =
    typeof voteValue === "string" && voteValue.trim()
      ? Number(voteValue)
      : Number.NaN;

  if (
    !validateContext(context) ||
    !context.reviewerId ||
    !votes.has(rawVote as AzureGitPullRequestVote)
  ) {
    return { message: "Invalid pull request vote.", status: "error" };
  }
  const vote = rawVote as AzureGitPullRequestVote;

  try {
    const accessToken = await getAzureDevOpsAccessToken();

    await setPullRequestReviewerVote(
      accessToken,
      context.projectId,
      context.repositoryId,
      context.pullRequestId,
      context.reviewerId,
      vote,
    );
    revalidatePullRequest(context);

    return { message: "Vote updated.", status: "success" };
  } catch (error) {
    return { message: getActionErrorMessage(error), status: "error" };
  }
}

export async function createInlinePullRequestComment(
  context: PullRequestActionContext & {
    changeTrackingId: number;
    filePath: string;
    firstComparingIteration: number;
    secondComparingIteration: number;
  },
  _previousState: PullRequestActionState,
  formData: FormData,
): Promise<PullRequestActionState> {
  const content = readCommentContent(formData);
  const side = formData.get("side");
  const start = Number(formData.get("start"));
  const end = Number(formData.get("end"));
  const filePath = normalizeRepositoryPath(context.filePath);

  if (
    !validateContext(context) ||
    !content.value ||
    (side !== "additions" && side !== "deletions") ||
    !isPositiveInteger(start) ||
    !isPositiveInteger(end) ||
    !isPositiveInteger(context.changeTrackingId) ||
    !isPositiveInteger(context.secondComparingIteration) ||
    context.firstComparingIteration < 0 ||
    !filePath
  ) {
    return {
      message: content.error ?? "Select one or more lines to comment on.",
      status: "error",
    };
  }

  const firstLine = Math.min(start, end);
  const lastLine = Math.max(start, end);
  const startPosition = { line: firstLine, offset: LINE_START_OFFSET };
  const endPosition = { line: lastLine, offset: LINE_END_OFFSET };

  try {
    const accessToken = await getAzureDevOpsAccessToken();

    await createPullRequestThread(
      accessToken,
      context.projectId,
      context.repositoryId,
      context.pullRequestId,
      {
        changeTrackingId: context.changeTrackingId,
        content: content.value,
        filePath,
        firstComparingIteration: context.firstComparingIteration,
        ...(side === "additions"
          ? {
              rightFileEnd: endPosition,
              rightFileStart: startPosition,
            }
          : {
              leftFileEnd: endPosition,
              leftFileStart: startPosition,
            }),
        secondComparingIteration: context.secondComparingIteration,
      },
    );
    revalidatePullRequest(context);

    return { message: "Inline comment added.", status: "success" };
  } catch (error) {
    return { message: getActionErrorMessage(error), status: "error" };
  }
}
