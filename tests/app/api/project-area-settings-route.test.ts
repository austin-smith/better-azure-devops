import { NextRequest } from "next/server";
import { GET } from "@/app/api/projects/area-settings/route";

const {
  getAzureDevOpsAccessTokenMock,
  getTeamAreaSettingsMock,
  hasAzureDevOpsConfigMock,
  loadAzureDevOpsProjectSelectionMock,
} = vi.hoisted(() => ({
  getAzureDevOpsAccessTokenMock: vi.fn(),
  getTeamAreaSettingsMock: vi.fn(),
  hasAzureDevOpsConfigMock: vi.fn(),
  loadAzureDevOpsProjectSelectionMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/access-token", () => ({
  getAzureDevOpsAccessToken: getAzureDevOpsAccessTokenMock,
}));

vi.mock("@/lib/azure-devops/config", () => ({
  hasAzureDevOpsConfig: hasAzureDevOpsConfigMock,
}));

vi.mock("@/lib/azure-devops/project-selection", () => ({
  loadAzureDevOpsProjectSelection: loadAzureDevOpsProjectSelectionMock,
}));

vi.mock("@/lib/azure-devops/tasks", () => ({
  getTeamAreaSettings: getTeamAreaSettingsMock,
}));

describe("project area settings route", () => {
  beforeEach(() => {
    getAzureDevOpsAccessTokenMock.mockReset();
    getTeamAreaSettingsMock.mockReset();
    hasAzureDevOpsConfigMock.mockReset();
    loadAzureDevOpsProjectSelectionMock.mockReset();
    hasAzureDevOpsConfigMock.mockReturnValue(true);
  });

  it("requires a project", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/projects/area-settings"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Project is required.",
    });
  });

  it("loads team area settings for the selected project", async () => {
    const project = {
      defaultTeamImageUrl: null,
      id: "project-id",
      name: "Project",
    };

    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    loadAzureDevOpsProjectSelectionMock.mockResolvedValue({
      selectedProjects: [project],
    });
    getTeamAreaSettingsMock.mockResolvedValue({
      areas: [
        {
          includeChildren: true,
          value: "Project\\Platform",
        },
      ],
      defaultAreaPath: "Project\\Platform",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/projects/area-settings?project=project-id"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      item: {
        areas: [
          {
            includeChildren: true,
            value: "Project\\Platform",
          },
        ],
        defaultAreaPath: "Project\\Platform",
      },
    });
    expect(loadAzureDevOpsProjectSelectionMock).toHaveBeenCalledWith(
      "token",
      ["project-id"],
    );
    expect(getTeamAreaSettingsMock).toHaveBeenCalledWith("token", project);
  });
});
