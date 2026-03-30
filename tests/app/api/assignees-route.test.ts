import { NextRequest } from "next/server";
import { GET } from "@/app/api/assignees/route";

const {
  getAzureDevOpsAccessTokenMock,
  hasAzureDevOpsConfigMock,
  listAssignableUsersMock,
} = vi.hoisted(() => ({
  getAzureDevOpsAccessTokenMock: vi.fn(),
  hasAzureDevOpsConfigMock: vi.fn(),
  listAssignableUsersMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/access-token", () => ({
  getAzureDevOpsAccessToken: getAzureDevOpsAccessTokenMock,
}));

vi.mock("@/lib/azure-devops/config", () => ({
  hasAzureDevOpsConfig: hasAzureDevOpsConfigMock,
}));

vi.mock("@/lib/azure-devops/tasks", () => ({
  listAssignableUsers: listAssignableUsersMock,
}));

describe("GET /api/assignees", () => {
  beforeEach(() => {
    getAzureDevOpsAccessTokenMock.mockReset();
    hasAzureDevOpsConfigMock.mockReset();
    listAssignableUsersMock.mockReset();
  });

  it("returns 503 when azure devops is not configured", async () => {
    hasAzureDevOpsConfigMock.mockReturnValue(false);

    const response = await GET(new NextRequest("http://localhost/api/assignees?q=ada"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL.",
    });
  });

  it("returns an empty list when the query is too short", async () => {
    hasAzureDevOpsConfigMock.mockReturnValue(true);

    const response = await GET(new NextRequest("http://localhost/api/assignees?q=a"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [] });
    expect(getAzureDevOpsAccessTokenMock).not.toHaveBeenCalled();
  });

  it("loads assignees for valid queries", async () => {
    hasAzureDevOpsConfigMock.mockReturnValue(true);
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    listAssignableUsersMock.mockResolvedValue([{ value: "ada@example.com" }]);

    const response = await GET(new NextRequest("http://localhost/api/assignees?q=%20ada%20"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [{ value: "ada@example.com" }],
    });
    expect(listAssignableUsersMock).toHaveBeenCalledWith("token", "ada");
  });

  it("returns 500 when the assignee lookup fails", async () => {
    hasAzureDevOpsConfigMock.mockReturnValue(true);
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    listAssignableUsersMock.mockRejectedValue(new Error("boom"));

    const response = await GET(new NextRequest("http://localhost/api/assignees?q=ada"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "boom" });
  });
});
