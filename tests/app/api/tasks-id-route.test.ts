import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/tasks/[id]/route";

const {
  getAzureDevOpsAccessTokenMock,
  getTaskDetailsMock,
  hasAzureDevOpsConfigMock,
  updateTaskAssigneeMock,
} = vi.hoisted(() => ({
  getAzureDevOpsAccessTokenMock: vi.fn(),
  getTaskDetailsMock: vi.fn(),
  hasAzureDevOpsConfigMock: vi.fn(),
  updateTaskAssigneeMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/access-token", () => ({
  getAzureDevOpsAccessToken: getAzureDevOpsAccessTokenMock,
}));

vi.mock("@/lib/azure-devops/config", () => ({
  hasAzureDevOpsConfig: hasAzureDevOpsConfigMock,
}));

vi.mock("@/lib/azure-devops/tasks", () => ({
  getTaskDetails: getTaskDetailsMock,
  updateTaskAssignee: updateTaskAssigneeMock,
}));

describe("task detail route", () => {
  beforeEach(() => {
    getAzureDevOpsAccessTokenMock.mockReset();
    getTaskDetailsMock.mockReset();
    hasAzureDevOpsConfigMock.mockReset();
    updateTaskAssigneeMock.mockReset();
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
    updateTaskAssigneeMock.mockRejectedValue(
      new Error("Azure DevOps request failed (412 Precondition Failed): rev mismatch"),
    );

    const response = await PATCH(
      new NextRequest("http://localhost/api/tasks/42", {
        body: JSON.stringify({ assignee: null, revision: 7 }),
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

  it("updates the assignee when the request body is valid", async () => {
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    updateTaskAssigneeMock.mockResolvedValue({ id: 42, assignee: "ada@example.com" });

    const response = await PATCH(
      new NextRequest("http://localhost/api/tasks/42", {
        body: JSON.stringify({ assignee: " ada@example.com ", revision: 7 }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      item: { id: 42, assignee: "ada@example.com" },
    });
    expect(updateTaskAssigneeMock).toHaveBeenCalledWith(
      "token",
      42,
      "ada@example.com",
      7,
      {},
    );
  });
});
