const { azureDevOpsRequestMock } = vi.hoisted(() => ({
  azureDevOpsRequestMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/client", () => ({
  azureDevOpsRequest: azureDevOpsRequestMock,
}));

import { listCompletedRepositoryPullRequests } from "@/lib/azure-devops/git/pull-requests";

describe("completed repository pull request analytics query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    azureDevOpsRequestMock.mockResolvedValue({ value: [] });
  });

  it("scopes the project query by repository, target branch, status, and close time", async () => {
    await listCompletedRepositoryPullRequests(
      "token",
      "project id",
      "repo-id",
      {
        maxClosedAt: "2026-07-26T00:00:00.000Z",
        minClosedAt: "2026-06-26T00:00:00.000Z",
        targetRefName: "refs/heads/main",
      },
    );

    const [path] = azureDevOpsRequestMock.mock.calls[0] as [string];
    const url = new URL(path, "https://example.test");

    expect(url.pathname).toBe("/project%20id/_apis/git/pullrequests");
    expect(url.searchParams.get("searchCriteria.repositoryId")).toBe(
      "repo-id",
    );
    expect(url.searchParams.get("searchCriteria.targetRefName")).toBe(
      "refs/heads/main",
    );
    expect(url.searchParams.get("searchCriteria.status")).toBe("completed");
    expect(url.searchParams.get("$top")).toBe("100");
    expect(url.searchParams.get("searchCriteria.queryTimeRangeType")).toBe(
      "closed",
    );
    expect(url.searchParams.get("searchCriteria.minTime")).toBe(
      "2026-06-26T00:00:00.000Z",
    );
  });

  it("can ingest every target branch for a repository", async () => {
    await listCompletedRepositoryPullRequests(
      "token",
      "project id",
      "repo-id",
      {
        maxClosedAt: "2026-07-26T00:00:00.000Z",
        minClosedAt: "2026-06-26T00:00:00.000Z",
      },
    );

    const [path] = azureDevOpsRequestMock.mock.calls[0] as [string];
    const url = new URL(path, "https://example.test");

    expect(
      url.searchParams.has("searchCriteria.targetRefName"),
    ).toBe(false);
  });

  it.each([
    ["a missing collection", {}],
    ["a null collection", { value: null }],
  ])("rejects %s", async (_description, response) => {
    azureDevOpsRequestMock.mockResolvedValueOnce(response);

    await expect(
      listCompletedRepositoryPullRequests(
        "token",
        "project-id",
        "repo-id",
        {},
      ),
    ).rejects.toMatchObject({
      descriptor: {
        kind: "malformed-response",
      },
    });
  });
});
