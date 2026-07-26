import { searchRepositoryCode } from "@/lib/azure-devops/git/search";

const { azureDevOpsRequestMock } = vi.hoisted(() => ({
  azureDevOpsRequestMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/client", () => ({
  azureDevOpsRequest: azureDevOpsRequestMock,
}));

vi.mock("@/lib/azure-devops/config", () => ({
  getAzureDevOpsOrganizationName: () => "example organization",
}));

describe("Azure Code Search", () => {
  beforeEach(() => {
    azureDevOpsRequestMock.mockReset();
  });

  it("uses the official paging fields and normalizes version metadata", async () => {
    azureDevOpsRequestMock.mockResolvedValue({
      count: 1,
      infoCode: 0,
      results: [
        {
          contentId: "content-id",
          fileName: "index.ts",
          matches: {
            content: [{ charOffset: 12, length: 5 }],
          },
          path: "/src/index.ts",
          project: {
            id: "project-id",
            name: "Platform",
          },
          repository: {
            id: "repository-id",
            name: "App",
          },
          versions: [
            {
              branchName: "main",
              changeId: "abc123",
            },
          ],
        },
      ],
    });

    await expect(
      searchRepositoryCode(
        "token",
        "project-id",
        "Platform",
        "repository-id",
        "App",
        {
          branch: "main",
          cursor: "25",
          query: "handler",
          top: 25,
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          branch: "main",
          changeId: "abc123",
          matches: [
            {
              charOffset: 12,
              field: "content",
              length: 5,
            },
          ],
        },
      ],
      nextCursor: null,
    });

    expect(azureDevOpsRequestMock).toHaveBeenCalledWith(
      "/_apis/search/codesearchresults?api-version=7.1",
      expect.objectContaining({
        baseUrl:
          "https://almsearch.dev.azure.com/example%20organization",
        body: expect.any(String),
        method: "POST",
      }),
    );
    const requestOptions = azureDevOpsRequestMock.mock.calls[0]?.[1];

    expect(JSON.parse(String(requestOptions?.body))).toEqual({
      $skip: 25,
      $top: 25,
      filters: {
        Branch: ["main"],
        Project: ["Platform"],
        Repository: ["App"],
      },
      includeFacets: true,
      searchText: "handler",
    });
  });

  it("advances past malformed results using the raw response page size", async () => {
    azureDevOpsRequestMock.mockResolvedValue({
      count: 3,
      infoCode: 0,
      results: [
        {
          fileName: "index.ts",
          path: "/src/index.ts",
          project: {
            id: "project-id",
            name: "Platform",
          },
          repository: {
            id: "repository-id",
            name: "App",
          },
        },
        {
          path: "/missing-identity.ts",
        },
      ],
    });

    await expect(
      searchRepositoryCode(
        "token",
        "project-id",
        "Platform",
        "repository-id",
        "App",
        {
          query: "handler",
        },
      ),
    ).resolves.toMatchObject({
      items: [expect.objectContaining({ path: "/src/index.ts" })],
      nextCursor: "2",
    });
  });
});
