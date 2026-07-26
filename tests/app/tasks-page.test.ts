import type { ReactElement } from "react";
import type { PublicAzureDevOpsError } from "@/lib/azure-devops/errors";

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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders an inline error when loading the Azure DevOps access token fails", async () => {
    const { AzureDevOpsError } = await import("@/lib/azure-devops/errors");

    getAzureDevOpsAccessTokenMock.mockRejectedValue(
      new AzureDevOpsError("Azure CLI is not signed in.", {
        code: "authentication_required",
      }),
    );

    const { default: TaskListPage } = await import("@/app/tasks/page");
    const result = await TaskListPage({
      searchParams: Promise.resolve({}),
    }) as ReactElement<{
      activeProjectCount: number;
      error: PublicAzureDevOpsError | null;
      items: unknown[];
    }>;

    expect(result.props.error).toMatchObject({
      code: "authentication_required",
      title: "Sign in to Azure",
    });
    expect(result.props.items).toEqual([]);
    expect(result.props.activeProjectCount).toBe(0);
    expect(loadAzureDevOpsProjectSelectionMock).not.toHaveBeenCalled();
  });

  it("renders an inline error when project selection loading fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    loadAzureDevOpsProjectSelectionMock.mockRejectedValue(
      new Error("Failed to load selected projects."),
    );

    const { default: TaskListPage } = await import("@/app/tasks/page");
    const result = await TaskListPage({
      searchParams: Promise.resolve({}),
    }) as ReactElement<{
      activeProjectCount: number;
      error: PublicAzureDevOpsError | null;
      items: unknown[];
    }>;

    expect(result.props.error).toMatchObject({
      code: "unknown",
      title: "Azure DevOps request failed",
    });
    expect(result.props.items).toEqual([]);
    expect(result.props.activeProjectCount).toBe(0);
    expect(loadTaskListMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "Azure DevOps request failed.",
      expect.objectContaining({
        code: "unknown",
        message: "Failed to load selected projects.",
      }),
    );
  });

  it("forwards command-center new work item requests to the task table", async () => {
    hasAzureDevOpsConfigMock.mockReturnValue(false);

    const { default: TaskListPage } = await import("@/app/tasks/page");
    const result = await TaskListPage({
      searchParams: Promise.resolve({
        newWorkItem: "command-request",
      }),
    }) as ReactElement<{
      newWorkItemRequestKey: string | null;
    }>;

    expect(result.props.newWorkItemRequestKey).toBe("command-request");
  });
});
