import type {
  AzureGitPullRequest,
  AzureGitPullRequestReviewer,
} from "@/lib/azure-devops/git/types";
import {
  isReviewerAwaitingReview,
  loadDashboardPullRequests,
} from "@/lib/repositories/load-dashboard-pull-requests";

const {
  getAzureDevOpsAccessTokenMock,
  getCurrentAzureDevOpsIdentityIdMock,
  listProjectPullRequestsMock,
  loadAzureDevOpsProjectSelectionMock,
} = vi.hoisted(() => ({
  getAzureDevOpsAccessTokenMock: vi.fn(),
  getCurrentAzureDevOpsIdentityIdMock: vi.fn(),
  listProjectPullRequestsMock: vi.fn(),
  loadAzureDevOpsProjectSelectionMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/access-token", () => ({
  getAzureDevOpsAccessToken: getAzureDevOpsAccessTokenMock,
}));

vi.mock("@/lib/azure-devops/config", () => ({
  hasAzureDevOpsConfig: () => true,
}));

vi.mock("@/lib/azure-devops/current-user", () => ({
  getCurrentAzureDevOpsIdentityId: getCurrentAzureDevOpsIdentityIdMock,
}));

vi.mock("@/lib/azure-devops/git/pull-requests", () => ({
  listProjectPullRequests: listProjectPullRequestsMock,
}));

vi.mock("@/lib/azure-devops/project-selection", () => ({
  loadAzureDevOpsProjectSelection: loadAzureDevOpsProjectSelectionMock,
}));

function createReviewer(
  overrides: Partial<AzureGitPullRequestReviewer>,
): AzureGitPullRequestReviewer {
  return {
    displayName: "Reviewer",
    hasDeclined: false,
    id: "reviewer",
    imageUrl: null,
    isContainer: false,
    isFlagged: false,
    isRequired: false,
    vote: 0,
    votedFor: [],
    ...overrides,
  };
}

function createPullRequest({
  creationDate,
  id,
  vote = 0,
}: {
  creationDate: string;
  id: number;
  vote?: AzureGitPullRequestReviewer["vote"];
}): AzureGitPullRequest {
  return {
    artifactId: null,
    closedDate: null,
    commits: [],
    createdBy: null,
    creationDate,
    description: null,
    isDraft: false,
    labels: [],
    lastMergeSourceCommitId: null,
    lastMergeTargetCommitId: null,
    mergeStatus: null,
    pullRequestId: id,
    repository: {
      id: "repository",
      name: "App",
      projectId: "project",
      projectName: "Platform",
    },
    reviewers: [createReviewer({ vote })],
    sourceRefName: "refs/heads/feature",
    sourceRepository: null,
    status: "active",
    supportsIterations: true,
    targetRefName: "refs/heads/main",
    title: `Pull request ${id}`,
    webUrl: null,
    workItemIds: [],
  };
}

describe("isReviewerAwaitingReview", () => {
  it("excludes review assignments the user declined", () => {
    expect(
      isReviewerAwaitingReview(
        [createReviewer({ hasDeclined: true })],
        "reviewer",
      ),
    ).toBe(false);
  });

  it("includes an assigned reviewer who has not voted", () => {
    expect(
      isReviewerAwaitingReview([createReviewer({})], "REVIEWER"),
    ).toBe(true);
  });
});

describe("loadDashboardPullRequests", () => {
  beforeEach(() => {
    getAzureDevOpsAccessTokenMock.mockReset();
    getCurrentAzureDevOpsIdentityIdMock.mockReset();
    listProjectPullRequestsMock.mockReset();
    loadAzureDevOpsProjectSelectionMock.mockReset();

    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    getCurrentAzureDevOpsIdentityIdMock.mockResolvedValue("reviewer");
    loadAzureDevOpsProjectSelectionMock.mockResolvedValue({
      selectedProjects: [{ id: "project" }],
    });
  });

  it("loads every page before deriving dashboard totals and review work", async () => {
    const createdFirst = createPullRequest({
      creationDate: "2026-07-25T00:00:00Z",
      id: 1,
    });
    const createdLater = createPullRequest({
      creationDate: "2026-07-26T00:00:00Z",
      id: 2,
    });
    const alreadyReviewed = createPullRequest({
      creationDate: "2026-07-25T00:00:00Z",
      id: 3,
      vote: 10,
    });
    const awaitingOnLaterPage = createPullRequest({
      creationDate: "2026-07-26T00:00:00Z",
      id: 4,
    });
    type QueryOptions = {
      creatorId?: string;
      cursor?: string | null;
      reviewerId?: string;
      top?: number;
    };

    listProjectPullRequestsMock.mockImplementation(
      (
        _accessToken: string,
        _projectId: string,
        options: QueryOptions,
      ) => {
        if (options.creatorId) {
          return Promise.resolve(
            options.cursor
              ? { items: [createdLater], nextCursor: null }
              : { items: [createdFirst], nextCursor: "100" },
          );
        }

        return Promise.resolve(
          options.cursor
            ? { items: [awaitingOnLaterPage], nextCursor: null }
            : { items: [alreadyReviewed], nextCursor: "100" },
        );
      },
    );

    await expect(loadDashboardPullRequests()).resolves.toMatchObject({
      awaitingReview: [
        expect.objectContaining({ pullRequestId: 4 }),
      ],
      createdByMe: [
        expect.objectContaining({ pullRequestId: 2 }),
        expect.objectContaining({ pullRequestId: 1 }),
      ],
      isAvailable: true,
    });

    expect(listProjectPullRequestsMock).toHaveBeenCalledTimes(4);
    expect(listProjectPullRequestsMock).toHaveBeenCalledWith(
      "token",
      "project",
      expect.objectContaining({
        cursor: "100",
        reviewerId: "reviewer",
        top: 100,
      }),
    );
  });
});
