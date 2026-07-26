import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import {
  describeAzureDevOpsError,
  type AzureDevOpsErrorDescriptor,
} from "@/lib/azure-devops/errors";
import { getCurrentAzureDevOpsIdentityId } from "@/lib/azure-devops/current-user";
import { getAzureDevOpsIdentityGroupIds } from "@/lib/azure-devops/identities";
import { listProjectPullRequests } from "@/lib/azure-devops/git/pull-requests";
import type {
  AzureGitPullRequest,
  AzureGitPullRequestReviewer,
} from "@/lib/azure-devops/git/types";
import {
  loadAzureDevOpsProjectSelection,
  type AzureDevOpsProjectSelection,
} from "@/lib/azure-devops/project-selection";

type AzureDevOpsProject = AzureDevOpsProjectSelection["selectedProjects"][number];

const PULL_REQUEST_PAGE_SIZE = 100;

export type DashboardPullRequests = {
  /** Reviewer on these and has not voted yet. */
  awaitingReview: AzureGitPullRequest[];
  createdByMe: AzureGitPullRequest[];
  /** Projects that could not be read, so the sections above are partial. */
  errors: Array<{
    error: AzureDevOpsErrorDescriptor;
    project: AzureDevOpsProject;
  }>;
  isAvailable: boolean;
};

const EMPTY_DASHBOARD_PULL_REQUESTS: DashboardPullRequests = {
  awaitingReview: [],
  createdByMe: [],
  errors: [],
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

/**
 * Whether a pull request is still waiting on this person.
 *
 * A review can be assigned to them directly or through a team, and Azure DevOps
 * records the two differently. A direct assignment lists them as a reviewer. A
 * team assignment lists only the team until somebody in it votes, at which
 * point the voter is added as a reviewer and the team's vote becomes theirs. A
 * team already carrying a vote has been answered by a colleague and is nobody
 * else's queue.
 */
export function isReviewerAwaitingReview(
  reviewers: readonly AzureGitPullRequestReviewer[],
  identityId: string,
  groupIds: readonly string[] = [],
) {
  const identity = identityId.toLowerCase();
  const directReviewer = reviewers.find(
    (reviewer) => reviewer.id?.toLowerCase() === identity,
  );

  if (directReviewer) {
    return !directReviewer.hasDeclined && directReviewer.vote === 0;
  }

  if (groupIds.length === 0) {
    return false;
  }

  const groups = new Set(groupIds.map((groupId) => groupId.toLowerCase()));

  return reviewers.some(
    (reviewer) =>
      reviewer.id !== null &&
      groups.has(reviewer.id.toLowerCase()) &&
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

    /**
     * Group membership only widens which reviews count as this person's, and it
     * comes from a different host to the Git APIs, so it can be refused on its
     * own. Losing it costs reviews reaching them through a team; it must not
     * cost the reviews and pull requests that do not depend on it.
     */
    const groupIds = await getAzureDevOpsIdentityGroupIds(
      accessToken,
      identityId,
    ).catch(() => [] as string[]);

    /**
     * One request per project answers both sections. Reviews cannot be matched
     * by Azure DevOps at all: `searchCriteria.reviewerId` matches only the
     * reviewer named on the pull request, and a team assignment names the team,
     * so a review reaching someone through a team is never returned. Asking per
     * group instead would be a request for every group the person belongs to,
     * far more than the teams they review for.
     *
     * Once every open pull request in the project is here, the ones the person
     * authored are in it too, and asking for those separately would be a second
     * request for a subset of what the first already returned.
     *
     * Projects are settled independently: one the person cannot read should not
     * empty the sections for every project they can.
     */
    const results = await Promise.allSettled(
      selection.selectedProjects.map((project) =>
        listAllProjectPullRequests(accessToken, project.id, {}),
      ),
    );
    const pullRequests: AzureGitPullRequest[] = [];
    const errors: DashboardPullRequests["errors"] = [];

    results.forEach((result, index) => {
      const project = selection.selectedProjects[index];

      if (!project) {
        return;
      }

      if (result.status === "rejected") {
        errors.push({
          error: describeAzureDevOpsError(result.reason),
          project,
        });
        return;
      }

      pullRequests.push(...result.value);
    });

    if (errors.length === selection.selectedProjects.length) {
      return { ...EMPTY_DASHBOARD_PULL_REQUESTS, errors };
    }

    const identity = identityId.toLowerCase();

    return {
      awaitingReview: sortByNewest(
        pullRequests.filter((pullRequest) =>
          isReviewerAwaitingReview(
            pullRequest.reviewers,
            identityId,
            groupIds,
          ),
        ),
      ),
      createdByMe: sortByNewest(
        pullRequests.filter(
          (pullRequest) => pullRequest.createdBy?.id?.toLowerCase() === identity,
        ),
      ),
      errors,
      isAvailable: true,
    };
  } catch {
    // The dashboard still renders its work item sections when Azure DevOps
    // cannot answer the pull request queries.
    return EMPTY_DASHBOARD_PULL_REQUESTS;
  }
}
