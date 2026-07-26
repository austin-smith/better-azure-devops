import {
  createPullRequestThread,
  listPullRequestIterationChanges,
  listPullRequestPolicyEvaluations,
  listPullRequestThreads,
  setPullRequestReviewerVote,
  updatePullRequestThreadStatus,
} from "@/lib/azure-devops/git/pull-requests";

const { azureDevOpsRequestMock } = vi.hoisted(() => ({
  azureDevOpsRequestMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/client", () => ({
  azureDevOpsRequest: azureDevOpsRequestMock,
}));

describe("Azure Git pull request reviews", () => {
  beforeEach(() => {
    azureDevOpsRequestMock.mockReset();
  });

  it("requests iteration-aware threads and paged changes", async () => {
    azureDevOpsRequestMock
      .mockResolvedValueOnce({ value: [] })
      .mockResolvedValueOnce({
        changeEntries: [
          {
            changeTrackingId: 4,
            changeType: "edit",
            item: { path: "/src/app.ts" },
          },
        ],
        nextSkip: 50,
      });

    await listPullRequestThreads("token", "project id", "repo id", 42, {
      baseIteration: 0,
      iteration: 3,
    });
    await expect(
      listPullRequestIterationChanges(
        "token",
        "project id",
        "repo id",
        42,
        3,
        {
          compareTo: 0,
          cursor: "25",
          top: 25,
        },
      ),
    ).resolves.toMatchObject({
      nextCursor: "50",
    });

    expect(azureDevOpsRequestMock).toHaveBeenNthCalledWith(
      1,
      "/project%20id/_apis/git/repositories/repo%20id/pullrequests/42/threads?%24iteration=3&%24baseIteration=0",
      { accessToken: "token" },
    );
    expect(azureDevOpsRequestMock).toHaveBeenNthCalledWith(
      2,
      "/project%20id/_apis/git/repositories/repo%20id/pullrequests/42/iterations/3/changes?%24compareTo=0&%24skip=25&%24top=25",
      { accessToken: "token" },
    );
  });

  it("honors an explicit terminal nextSkip on a full page", async () => {
    azureDevOpsRequestMock.mockResolvedValue({
      changeEntries: Array.from({ length: 25 }, (_, index) => ({
        changeTrackingId: index + 1,
        changeType: "edit",
        item: { path: `/src/file-${index + 1}.ts` },
      })),
      nextSkip: 0,
    });

    await expect(
      listPullRequestIterationChanges(
        "token",
        "project",
        "repository",
        42,
        3,
        { top: 25 },
      ),
    ).resolves.toMatchObject({
      nextCursor: null,
    });
  });

  it("uses the CodeReview artifact identity for policy evaluations", async () => {
    azureDevOpsRequestMock.mockResolvedValue({ value: [] });

    await listPullRequestPolicyEvaluations("token", "project id", 42);

    expect(azureDevOpsRequestMock).toHaveBeenCalledWith(
      "/project%20id/_apis/policy/evaluations?api-version=7.1-preview.1&artifactId=vstfs%3A%2F%2F%2FCodeReview%2FCodeReviewId%2Fproject+id%2F42&includeNotApplicable=true",
      { accessToken: "token" },
    );
  });

  it("creates inline threads with explicit iteration and line context", async () => {
    azureDevOpsRequestMock.mockResolvedValue({
      comments: [
        {
          author: { displayName: "Ada" },
          commentType: "text",
          content: "Please rename this.",
          id: 1,
        },
      ],
      id: 7,
      status: "active",
      threadContext: {
        filePath: "/src/app.ts",
        rightFileEnd: { line: 8, offset: 1 },
        rightFileStart: { line: 8, offset: 1 },
      },
    });

    await createPullRequestThread("token", "project", "repo", 42, {
      changeTrackingId: 12,
      content: "Please rename this.",
      filePath: "/src/app.ts",
      firstComparingIteration: 0,
      rightFileEnd: { line: 8, offset: 1 },
      rightFileStart: { line: 8, offset: 1 },
      secondComparingIteration: 3,
    });

    const request = azureDevOpsRequestMock.mock.calls[0]?.[1];

    expect(JSON.parse(String(request?.body))).toEqual({
      comments: [
        {
          commentType: 1,
          content: "Please rename this.",
          parentCommentId: 0,
        },
      ],
      pullRequestThreadContext: {
        changeTrackingId: 12,
        iterationContext: {
          firstComparingIteration: 0,
          secondComparingIteration: 3,
        },
      },
      status: "active",
      threadContext: {
        filePath: "/src/app.ts",
        rightFileEnd: { line: 8, offset: 1 },
        rightFileStart: { line: 8, offset: 1 },
      },
    });
  });

  it("updates thread status and reviewer vote with official verbs", async () => {
    azureDevOpsRequestMock
      .mockResolvedValueOnce({ comments: [], id: 7, status: "fixed" })
      .mockResolvedValueOnce({});

    await updatePullRequestThreadStatus(
      "token",
      "project",
      "repo",
      42,
      7,
      "fixed",
    );
    await setPullRequestReviewerVote(
      "token",
      "project",
      "repo",
      42,
      "reviewer id",
      10,
    );

    expect(azureDevOpsRequestMock).toHaveBeenNthCalledWith(
      1,
      "/project/_apis/git/repositories/repo/pullrequests/42/threads/7",
      expect.objectContaining({
        body: JSON.stringify({ status: "fixed" }),
        method: "PATCH",
      }),
    );
    expect(azureDevOpsRequestMock).toHaveBeenNthCalledWith(
      2,
      "/project/_apis/git/repositories/repo/pullrequests/42/reviewers/reviewer%20id",
      expect.objectContaining({
        body: JSON.stringify({ id: "reviewer id", vote: 10 }),
        method: "PUT",
      }),
    );
  });
});
