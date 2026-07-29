import { NextRequest } from "next/server";
import { POST } from "@/app/api/tasks/route";
import { AzureDevOpsError } from "@/lib/azure-devops/errors";

const {
  createTaskMock,
  getAzureDevOpsAccessTokenMock,
  hasAzureDevOpsConfigMock,
  loadAzureDevOpsProjectSelectionMock,
} = vi.hoisted(() => ({
  createTaskMock: vi.fn(),
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
  createTask: createTaskMock,
}));

describe("tasks route", () => {
  beforeEach(() => {
    createTaskMock.mockReset();
    getAzureDevOpsAccessTokenMock.mockReset();
    hasAzureDevOpsConfigMock.mockReset();
    loadAzureDevOpsProjectSelectionMock.mockReset();
    hasAzureDevOpsConfigMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid create bodies", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/tasks", {
        body: JSON.stringify({
          projectId: "project-id",
          title: "",
          type: "Task",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Project, work item type, and title are required.",
    });
  });

  it("creates a work item in the selected project", async () => {
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    loadAzureDevOpsProjectSelectionMock.mockResolvedValue({
      selectedProjects: [
        {
          defaultTeamImageUrl: "https://dev.azure.com/example/project.png",
          id: "project-id",
          name: "Project",
        },
      ],
    });
    createTaskMock.mockResolvedValue({
      id: 99,
      projectId: "project-id",
      title: "Created task",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/tasks", {
        body: JSON.stringify({
          areaPath: " Project\\Area ",
          description: "  # Heading\r\n\r\nDetails  ",
          priority: " 1 ",
          projectId: " project-id ",
          title: " Created task ",
          type: " Task ",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      item: {
        id: 99,
        projectId: "project-id",
        title: "Created task",
      },
    });
    expect(loadAzureDevOpsProjectSelectionMock).toHaveBeenCalledWith(
      "token",
      ["project-id"],
    );
    expect(createTaskMock).toHaveBeenCalledWith(
      "token",
      {
        areaPath: "Project\\Area",
        description: "  # Heading\n\nDetails  ",
        priority: "1",
        projectName: "Project",
        title: "Created task",
        type: "Task",
      },
      {
        projectId: "project-id",
        projectImageUrl: "https://dev.azure.com/example/project.png",
        projectName: "Project",
      },
    );
  });

  it("preserves failures that happen before work-item creation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    loadAzureDevOpsProjectSelectionMock.mockRejectedValue(
      new AzureDevOpsError("Project lookup failed.", {
        code: "network",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/tasks", {
        body: JSON.stringify({
          projectId: "project-id",
          title: "Created task",
          type: "Task",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      errorDetails: {
        code: "network",
      },
    });
    expect(createTaskMock).not.toHaveBeenCalled();
  });

  it("marks a lost create response as an uncertain outcome", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    loadAzureDevOpsProjectSelectionMock.mockResolvedValue({
      selectedProjects: [
        {
          defaultTeamImageUrl: null,
          id: "project-id",
          name: "Project",
        },
      ],
    });
    createTaskMock.mockRejectedValue(
      new AzureDevOpsError("The create response was lost.", {
        code: "network",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/tasks", {
        body: JSON.stringify({
          projectId: "project-id",
          title: "Created task",
          type: "Task",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      errorDetails: {
        canRetry: false,
        code: "create_status_unknown",
      },
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Azure DevOps request failed.",
      expect.stringContaining('"code":"create_status_unknown"'),
    );
  });

  it("rejects projects outside the active selection", async () => {
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    loadAzureDevOpsProjectSelectionMock.mockResolvedValue({
      selectedProjects: [],
    });

    const response = await POST(
      new NextRequest("http://localhost/api/tasks", {
        body: JSON.stringify({
          projectId: "project-id",
          title: "Created task",
          type: "Task",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Select a valid Azure DevOps project.",
    });
    expect(createTaskMock).not.toHaveBeenCalled();
  });
});
