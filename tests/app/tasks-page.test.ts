import type { ReactElement } from "react";

const {
  getAzureDevOpsAccessTokenMock,
  hasAzureDevOpsConfigMock,
  loadAzureDevOpsProjectSelectionMock,
  loadTaskListMock,
} = vi.hoisted(() => ({
  getAzureDevOpsAccessTokenMock: vi.fn(),
  hasAzureDevOpsConfigMock: vi.fn(),
  loadAzureDevOpsProjectSelectionMock: vi.fn(),
  loadTaskListMock: vi.fn(),
}));

vi.mock("@/components/tasks/task-table", () => ({
  TaskTable: vi.fn(() => null),
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

vi.mock("@/lib/tasks/load-task-list", () => ({
  loadTaskList: loadTaskListMock,
}));

describe("/tasks page", () => {
  beforeEach(() => {
    vi.resetModules();
    getAzureDevOpsAccessTokenMock.mockReset();
    hasAzureDevOpsConfigMock.mockReset();
    loadAzureDevOpsProjectSelectionMock.mockReset();
    loadTaskListMock.mockReset();
    hasAzureDevOpsConfigMock.mockReturnValue(true);
  });

  it("renders an inline error when loading the Azure DevOps access token fails", async () => {
    getAzureDevOpsAccessTokenMock.mockRejectedValue(
      new Error("Azure CLI is not signed in."),
    );

    const { default: TaskListPage } = await import("@/app/tasks/page");
    const result = await TaskListPage({
      searchParams: Promise.resolve({}),
    }) as ReactElement<{
      activeProjectCount: number;
      error: string | null;
      items: unknown[];
    }>;

    expect(result.props.error).toBe("Azure CLI is not signed in.");
    expect(result.props.items).toEqual([]);
    expect(result.props.activeProjectCount).toBe(0);
    expect(loadAzureDevOpsProjectSelectionMock).not.toHaveBeenCalled();
  });

  it("renders an inline error when project selection loading fails", async () => {
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    loadAzureDevOpsProjectSelectionMock.mockRejectedValue(
      new Error("Failed to load selected projects."),
    );

    const { default: TaskListPage } = await import("@/app/tasks/page");
    const result = await TaskListPage({
      searchParams: Promise.resolve({}),
    }) as ReactElement<{
      activeProjectCount: number;
      error: string | null;
      items: unknown[];
    }>;

    expect(result.props.error).toBe("Failed to load selected projects.");
    expect(result.props.items).toEqual([]);
    expect(result.props.activeProjectCount).toBe(0);
    expect(loadTaskListMock).not.toHaveBeenCalled();
  });
});
