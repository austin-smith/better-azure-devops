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
  getAzureDevOpsIdentityGroupIdsMock,
  getCurrentAzureDevOpsIdentityIdMock,
  listProjectPullRequestsMock,
  loadAzureDevOpsProjectSelectionMock,
} = vi.hoisted(() => ({
  getAzureDevOpsAccessTokenMock: vi.fn(),
  getAzureDevOpsIdentityGroupIdsMock: vi.fn(),
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

vi.mock("@/lib/azure-devops/identities", () => ({
  getAzureDevOpsIdentityGroupIds: getAzureDevOpsIdentityGroupIdsMock,
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
  authorId,
  creationDate,
  id,
  vote = 0,
}: {
  authorId?: string;
  creationDate: string;
  id: number;
  vote?: AzureGitPullRequestReviewer["vote"];
}): AzureGitPullRequest {
  return {
    artifactId: null,
    closedDate: null,
    commits: [],
    createdBy: authorId
      ? {
          displayName: "Author",
          id: authorId,
          imageUrl: null,
          isContainer: false,
        }
      : null,
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

/**
 * A review assigned to a team lists only the team until somebody in it votes.
 * Azure DevOps does not expand team membership for `searchCriteria.reviewerId`,
 * so these pull requests are matched here or not at all.
 */
describe("isReviewerAwaitingReview through a team", () => {
  const team = createReviewer({
    displayName: "CCC Team",
    id: "team",
    isContainer: true,
  });

  it("claims a review assigned to a team the user belongs to", () => {
    expect(isReviewerAwaitingReview([team], "me", ["team"])).toBe(true);
  });

  it("matches the team regardless of id casing", () => {
    expect(
      isReviewerAwaitingReview(
        [createReviewer({ id: "TEAM", isContainer: true })],
        "me",
        ["team"],
      ),
    ).toBe(true);
  });

  it("ignores a team the user does not belong to", () => {
    expect(isReviewerAwaitingReview([team], "me", ["other"])).toBe(false);
  });

  it("leaves a team a colleague has already voted for", () => {
    expect(
      isReviewerAwaitingReview(
        [createReviewer({ id: "team", isContainer: true, vote: 10 })],
        "me",
        ["team"],
      ),
    ).toBe(false);
  });

  it("prefers the user's own vote over the team's", () => {
    // Voting adds the user as a reviewer and carries their vote up to the
    // team, so the team's vote must not put it back in their queue.
    expect(
      isReviewerAwaitingReview(
        [
          createReviewer({ id: "me", vote: 10 }),
          createReviewer({ id: "team", isContainer: true, vote: 10 }),
        ],
        "me",
        ["team"],
      ),
    ).toBe(false);
  });

  it("keeps a direct assignment the user has not answered", () => {
    expect(
      isReviewerAwaitingReview(
        [
          createReviewer({ id: "me", vote: 0 }),
          createReviewer({ id: "team", isContainer: true, vote: 10 }),
        ],
        "me",
        ["team"],
      ),
    ).toBe(true);
  });
});

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
    getAzureDevOpsIdentityGroupIdsMock.mockReset();

    getAzureDevOpsIdentityGroupIdsMock.mockResolvedValue([]);
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    getCurrentAzureDevOpsIdentityIdMock.mockResolvedValue("reviewer");
    loadAzureDevOpsProjectSelectionMock.mockResolvedValue({
      selectedProjects: [{ id: "project", name: "Platform" }],
    });
  });

  it("derives both sections from one paged query per project", async () => {
    const mineFirst = createPullRequest({
      authorId: "reviewer",
      creationDate: "2026-07-25T00:00:00Z",
      id: 1,
      vote: 10,
    });
    const mineLater = createPullRequest({
      authorId: "reviewer",
      creationDate: "2026-07-26T00:00:00Z",
      id: 2,
      vote: 10,
    });
    const alreadyReviewed = createPullRequest({
      authorId: "colleague",
      creationDate: "2026-07-25T00:00:00Z",
      id: 3,
      vote: 10,
    });
    const awaitingOnLaterPage = createPullRequest({
      authorId: "colleague",
      creationDate: "2026-07-26T00:00:00Z",
      id: 4,
    });

    listProjectPullRequestsMock.mockImplementation(
      (
        _accessToken: string,
        _projectId: string,
        options: { cursor?: string | null; top?: number },
      ) =>
        Promise.resolve(
          options.cursor
            ? { items: [mineLater, awaitingOnLaterPage], nextCursor: null }
            : { items: [mineFirst, alreadyReviewed], nextCursor: "100" },
        ),
    );

    await expect(loadDashboardPullRequests()).resolves.toMatchObject({
      awaitingReview: [expect.objectContaining({ pullRequestId: 4 })],
      createdByMe: [
        expect.objectContaining({ pullRequestId: 2 }),
        expect.objectContaining({ pullRequestId: 1 }),
      ],
      isAvailable: true,
    });

    // Two calls are the two pages. Authored pull requests are already in the
    // same response, so asking for them separately would be a third and fourth.
    expect(listProjectPullRequestsMock).toHaveBeenCalledTimes(2);
    expect(listProjectPullRequestsMock).not.toHaveBeenCalledWith(
      "token",
      "project",
      expect.objectContaining({ creatorId: expect.anything() }),
    );
    expect(listProjectPullRequestsMock).toHaveBeenCalledWith(
      "token",
      "project",
      expect.objectContaining({ cursor: "100", top: 100 }),
    );
  });

  it("keeps direct reviews when group membership cannot be read", async () => {
    // Membership comes from a different host to the Git APIs and can be refused
    // on its own. Losing it must cost team matching, not the whole dashboard.
    getAzureDevOpsIdentityGroupIdsMock.mockRejectedValue(new Error("forbidden"));

    const awaiting = createPullRequest({
      authorId: "colleague",
      creationDate: "2026-07-26T00:00:00Z",
      id: 6,
    });

    listProjectPullRequestsMock.mockResolvedValue({
      items: [awaiting],
      nextCursor: null,
    });

    await expect(loadDashboardPullRequests()).resolves.toMatchObject({
      awaitingReview: [expect.objectContaining({ pullRequestId: 6 })],
      isAvailable: true,
    });
  });

  it("keeps the projects it could read when one fails", async () => {
    loadAzureDevOpsProjectSelectionMock.mockResolvedValue({
      selectedProjects: [
        { id: "readable", name: "Platform" },
        { id: "forbidden", name: "Secret" },
      ],
    });

    const awaiting = createPullRequest({
      authorId: "colleague",
      creationDate: "2026-07-26T00:00:00Z",
      id: 7,
    });

    listProjectPullRequestsMock.mockImplementation((
      _accessToken: string,
      projectId: string,
    ) =>
      projectId === "readable"
        ? Promise.resolve({ items: [awaiting], nextCursor: null })
        : Promise.reject(new Error("no access")),
    );

    const result = await loadDashboardPullRequests();

    expect(result.awaitingReview).toEqual([
      expect.objectContaining({ pullRequestId: 7 }),
    ]);
    expect(result.isAvailable).toBe(true);
    // Named rather than left looking like an empty queue.
    expect(result.errors).toEqual([
      expect.objectContaining({
        project: expect.objectContaining({ id: "forbidden" }),
      }),
    ]);
  });

  it("reports the pull request sections unavailable when every project fails", async () => {
    listProjectPullRequestsMock.mockRejectedValue(new Error("no access"));

    const result = await loadDashboardPullRequests();

    expect(result.isAvailable).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it("keeps a review reaching the user only through a team", async () => {
    getAzureDevOpsIdentityGroupIdsMock.mockResolvedValue(["team"]);

    const teamAssigned = createPullRequest({
      authorId: "colleague",
      creationDate: "2026-07-26T00:00:00Z",
      id: 5,
    });

    teamAssigned.reviewers = [
      createReviewer({ id: "team", isContainer: true, vote: 0 }),
    ];
    listProjectPullRequestsMock.mockResolvedValue({
      items: [teamAssigned],
      nextCursor: null,
    });

    await expect(loadDashboardPullRequests()).resolves.toMatchObject({
      awaitingReview: [expect.objectContaining({ pullRequestId: 5 })],
    });
  });
});
