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
  const endOffset = Number(formData.get("endOffset"));
  const filePath = normalizeRepositoryPath(context.filePath);

  if (
    !validateContext(context) ||
    !content.value ||
    (side !== "additions" && side !== "deletions") ||
    !isPositiveInteger(start) ||
    !isPositiveInteger(end) ||
    !Number.isSafeInteger(endOffset) ||
    endOffset < 0 ||
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
  const startPosition = { line: firstLine, offset: 0 };
  const endPosition = { line: lastLine, offset: endOffset };

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
