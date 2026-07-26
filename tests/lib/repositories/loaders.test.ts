import {
  loadRepositoryBlob,
  loadRepositoryPullRequest,
} from "@/lib/repositories/loaders";

const {
  getCurrentAzureDevOpsIdentityIdMock,
  getAzureDevOpsAccessTokenMock,
  getRepositoryPullRequestMock,
  getRepositoryItemContentMock,
  getRepositoryItemMock,
  getRepositoryMock,
  listPullRequestIterationChangesMock,
  listPullRequestIterationsMock,
  listPullRequestPolicyEvaluationsMock,
  listPullRequestStatusesMock,
  listPullRequestThreadsMock,
  listRepositoryBranchesAndTagsMock,
} = vi.hoisted(() => ({
  getCurrentAzureDevOpsIdentityIdMock: vi.fn(),
  getAzureDevOpsAccessTokenMock: vi.fn(),
  getRepositoryPullRequestMock: vi.fn(),
  getRepositoryItemContentMock: vi.fn(),
  getRepositoryItemMock: vi.fn(),
  getRepositoryMock: vi.fn(),
  listPullRequestIterationChangesMock: vi.fn(),
  listPullRequestIterationsMock: vi.fn(),
  listPullRequestPolicyEvaluationsMock: vi.fn(),
  listPullRequestStatusesMock: vi.fn(),
  listPullRequestThreadsMock: vi.fn(),
  listRepositoryBranchesAndTagsMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/access-token", () => ({
  getAzureDevOpsAccessToken: getAzureDevOpsAccessTokenMock,
}));

vi.mock("@/lib/azure-devops/current-user", () => ({
  getCurrentAzureDevOpsIdentityId: getCurrentAzureDevOpsIdentityIdMock,
}));

vi.mock("@/lib/azure-devops/git/items", () => ({
  getRepositoryItem: getRepositoryItemMock,
  getRepositoryItemContent: getRepositoryItemContentMock,
  listRepositoryItems: vi.fn(),
}));

vi.mock("@/lib/azure-devops/git/pull-requests", () => ({
  getRepositoryPullRequest: getRepositoryPullRequestMock,
  listPullRequestIterationChanges: listPullRequestIterationChangesMock,
  listPullRequestIterations: listPullRequestIterationsMock,
  listPullRequestPolicyEvaluations: listPullRequestPolicyEvaluationsMock,
  listPullRequestStatuses: listPullRequestStatusesMock,
  listPullRequestThreads: listPullRequestThreadsMock,
  listRepositoryPullRequests: vi.fn(),
}));

vi.mock("@/lib/azure-devops/git/repositories", () => ({
  getRepository: getRepositoryMock,
  listRepositories: vi.fn(),
}));

vi.mock("@/lib/azure-devops/git/refs", () => ({
  listRepositoryBranchesAndTags: listRepositoryBranchesAndTagsMock,
}));

describe("repository loaders", () => {
  beforeEach(() => {
    getCurrentAzureDevOpsIdentityIdMock.mockReset();
    getAzureDevOpsAccessTokenMock.mockReset();
    getRepositoryPullRequestMock.mockReset();
    getRepositoryItemContentMock.mockReset();
    getRepositoryItemMock.mockReset();
    getRepositoryMock.mockReset();
    listPullRequestIterationChangesMock.mockReset();
    listPullRequestIterationsMock.mockReset();
    listPullRequestPolicyEvaluationsMock.mockReset();
    listPullRequestStatusesMock.mockReset();
    listPullRequestThreadsMock.mockReset();
    listRepositoryBranchesAndTagsMock.mockReset();

    getCurrentAzureDevOpsIdentityIdMock.mockResolvedValue(null);
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    getRepositoryMock.mockResolvedValue({
      defaultBranch: "refs/heads/main",
      id: "repository",
      project: {
        id: "project",
        name: "Platform",
      },
    });
    listRepositoryBranchesAndTagsMock.mockResolvedValue({
      branches: [],
      branchesTruncated: false,
      tags: [],
      tagsTruncated: false,
    });
    listPullRequestIterationsMock.mockResolvedValue([]);
    listPullRequestPolicyEvaluationsMock.mockResolvedValue([]);
    listPullRequestStatusesMock.mockResolvedValue([]);
    listPullRequestThreadsMock.mockResolvedValue([]);
    getRepositoryItemMock.mockResolvedValue({
      content: null,
      contentMetadata: {
        encoding: null,
        fileName: "large.ts",
        isBinary: false,
        isImage: false,
        mimeType: "text/plain",
      },
      gitObjectType: "blob",
      isFolder: false,
      objectId: "object",
      path: "/large.ts",
      size: null,
    });
  });

  it("does not inline text whose declared size exceeds the preview limit", async () => {
    getRepositoryItemContentMock.mockResolvedValue(
      new Response("not read", {
        headers: {
          "content-length": "1000001",
        },
      }),
    );

    await expect(
      loadRepositoryBlob(
        "project",
        "repository",
        "/large.ts",
        {
          type: "branch",
          value: "main",
        },
      ),
    ).resolves.toMatchObject({
      item: {
        content: null,
      },
      kind: "too-large",
    });
  });

  it("does not request blob content for git submodules", async () => {
    getRepositoryItemMock.mockResolvedValue({
      content: null,
      contentMetadata: {
        encoding: null,
        fileName: "shared-library",
        isBinary: false,
        isImage: false,
        mimeType: null,
      },
      gitObjectType: "commit",
      isFolder: false,
      objectId: "submodule-commit",
      path: "/shared-library",
      size: null,
    });

    await expect(
      loadRepositoryBlob(
        "project",
        "repository",
        "/shared-library",
        {
          type: "branch",
          value: "main",
        },
      ),
    ).resolves.toMatchObject({
      item: {
        objectId: "submodule-commit",
      },
      kind: "submodule",
    });
    expect(getRepositoryItemContentMock).not.toHaveBeenCalled();
  });

  it("decodes text using Azure DevOps content metadata", async () => {
    getRepositoryItemMock.mockResolvedValue({
      content: null,
      contentMetadata: {
        encoding: 1_200,
        fileName: "utf16.txt",
        isBinary: false,
        isImage: false,
        mimeType: "text/plain",
      },
      gitObjectType: "blob",
      isFolder: false,
      objectId: "object",
      path: "/utf16.txt",
      size: 6,
    });
    getRepositoryItemContentMock.mockResolvedValue(
      new Response(
        new Uint8Array([
          0xff,
          0xfe,
          0x68,
          0x00,
          0x69,
          0x00,
        ]),
      ),
    );

    await expect(
      loadRepositoryBlob(
        "project",
        "repository",
        "/utf16.txt",
        {
          type: "branch",
          value: "main",
        },
      ),
    ).resolves.toMatchObject({
      item: {
        content: "hi",
      },
      kind: "text",
    });
  });

  it("loads and decodes thread snippets from a fork source repository", async () => {
    getRepositoryPullRequestMock.mockResolvedValue(
      createPullRequest({
        lastMergeSourceCommitId: "source-commit",
        sourceRepository: {
          id: "fork-repository",
          projectId: "fork-project",
        },
      }),
    );
    listPullRequestThreadsMock.mockResolvedValue([
      createPullRequestThread({
        filePath: "/src/message.txt",
        rightFileEnd: { line: 1, offset: 1 },
        rightFileStart: { line: 1, offset: 1 },
      }),
    ]);
    getRepositoryItemMock.mockResolvedValue({
      content: null,
      contentMetadata: {
        encoding: 1_200,
        fileName: "message.txt",
        isBinary: false,
        isImage: false,
        mimeType: "text/plain",
      },
      gitObjectType: "blob",
      isFolder: false,
      objectId: "object",
      path: "/src/message.txt",
      size: 6,
    });
    getRepositoryItemContentMock.mockResolvedValue(
      new Response(
        new Uint8Array([
          0xff,
          0xfe,
          0x68,
          0x00,
          0x69,
          0x00,
        ]),
      ),
    );

    const data = await loadRepositoryPullRequest(
      "target-project",
      "target-repository",
      42,
    );

    expect(data.threadSnippets[7]?.[0]?.content).toBe("hi");
    expect(getRepositoryItemMock).toHaveBeenCalledWith(
      "token",
      "fork-project",
      "fork-repository",
      "/src/message.txt",
      {
        type: "commit",
        value: "source-commit",
      },
      { includeContentMetadata: true },
    );
    expect(getRepositoryItemContentMock).toHaveBeenCalledWith(
      "token",
      "fork-project",
      "fork-repository",
      "/src/message.txt",
      {
        type: "commit",
        value: "source-commit",
      },
    );
  });

  it("loads the changed-files page containing a linked thread", async () => {
    const targetChange = {
      changeId: 26,
      changeTrackingId: 26,
      changeType: "edit",
      objectId: "after",
      originalObjectId: "before",
      originalPath: null,
      path: "/src/target.ts",
    };

    getRepositoryPullRequestMock.mockResolvedValue(createPullRequest());
    listPullRequestIterationsMock.mockResolvedValue([
      {
        author: null,
        commonRefCommitId: "base",
        createdDate: null,
        description: null,
        id: 3,
        reason: "push",
        sourceRefCommitId: "source",
        targetRefCommitId: "target",
        updatedDate: null,
      },
    ]);
    listPullRequestThreadsMock.mockResolvedValue([
      createPullRequestThread({
        changeTrackingId: 26,
        filePath: "/src/target.ts",
      }),
    ]);
    listPullRequestIterationChangesMock
      // Changed-file count for the Files tab badge, requested first.
      .mockResolvedValueOnce({
        items: Array.from({ length: 26 }, (_, index) => ({
          ...targetChange,
          changeId: index + 1,
          changeTrackingId: index + 1,
          path: `/src/file-${index + 1}.ts`,
        })),
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 25 }, (_, index) => ({
          ...targetChange,
          changeId: index + 1,
          changeTrackingId: index + 1,
          path: `/src/file-${index + 1}.ts`,
        })),
        nextCursor: "25",
      })
      .mockResolvedValueOnce({
        items: [targetChange],
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        items: [targetChange],
        nextCursor: null,
      });
    getRepositoryItemMock.mockResolvedValue({
      content: null,
      contentMetadata: {
        encoding: null,
        fileName: "target.ts",
        isBinary: true,
        isImage: false,
        mimeType: "application/octet-stream",
      },
      gitObjectType: "blob",
      isFolder: false,
      objectId: "object",
      path: "/src/target.ts",
      size: 1,
    });

    const data = await loadRepositoryPullRequest(
      "cursor-project",
      "cursor-repository",
      42,
      {
        filesCursor: null,
        includeFiles: true,
        threadId: 7,
      },
    );

    expect(data.files).toMatchObject({
      cursor: "25",
      files: [
        {
          change: targetChange,
        },
      ],
    });
    expect(data.changedFileCount).toEqual({ isCapped: false, value: 26 });
    expect(listPullRequestIterationChangesMock).toHaveBeenNthCalledWith(
      1,
      "token",
      "cursor-project",
      "cursor-repository",
      42,
      3,
      {
        compareTo: 0,
        top: 2_000,
      },
    );
    expect(listPullRequestIterationChangesMock).toHaveBeenNthCalledWith(
      4,
      "token",
      "cursor-project",
      "cursor-repository",
      42,
      3,
      {
        compareTo: 0,
        cursor: "25",
        top: 25,
      },
    );
  });
});

function createPullRequest(
  overrides: Record<string, unknown> = {},
) {
  return {
    artifactId: null,
    closedDate: null,
    commits: [],
    createdBy: null,
    creationDate: null,
    description: null,
    isDraft: false,
    labels: [],
    lastMergeSourceCommitId: null,
    lastMergeTargetCommitId: null,
    mergeStatus: "succeeded",
    pullRequestId: 42,
    repository: {
      id: "target-repository",
      name: "Target",
      projectId: "target-project",
      projectName: "Platform",
    },
    reviewers: [],
    sourceRefName: "refs/heads/feature",
    sourceRepository: null,
    status: "active",
    supportsIterations: true,
    targetRefName: "refs/heads/main",
    title: "Improve repository browser",
    webUrl: null,
    workItemIds: [],
    ...overrides,
  };
}

function createPullRequestThread(
  overrides: Record<string, unknown> = {},
) {
  return {
    activity: null,
    changeTrackingId: null,
    comments: [],
    filePath: null,
    id: 7,
    isDeleted: false,
    iterationContext: null,
    lastUpdatedDate: null,
    leftFileEnd: null,
    leftFileStart: null,
    publishedDate: null,
    rightFileEnd: null,
    rightFileStart: null,
    status: "active",
    ...overrides,
  };
}
