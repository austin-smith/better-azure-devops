const {
  countTasksMock,
  getAzureDevOpsAccessTokenMock,
  hasAzureDevOpsConfigMock,
  loadAzureDevOpsProjectSelectionMock,
  loadTaskListMock,
} = vi.hoisted(() => ({
  countTasksMock: vi.fn(),
  getAzureDevOpsAccessTokenMock: vi.fn(),
  hasAzureDevOpsConfigMock: vi.fn(),
  loadAzureDevOpsProjectSelectionMock: vi.fn(),
  loadTaskListMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/access-token", () => ({
  getAzureDevOpsAccessToken: getAzureDevOpsAccessTokenMock,
}));

vi.mock("@/lib/azure-devops/config", () => ({
  getAzureDevOpsConfig: vi.fn(() => ({
    apiVersion: "7.1",
    orgUrl: "https://dev.azure.com/example",
  })),
  hasAzureDevOpsConfig: hasAzureDevOpsConfigMock,
}));

vi.mock("@/lib/azure-devops/project-selection", () => ({
  loadAzureDevOpsProjectSelection: loadAzureDevOpsProjectSelectionMock,
}));

vi.mock("@/lib/azure-devops/tasks", () => ({
  countTasks: countTasksMock,
}));

vi.mock("@/lib/tasks/load-task-list", () => ({
  loadTaskList: loadTaskListMock,
}));

describe("loadDashboardOverview", () => {
  beforeEach(() => {
    countTasksMock.mockReset();
    getAzureDevOpsAccessTokenMock.mockReset();
    hasAzureDevOpsConfigMock.mockReset();
    loadAzureDevOpsProjectSelectionMock.mockReset();
    loadTaskListMock.mockReset();
    hasAzureDevOpsConfigMock.mockReturnValue(true);
  });

  it("counts the full personal queue while hydrating only visible queue items", async () => {
    const selectedProjects = [
      {
        defaultTeamImageUrl: null,
        id: "project-id",
        name: "Project",
        state: "wellFormed",
        url: "https://dev.azure.com/example/_apis/projects/project-id",
      },
    ];
    const queueItems = [
      {
        areaPath: "",
        assignee: "Ada",
        assigneeAvatarUrl: null,
        assigneeValue: null,
        id: 11,
        iterationPath: "",
        priority: "2",
        projectId: "project-id",
        projectImageUrl: null,
        projectName: "Project",
        state: "Active",
        title: "Queue item",
        type: "Task",
        updatedAt: "2025-01-06T12:00:00.000Z",
      },
    ];
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    loadAzureDevOpsProjectSelectionMock.mockResolvedValue({
      availableProjects: selectedProjects,
      selectedProjectIds: ["project-id"],
      selectedProjects,
      source: "saved",
    });
    loadTaskListMock
      .mockResolvedValueOnce({
        error: null,
        filterOptions: {
          assignees: [],
          priorities: [],
          states: [],
          types: [],
        },
        items: [],
      })
      .mockResolvedValueOnce({
        error: null,
        filterOptions: {
          assignees: [],
          priorities: [],
          states: [],
          types: [],
        },
        items: queueItems,
      });
    countTasksMock.mockResolvedValue(12);

    const { loadDashboardOverview } = await import(
      "@/lib/tasks/load-dashboard-overview"
    );
    const overview = await loadDashboardOverview();

    expect(overview.queueCount).toBe(12);
    expect(overview.queueItems).toEqual(queueItems);
    expect(loadTaskListMock).toHaveBeenNthCalledWith(
      2,
      "token",
      selectedProjects,
      expect.objectContaining({ assignee: "me" }),
      { maxItems: 5 },
    );
  });
});
