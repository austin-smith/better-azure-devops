import { listRepositoryRefs } from "@/lib/azure-devops/git/refs";

const { readAzureDevOpsResponseMock } = vi.hoisted(() => ({
  readAzureDevOpsResponseMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/client", () => ({
  readAzureDevOpsResponse: readAzureDevOpsResponseMock,
}));

describe("repository refs", () => {
  beforeEach(() => {
    readAzureDevOpsResponseMock.mockReset();
  });

  it("reads refs and their continuation header inside the request lifecycle", async () => {
    readAzureDevOpsResponseMock.mockImplementationOnce(
      (_path, _options, readResponse) =>
        readResponse(
          new Response(
            JSON.stringify({
              value: [
                {
                  isLocked: false,
                  name: "refs/heads/main",
                  objectId: "commit-id",
                },
              ],
            }),
            {
              headers: {
                "x-ms-continuationtoken": "next-page",
              },
            },
          ),
        ),
    );

    await expect(
      listRepositoryRefs("token", "project", "repository", {
        filter: "branches",
        top: 100,
      }),
    ).resolves.toEqual({
      items: [
        {
          creator: null,
          isLocked: false,
          name: "refs/heads/main",
          objectId: "commit-id",
          peeledObjectId: null,
          type: "branch",
        },
      ],
      nextCursor: "next-page",
    });
    expect(readAzureDevOpsResponseMock).toHaveBeenCalledWith(
      "/project/_apis/git/repositories/repository/refs?%24top=100&filter=heads%2F",
      { accessToken: "token" },
      expect.any(Function),
    );
  });
});
