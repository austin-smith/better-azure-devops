const {
  countTasksMock,
  getAzureDevOpsAccessTokenMock,
  hasAzureDevOpsConfigMock,
  loadAzureDevOpsProjectSelectionMock,
} = vi.hoisted(() => ({
  countTasksMock: vi.fn(),
  getAzureDevOpsAccessTokenMock: vi.fn(),
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
  countTasks: countTasksMock,
}));

describe("loadSidebarCounts", () => {
  beforeEach(() => {
    countTasksMock.mockReset();
    getAzureDevOpsAccessTokenMock.mockReset();
    hasAzureDevOpsConfigMock.mockReset();
    loadAzureDevOpsProjectSelectionMock.mockReset();
    hasAzureDevOpsConfigMock.mockReturnValue(true);
  });

  it("loads only unfiltered and current-user counts", async () => {
    const selectedProjects = [
      {
        defaultTeamImageUrl: null,
        id: "project-id",
        name: "Project",
        state: "wellFormed",
        url: "https://dev.azure.com/example/_apis/projects/project-id",
      },
    ];
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    loadAzureDevOpsProjectSelectionMock.mockResolvedValue({
      availableProjects: selectedProjects,
      selectedProjectIds: ["project-id"],
      selectedProjects,
      source: "saved",
    });
    countTasksMock.mockResolvedValueOnce(8).mockResolvedValueOnce(3);

    const { loadSidebarCounts } = await import(
      "@/lib/tasks/load-sidebar-counts"
    );

    await expect(loadSidebarCounts()).resolves.toEqual({
      error: null,
      openTaskCount: 8,
      queueCount: 3,
    });
    expect(countTasksMock).toHaveBeenCalledTimes(2);
    expect(countTasksMock.mock.calls[0]?.[2]).toMatchObject({
      assignee: null,
    });
    expect(countTasksMock.mock.calls[1]?.[2]).toMatchObject({
      assignee: "me",
    });
  });
});
