import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/tasks/[id]/route";

const {
  getAzureDevOpsAccessTokenMock,
  getTaskDetailsMock,
  hasAzureDevOpsConfigMock,
  updateTaskMock,
} = vi.hoisted(() => ({
  getAzureDevOpsAccessTokenMock: vi.fn(),
  getTaskDetailsMock: vi.fn(),
  hasAzureDevOpsConfigMock: vi.fn(),
  updateTaskMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/access-token", () => ({
  getAzureDevOpsAccessToken: getAzureDevOpsAccessTokenMock,
}));

vi.mock("@/lib/azure-devops/config", () => ({
  hasAzureDevOpsConfig: hasAzureDevOpsConfigMock,
}));

vi.mock("@/lib/azure-devops/tasks", () => ({
  getTaskDetails: getTaskDetailsMock,
  updateTask: updateTaskMock,
}));

describe("task detail route", () => {
  beforeEach(() => {
    getAzureDevOpsAccessTokenMock.mockReset();
    getTaskDetailsMock.mockReset();
    hasAzureDevOpsConfigMock.mockReset();
    updateTaskMock.mockReset();
    hasAzureDevOpsConfigMock.mockReturnValue(true);
  });

  it("rejects invalid task ids for GET", async () => {
    const response = await GET(new NextRequest("http://localhost/api/tasks/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid task id." });
  });

  it("loads task details for GET", async () => {
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    getTaskDetailsMock.mockResolvedValue({ id: 42, title: "Hello" });

    const response = await GET(new NextRequest("http://localhost/api/tasks/42"), {
      params: Promise.resolve({ id: "42" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ item: { id: 42, title: "Hello" } });
    expect(getTaskDetailsMock).toHaveBeenCalledWith("token", 42, {});
  });

  it("rejects invalid patch bodies", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/tasks/42", {
        body: "not json",
        method: "PATCH",
      }),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request body." });
  });

  it("maps Azure DevOps revision conflicts to 409", async () => {
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    updateTaskMock.mockRejectedValue(
      new Error("Azure DevOps request failed (412 Precondition Failed): rev mismatch"),
    );

    const response = await PATCH(
      new NextRequest("http://localhost/api/tasks/42", {
        body: JSON.stringify({ changes: { assignee: null }, revision: 7 }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "This task changed in Azure DevOps. Refresh and try again.",
    });
  });

  it("updates task fields when the request body is valid", async () => {
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    updateTaskMock.mockResolvedValue({
      areaPath: "Project\\Area\\Platform",
      assignee: "Ada Lovelace",
      id: 42,
      iterationPath: "Project\\Iteration\\Sprint 2",
      priority: "1",
      title: "Updated title",
    });

    const response = await PATCH(
      new NextRequest("http://localhost/api/tasks/42", {
        body: JSON.stringify({
          changes: {
            areaPath: " Project\\Area\\Platform ",
            assignee: " ada@example.com ",
            iterationPath: " Project\\Iteration\\Sprint 2 ",
            priority: " 1 ",
            title: " Updated title ",
          },
          revision: 7,
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      item: {
        areaPath: "Project\\Area\\Platform",
        assignee: "Ada Lovelace",
        id: 42,
        iterationPath: "Project\\Iteration\\Sprint 2",
        priority: "1",
        title: "Updated title",
      },
    });
    expect(updateTaskMock).toHaveBeenCalledWith(
      "token",
      42,
      {
        areaPath: "Project\\Area\\Platform",
        assignee: "ada@example.com",
        iterationPath: "Project\\Iteration\\Sprint 2",
        priority: "1",
        title: "Updated title",
      },
      7,
      {},
    );
  });
});
