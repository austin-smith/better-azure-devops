import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { getCurrentAzureDevOpsIdentityId } from "@/lib/azure-devops/current-user";
import { listProjectPullRequests } from "@/lib/azure-devops/git/pull-requests";
import type {
  AzureGitPullRequest,
  AzureGitPullRequestReviewer,
} from "@/lib/azure-devops/git/types";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";

const PULL_REQUEST_PAGE_SIZE = 100;

export type DashboardPullRequests = {
  /** Reviewer on these and has not voted yet. */
  awaitingReview: AzureGitPullRequest[];
  createdByMe: AzureGitPullRequest[];
  isAvailable: boolean;
};

const EMPTY_DASHBOARD_PULL_REQUESTS: DashboardPullRequests = {
  awaitingReview: [],
  createdByMe: [],
  isAvailable: false,
};

function sortByNewest(pullRequests: AzureGitPullRequest[]) {
  return [...pullRequests].sort((left, right) =>
    (right.creationDate ?? "").localeCompare(left.creationDate ?? ""),
  );
}

async function listAllProjectPullRequests(
  accessToken: string,
  projectId: string,
  options: {
    creatorId?: string;
    reviewerId?: string;
  },
) {
  const items: AzureGitPullRequest[] = [];
  let cursor: string | null = null;

  do {
    const page = await listProjectPullRequests(accessToken, projectId, {
      ...options,
      cursor,
      top: PULL_REQUEST_PAGE_SIZE,
    });

    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);

  return items;
}

export function isReviewerAwaitingReview(
  reviewers: readonly AzureGitPullRequestReviewer[],
  identityId: string,
) {
  return reviewers.some(
    (reviewer) =>
      reviewer.id?.toLowerCase() === identityId.toLowerCase() &&
      !reviewer.hasDeclined &&
      reviewer.vote === 0,
  );
}

/**
 * The dashboard answers "what needs me next", which for pull requests means the
 * ones a person authored and the ones blocked on their review. Both are project
 * scoped queries so a single request per project covers every repository.
 */
export async function loadDashboardPullRequests(): Promise<DashboardPullRequests> {
  if (!hasAzureDevOpsConfig()) {
    return EMPTY_DASHBOARD_PULL_REQUESTS;
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const [selection, identityId] = await Promise.all([
      loadAzureDevOpsProjectSelection(accessToken),
      getCurrentAzureDevOpsIdentityId(accessToken),
    ]);

    if (!identityId || selection.selectedProjects.length === 0) {
      return EMPTY_DASHBOARD_PULL_REQUESTS;
    }

    const results = await Promise.all(
      selection.selectedProjects.flatMap((project) => [
        listAllProjectPullRequests(accessToken, project.id, {
          creatorId: identityId,
        }).then((items) => ({ items, kind: "created" as const })),
        listAllProjectPullRequests(accessToken, project.id, {
          reviewerId: identityId,
        }).then((items) => ({ items, kind: "review" as const })),
      ]),
    );
    const createdByMe = results
      .filter((result) => result.kind === "created")
      .flatMap((result) => result.items);
    const reviewing = results
      .filter((result) => result.kind === "review")
      .flatMap((result) => result.items);

    return {
      // A vote of zero is the only state that still needs an answer; anything
      // else has already been acted on.
      awaitingReview: sortByNewest(
        reviewing.filter((pullRequest) =>
          isReviewerAwaitingReview(
            pullRequest.reviewers,
            identityId,
          ),
        ),
      ),
      createdByMe: sortByNewest(createdByMe),
      isAvailable: true,
    };
  } catch {
    // The dashboard still renders its work item sections when Azure DevOps
    // cannot answer the pull request queries.
    return EMPTY_DASHBOARD_PULL_REQUESTS;
  }
}
