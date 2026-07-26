import { azureDevOpsRequest } from "@/lib/azure-devops/client";
import {
  getGitRepositoryApiPath,
  parsePageCursor,
} from "@/lib/azure-devops/git/api-path";
import {
  isRecord,
  parsePolicyEvaluationList,
  parsePullRequest,
  parsePullRequestChangeList,
  parsePullRequestIterationList,
  parsePullRequestList,
  parsePullRequestStatusList,
  parsePullRequestThread,
  parsePullRequestThreadList,
  readArray,
} from "@/lib/azure-devops/git/parsers";
import { createMalformedResponseError } from "@/lib/azure-devops/errors";
import type {
  AzureGitPullRequestThreadStatus,
  AzureGitPullRequestVote,
} from "@/lib/azure-devops/git/types";

export type PullRequestStatus = "abandoned" | "active" | "all" | "completed";

export async function listRepositoryPullRequests(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  options: {
    cursor?: string | null;
    status?: PullRequestStatus;
    top?: number;
  } = {},
) {
  const skip = parsePageCursor(options.cursor);
  const top = Math.min(Math.max(options.top ?? 50, 1), 100);
  const searchParams = new URLSearchParams({
    "$skip": String(skip),
    "$top": String(top),
    "searchCriteria.status": options.status ?? "active",
  });
  const response = await azureDevOpsRequest<unknown>(
    `${getGitRepositoryApiPath(projectId, repositoryId)}/pullrequests?${searchParams}`,
    { accessToken },
  );
  const items = parsePullRequestList(response);

  return {
    items,
    nextCursor: items.length === top ? String(skip + items.length) : null,
  };
}

/**
 * Repository scoped queries cannot answer "what is waiting on me", because a
 * person's pull requests are spread across every repository in a project. This
 * project scoped endpoint returns them in one request, including each
 * reviewer's vote.
 */
export async function listProjectPullRequests(
  accessToken: string,
  projectId: string,
  options: {
    cursor?: string | null;
    creatorId?: string;
    reviewerId?: string;
    status?: PullRequestStatus;
    top?: number;
  } = {},
) {
  const skip = parsePageCursor(options.cursor);
  const top = Math.min(Math.max(options.top ?? 25, 1), 100);
  const searchParams = new URLSearchParams({
    "$skip": String(skip),
    "$top": String(top),
    "searchCriteria.status": options.status ?? "active",
  });

  if (options.creatorId) {
    searchParams.set("searchCriteria.creatorId", options.creatorId);
  }

  if (options.reviewerId) {
    searchParams.set("searchCriteria.reviewerId", options.reviewerId);
  }

  const response = await azureDevOpsRequest<unknown>(
    `/${encodeURIComponent(projectId)}/_apis/git/pullrequests?${searchParams}`,
    { accessToken },
  );
  const items = parsePullRequestList(response);
  const rawItemCount = isRecord(response)
    ? readArray(response.value).length
    : 0;

  return {
    items,
    nextCursor:
      rawItemCount === top ? String(skip + rawItemCount) : null,
  };
}

export async function getRepositoryPullRequest(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  pullRequestId: number,
) {
  const searchParams = new URLSearchParams({
    includeCommits: "true",
    includeWorkItemRefs: "true",
  });
  const response = await azureDevOpsRequest<unknown>(
    `${getGitRepositoryApiPath(projectId, repositoryId)}/pullrequests/${pullRequestId}?${searchParams}`,
    { accessToken },
  );
  const pullRequest = parsePullRequest(response);

  if (!pullRequest) {
    throw createMalformedResponseError("loading a pull request");
  }

  return pullRequest;
}

function getPullRequestApiPath(
  projectId: string,
  repositoryId: string,
  pullRequestId: number,
) {
  return `${getGitRepositoryApiPath(projectId, repositoryId)}/pullrequests/${pullRequestId}`;
}

export async function listPullRequestThreads(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  pullRequestId: number,
  options: {
    baseIteration?: number | null;
    iteration?: number | null;
  } = {},
) {
  const searchParams = new URLSearchParams();

  if (options.iteration !== null && options.iteration !== undefined) {
    searchParams.set("$iteration", String(options.iteration));
  }

  if (
    options.baseIteration !== null &&
    options.baseIteration !== undefined
  ) {
    searchParams.set("$baseIteration", String(options.baseIteration));
  }

  const query = searchParams.size > 0 ? `?${searchParams}` : "";
  const response = await azureDevOpsRequest<unknown>(
    `${getPullRequestApiPath(
      projectId,
      repositoryId,
      pullRequestId,
    )}/threads${query}`,
    { accessToken },
  );

  return parsePullRequestThreadList(response).filter(
    (thread) => !thread.isDeleted,
  );
}

export async function listPullRequestIterations(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  pullRequestId: number,
) {
  const response = await azureDevOpsRequest<unknown>(
    `${getPullRequestApiPath(
      projectId,
      repositoryId,
      pullRequestId,
    )}/iterations?includeCommits=true`,
    { accessToken },
  );

  return parsePullRequestIterationList(response);
}

export async function listPullRequestIterationChanges(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  pullRequestId: number,
  iterationId: number,
  options: {
    compareTo?: number;
    cursor?: string | null;
    top?: number;
  } = {},
) {
  const skip = parsePageCursor(options.cursor);
  const top = Math.min(Math.max(options.top ?? 25, 1), 2_000);
  const searchParams = new URLSearchParams({
    "$compareTo": String(options.compareTo ?? 0),
    "$skip": String(skip),
    "$top": String(top),
  });
  const response = await azureDevOpsRequest<unknown>(
    `${getPullRequestApiPath(
      projectId,
      repositoryId,
      pullRequestId,
    )}/iterations/${iterationId}/changes?${searchParams}`,
    { accessToken },
  );
  const parsed = parsePullRequestChangeList(response);
  const nextSkip =
    parsed.nextSkip !== null
      ? parsed.nextSkip > skip
        ? parsed.nextSkip
        : null
      : parsed.items.length === top
        ? skip + parsed.items.length
        : null;

  return {
    items: parsed.items,
    nextCursor: nextSkip !== null ? String(nextSkip) : null,
  };
}

export async function listPullRequestStatuses(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  pullRequestId: number,
) {
  const response = await azureDevOpsRequest<unknown>(
    `${getPullRequestApiPath(
      projectId,
      repositoryId,
      pullRequestId,
    )}/statuses`,
    { accessToken },
  );

  return parsePullRequestStatusList(response);
}

export async function listPullRequestPolicyEvaluations(
  accessToken: string,
  projectId: string,
  pullRequestId: number,
) {
  const artifactId =
    `vstfs:///CodeReview/CodeReviewId/${projectId}/${pullRequestId}`;
  const searchParams = new URLSearchParams({
    "api-version": "7.1-preview.1",
    artifactId,
    includeNotApplicable: "true",
  });
  const response = await azureDevOpsRequest<unknown>(
    `/${encodeURIComponent(projectId)}/_apis/policy/evaluations?${searchParams}`,
    { accessToken },
  );

  return parsePolicyEvaluationList(response);
}

export async function createPullRequestThread(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  pullRequestId: number,
  input: {
    changeTrackingId?: number;
    content: string;
    filePath?: string;
    firstComparingIteration?: number;
    leftFileEnd?: { line: number; offset: number };
    leftFileStart?: { line: number; offset: number };
    rightFileEnd?: { line: number; offset: number };
    rightFileStart?: { line: number; offset: number };
    secondComparingIteration?: number;
  },
) {
  const hasFileContext = Boolean(input.filePath);
  const body = {
    comments: [
      {
        commentType: 1,
        content: input.content,
        parentCommentId: 0,
      },
    ],
    ...(hasFileContext
      ? {
          pullRequestThreadContext: {
            changeTrackingId: input.changeTrackingId,
            iterationContext: {
              firstComparingIteration: input.firstComparingIteration,
              secondComparingIteration: input.secondComparingIteration,
            },
          },
          threadContext: {
            filePath: input.filePath,
            leftFileEnd: input.leftFileEnd,
            leftFileStart: input.leftFileStart,
            rightFileEnd: input.rightFileEnd,
            rightFileStart: input.rightFileStart,
          },
        }
      : {}),
    status: "active",
  };
  const response = await azureDevOpsRequest<unknown>(
    `${getPullRequestApiPath(
      projectId,
      repositoryId,
      pullRequestId,
    )}/threads`,
    {
      accessToken,
      body: JSON.stringify(body),
      method: "POST",
    },
  );
  const thread = parsePullRequestThread(response);

  if (!thread) {
    throw createMalformedResponseError("creating a pull request thread");
  }

  return thread;
}

export async function replyToPullRequestThread(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  pullRequestId: number,
  threadId: number,
  parentCommentId: number,
  content: string,
) {
  return azureDevOpsRequest<unknown>(
    `${getPullRequestApiPath(
      projectId,
      repositoryId,
      pullRequestId,
    )}/threads/${threadId}/comments`,
    {
      accessToken,
      body: JSON.stringify({
        commentType: 1,
        content,
        parentCommentId,
      }),
      method: "POST",
    },
  );
}

export async function updatePullRequestThreadStatus(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  pullRequestId: number,
  threadId: number,
  status: Exclude<AzureGitPullRequestThreadStatus, "unknown">,
) {
  const response = await azureDevOpsRequest<unknown>(
    `${getPullRequestApiPath(
      projectId,
      repositoryId,
      pullRequestId,
    )}/threads/${threadId}`,
    {
      accessToken,
      body: JSON.stringify({ status }),
      method: "PATCH",
    },
  );
  const thread = parsePullRequestThread(response);

  if (!thread) {
    throw createMalformedResponseError(
      "updating a pull request thread",
    );
  }

  return thread;
}

export async function setPullRequestReviewerVote(
  accessToken: string,
  projectId: string,
  repositoryId: string,
  pullRequestId: number,
  reviewerId: string,
  vote: AzureGitPullRequestVote,
) {
  return azureDevOpsRequest<unknown>(
    `${getPullRequestApiPath(
      projectId,
      repositoryId,
      pullRequestId,
    )}/reviewers/${encodeURIComponent(reviewerId)}`,
    {
      accessToken,
      body: JSON.stringify({
        id: reviewerId,
        vote,
      }),
      method: "PUT",
    },
  );
}
