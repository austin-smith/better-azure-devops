import { listRepositoryPushes } from "@/lib/azure-devops/git/pushes";

const { azureDevOpsRequestMock } = vi.hoisted(() => ({
  azureDevOpsRequestMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/client", () => ({
  azureDevOpsRequest: azureDevOpsRequestMock,
}));

describe("Azure Git pushes", () => {
  beforeEach(() => {
    azureDevOpsRequestMock.mockReset();
  });

  it("requests ref updates and returns an offset cursor", async () => {
    azureDevOpsRequestMock
      .mockResolvedValueOnce({
        value: Array.from({ length: 2 }, (_, index) => ({
          pushId: index + 1,
        })),
      })
      .mockResolvedValueOnce({
        value: [
          {
            author: {},
            comment: "First push commit",
            commitId: "commit-1",
            committer: {},
          },
        ],
      })
      .mockResolvedValueOnce({
        value: [
          {
            author: {},
            comment: "Second push commit",
            commitId: "commit-2",
            committer: {},
          },
        ],
      });

    await expect(
      listRepositoryPushes("token", "project id", "repository id", {
        refName: "main",
        top: 2,
      }),
    ).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          commits: [expect.objectContaining({ commitId: "commit-1" })],
          commitsTruncated: false,
          pushId: 1,
        }),
        expect.objectContaining({
          commits: [expect.objectContaining({ commitId: "commit-2" })],
          commitsTruncated: false,
          pushId: 2,
        }),
      ],
      nextCursor: "2",
    });
    expect(azureDevOpsRequestMock).toHaveBeenCalledWith(
      "/project%20id/_apis/git/repositories/repository%20id/pushes?%24skip=0&%24top=2&searchCriteria.includeLinks=true&searchCriteria.includeRefUpdates=true&searchCriteria.refName=refs%2Fheads%2Fmain",
      { accessToken: "token" },
    );
    expect(azureDevOpsRequestMock).toHaveBeenNthCalledWith(
      2,
      "/project%20id/_apis/git/repositories/repository%20id/commits?includeLinks=true&pushId=1&skip=0&top=101",
      { accessToken: "token" },
    );
    expect(azureDevOpsRequestMock).toHaveBeenNthCalledWith(
      3,
      "/project%20id/_apis/git/repositories/repository%20id/commits?includeLinks=true&pushId=2&skip=0&top=101",
      { accessToken: "token" },
    );
  });

  it("caps very large pushes and marks their commits as truncated", async () => {
    azureDevOpsRequestMock
      .mockResolvedValueOnce({
        value: [{ pushId: 1 }],
      })
      .mockResolvedValueOnce({
        value: Array.from({ length: 101 }, (_, index) => ({
          author: {},
          comment: `Commit ${index + 1}`,
          commitId: `commit-${index + 1}`,
          committer: {},
        })),
      });

    const result = await listRepositoryPushes(
      "token",
      "project",
      "repository",
    );

    expect(result.items[0]).toMatchObject({
      commitsTruncated: true,
      pushId: 1,
    });
    expect(result.items[0]?.commits).toHaveLength(100);
  });
});
