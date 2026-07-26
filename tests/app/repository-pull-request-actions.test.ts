import {
  createGeneralPullRequestComment,
  createInlinePullRequestComment,
  voteOnPullRequest,
} from "@/app/repos/[projectId]/[repositoryId]/pulls/[pullRequestId]/actions";

const {
  createPullRequestThreadMock,
  getAzureDevOpsAccessTokenMock,
  revalidatePathMock,
  setPullRequestReviewerVoteMock,
} = vi.hoisted(() => ({
  createPullRequestThreadMock: vi.fn(),
  getAzureDevOpsAccessTokenMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  setPullRequestReviewerVoteMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/azure-devops/access-token", () => ({
  getAzureDevOpsAccessToken: getAzureDevOpsAccessTokenMock,
}));

vi.mock("@/lib/azure-devops/git/pull-requests", () => ({
  createPullRequestThread: createPullRequestThreadMock,
  replyToPullRequestThread: vi.fn(),
  setPullRequestReviewerVote: setPullRequestReviewerVoteMock,
  updatePullRequestThreadStatus: vi.fn(),
}));

describe("pull request actions", () => {
  beforeEach(() => {
    createPullRequestThreadMock.mockReset();
    getAzureDevOpsAccessTokenMock.mockReset();
    revalidatePathMock.mockReset();
    setPullRequestReviewerVoteMock.mockReset();
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    createPullRequestThreadMock.mockResolvedValue(undefined);
    setPullRequestReviewerVoteMock.mockResolvedValue(undefined);
  });

  it("anchors an inline line selection with one-based offsets", async () => {
    const formData = new FormData();

    formData.set("content", "Please update this.");
    formData.set("side", "additions");
    formData.set("start", "8");
    formData.set("end", "10");

    await expect(
      createInlinePullRequestComment(
        {
          changeTrackingId: 12,
          filePath: "/src/app.ts",
          firstComparingIteration: 0,
          projectId: "project",
          pullRequestId: 42,
          repositoryId: "repository",
          secondComparingIteration: 3,
        },
        { message: "", status: "idle" },
        formData,
      ),
    ).resolves.toEqual({
      message: "Inline comment added.",
      status: "success",
    });
    expect(createPullRequestThreadMock).toHaveBeenCalledWith(
      "token",
      "project",
      "repository",
      42,
      {
        changeTrackingId: 12,
        content: "Please update this.",
        filePath: "/src/app.ts",
        firstComparingIteration: 0,
        rightFileEnd: { line: 10, offset: 1000 },
        rightFileStart: { line: 8, offset: 1 },
        secondComparingIteration: 3,
      },
    );
  });

  it("anchors a deletion-side selection on the left file", async () => {
    const formData = new FormData();

    formData.set("content", "Why was this removed?");
    formData.set("side", "deletions");
    // Submitted in reverse, as a reader dragging a selection upwards does.
    formData.set("start", "10");
    formData.set("end", "8");

    await createInlinePullRequestComment(
      {
        changeTrackingId: 12,
        filePath: "/src/app.ts",
        firstComparingIteration: 0,
        projectId: "project",
        pullRequestId: 42,
        repositoryId: "repository",
        secondComparingIteration: 3,
      },
      { message: "", status: "idle" },
      formData,
    );

    expect(createPullRequestThreadMock).toHaveBeenCalledWith(
      "token",
      "project",
      "repository",
      42,
      expect.objectContaining({
        leftFileEnd: { line: 10, offset: 1000 },
        leftFileStart: { line: 8, offset: 1 },
      }),
    );
  });

  it("preserves Markdown whitespace when creating a comment", async () => {
    const formData = new FormData();

    formData.set("content", "    indented code  \n");

    await createGeneralPullRequestComment(
      {
        projectId: "project",
        pullRequestId: 42,
        repositoryId: "repository",
      },
      { message: "", status: "idle" },
      formData,
    );

    expect(createPullRequestThreadMock).toHaveBeenCalledWith(
      "token",
      "project",
      "repository",
      42,
      { content: "    indented code  \n" },
    );
  });

  it("rejects a vote submission when the vote field is missing", async () => {
    await expect(
      voteOnPullRequest(
        {
          projectId: "project",
          pullRequestId: 42,
          repositoryId: "repository",
          reviewerId: "reviewer",
        },
        { message: "", status: "idle" },
        new FormData(),
      ),
    ).resolves.toEqual({
      message: "Invalid pull request vote.",
      status: "error",
    });
    expect(setPullRequestReviewerVoteMock).not.toHaveBeenCalled();
  });
});
