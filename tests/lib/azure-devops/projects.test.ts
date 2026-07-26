import { listProjects } from "@/lib/azure-devops/projects";

const { azureDevOpsRequestMock } = vi.hoisted(() => ({
  azureDevOpsRequestMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/client", () => ({
  azureDevOpsRequest: azureDevOpsRequestMock,
}));

vi.mock("@/lib/azure-devops/config", () => ({
  getAzureDevOpsConfig: vi.fn(() => ({
    apiVersion: "7.1",
    orgUrl: "https://dev.azure.com/example",
  })),
}));

describe("listProjects", () => {
  beforeEach(() => {
    azureDevOpsRequestMock.mockReset();
  });

  it("requests default team image urls and normalizes the response", async () => {
    azureDevOpsRequestMock.mockResolvedValue({
      value: [
        {
          defaultTeamImageUrl: " https://dev.azure.com/example/_apis/projects/1/image ",
          id: "project-2",
          name: "Beta",
          state: "wellFormed",
          url: "https://dev.azure.com/example/_apis/projects/project-2",
        },
        {
          defaultTeamImageUrl: "",
          id: "project-1",
          name: "Alpha",
          state: "wellFormed",
          url: "https://dev.azure.com/example/_apis/projects/project-1",
        },
      ],
    });

    const result = await listProjects("token");

    expect(azureDevOpsRequestMock).toHaveBeenCalledWith(
      "/_apis/projects?$top=1000&stateFilter=wellFormed&getDefaultTeamImageUrl=true",
      expect.objectContaining({
        accessToken: "token",
        cache: "force-cache",
        next: expect.objectContaining({
          revalidate: 300,
          tags: expect.arrayContaining([expect.stringMatching(/^ado-metadata:/)]),
        }),
      }),
    );
    expect(result).toEqual([
      {
        defaultTeamImageUrl: null,
        id: "project-1",
        name: "Alpha",
        state: "wellFormed",
        url: "https://dev.azure.com/example/_apis/projects/project-1",
      },
      {
        defaultTeamImageUrl: "https://dev.azure.com/example/_apis/projects/1/image",
        id: "project-2",
        name: "Beta",
        state: "wellFormed",
        url: "https://dev.azure.com/example/_apis/projects/project-2",
      },
    ]);
  });

  it("drops incomplete projects and fills safe defaults", async () => {
    azureDevOpsRequestMock.mockResolvedValue({
      value: [
        {
          id: "project-1",
          state: "  ",
        },
        {
          id: "project-2",
          name: "Gamma",
        },
      ],
    });

    const result = await listProjects("token");

    expect(result).toEqual([
      {
        defaultTeamImageUrl: null,
        id: "project-2",
        name: "Gamma",
        state: "unknown",
        url: "",
      },
    ]);
  });
});
