import { listProjects } from "@/lib/azure-devops/projects";

const { readAzureDevOpsResponseMock } = vi.hoisted(() => ({
  readAzureDevOpsResponseMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/client", () => ({
  readAzureDevOpsResponse: readAzureDevOpsResponseMock,
}));

vi.mock("@/lib/azure-devops/config", () => ({
  getAzureDevOpsConfig: vi.fn(() => ({
    apiVersion: "7.1",
    orgUrl: "https://dev.azure.com/example",
  })),
}));

describe("listProjects", () => {
  beforeEach(() => {
    readAzureDevOpsResponseMock.mockReset();
  });

  it("requests default team image urls and normalizes the response", async () => {
    readAzureDevOpsResponseMock.mockImplementationOnce(
      (_path, _options, readResponse) =>
        readResponse(
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
        ),
    );

    const result = await listProjects("token");

    expect(readAzureDevOpsResponseMock).toHaveBeenCalledWith(
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
      expect.any(Function),
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
    readAzureDevOpsResponseMock
      .mockImplementationOnce((_path, _options, readResponse) =>
        readResponse(
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
        ),
      )
      .mockImplementationOnce((_path, _options, readResponse) =>
        readResponse(
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
        ),
      );

    await expect(listProjects("token")).resolves.toEqual([
      expect.objectContaining({ id: "alpha-id" }),
      expect.objectContaining({ id: "beta-id" }),
    ]);
    expect(readAzureDevOpsResponseMock).toHaveBeenNthCalledWith(
      2,
      "/_apis/projects?%24top=1000&getDefaultTeamImageUrl=true&stateFilter=wellFormed&continuationToken=next+page%2Ftoken",
      expect.objectContaining({
        accessToken: "token",
        cache: "force-cache",
      }),
      expect.any(Function),
    );
  });
});
