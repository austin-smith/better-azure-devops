import { listProjects } from "@/lib/azure-devops/projects";

const { azureDevOpsRequestMock } = vi.hoisted(() => ({
  azureDevOpsRequestMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/client", () => ({
  azureDevOpsRequest: azureDevOpsRequestMock,
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
      { accessToken: "token" },
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
