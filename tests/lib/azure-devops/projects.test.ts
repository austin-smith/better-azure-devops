import { listProjects } from "@/lib/azure-devops/projects";

const { azureDevOpsFetchMock } = vi.hoisted(() => ({
  azureDevOpsFetchMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/client", () => ({
  azureDevOpsFetch: azureDevOpsFetchMock,
}));

vi.mock("@/lib/azure-devops/config", () => ({
  getAzureDevOpsConfig: vi.fn(() => ({
    apiVersion: "7.1",
    orgUrl: "https://dev.azure.com/example",
  })),
}));

describe("listProjects", () => {
  beforeEach(() => {
    azureDevOpsFetchMock.mockReset();
  });

  it("requests default team image urls and normalizes the response", async () => {
    azureDevOpsFetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          value: [
            {
              defaultTeamImageUrl: "https://example.com/zulu.png",
              id: "zulu-id",
              name: "Zulu",
              state: "wellFormed",
              url: "https://example.com/zulu",
            },
            {
              id: "alpha-id",
              name: "Alpha",
              state: "wellFormed",
              url: "https://example.com/alpha",
            },
            {
              id: null,
              name: "Invalid",
            },
          ],
        }),
      ),
    );

    const result = await listProjects("token");

    expect(azureDevOpsFetchMock).toHaveBeenCalledWith(
      "/_apis/projects?%24top=1000&getDefaultTeamImageUrl=true&stateFilter=wellFormed",
      expect.objectContaining({
        accessToken: "token",
        cache: "force-cache",
        next: expect.objectContaining({
          revalidate: 300,
          tags: expect.arrayContaining([
            expect.stringMatching(/^ado-metadata:/),
          ]),
        }),
      }),
    );
    expect(result).toEqual([
      {
        defaultTeamImageUrl: null,
        id: "alpha-id",
        name: "Alpha",
        state: "wellFormed",
        url: "https://example.com/alpha",
      },
      {
        defaultTeamImageUrl: "https://example.com/zulu.png",
        id: "zulu-id",
        name: "Zulu",
        state: "wellFormed",
        url: "https://example.com/zulu",
      },
    ]);
  });

  it("follows Azure DevOps continuation headers", async () => {
    azureDevOpsFetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [
              {
                id: "beta-id",
                name: "Beta",
              },
            ],
          }),
          {
            headers: {
              "x-ms-continuationtoken": "next page/token",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [
              {
                id: "alpha-id",
                name: "Alpha",
              },
            ],
          }),
        ),
      );

    await expect(listProjects("token")).resolves.toEqual([
      expect.objectContaining({ id: "alpha-id" }),
      expect.objectContaining({ id: "beta-id" }),
    ]);
    expect(azureDevOpsFetchMock).toHaveBeenNthCalledWith(
      2,
      "/_apis/projects?%24top=1000&getDefaultTeamImageUrl=true&stateFilter=wellFormed&continuationToken=next+page%2Ftoken",
      expect.objectContaining({
        accessToken: "token",
        cache: "force-cache",
      }),
    );
  });
});
