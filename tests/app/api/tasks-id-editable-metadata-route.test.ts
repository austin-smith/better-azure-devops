import { NextRequest } from "next/server";
import { GET } from "@/app/api/tasks/[id]/editable-metadata/route";

const {
  getAzureDevOpsAccessTokenMock,
  getTaskEditMetadataMock,
  hasAzureDevOpsConfigMock,
} = vi.hoisted(() => ({
  getAzureDevOpsAccessTokenMock: vi.fn(),
  getTaskEditMetadataMock: vi.fn(),
  hasAzureDevOpsConfigMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/access-token", () => ({
  getAzureDevOpsAccessToken: getAzureDevOpsAccessTokenMock,
}));

vi.mock("@/lib/azure-devops/config", () => ({
  hasAzureDevOpsConfig: hasAzureDevOpsConfigMock,
}));

vi.mock("@/lib/azure-devops/tasks", () => ({
  getTaskEditMetadata: getTaskEditMetadataMock,
}));

describe("task editable metadata route", () => {
  beforeEach(() => {
    getAzureDevOpsAccessTokenMock.mockReset();
    getTaskEditMetadataMock.mockReset();
    hasAzureDevOpsConfigMock.mockReset();
    hasAzureDevOpsConfigMock.mockReturnValue(true);
  });

  it("rejects invalid task ids", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/tasks/abc/editable-metadata"),
      { params: Promise.resolve({ id: "abc" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid task id." });
  });

  it("loads task edit metadata", async () => {
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    getTaskEditMetadataMock.mockResolvedValue({ priorities: ["1", "2", "3"] });

    const response = await GET(
      new NextRequest("http://localhost/api/tasks/42/editable-metadata"),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      item: { priorities: ["1", "2", "3"] },
    });
    expect(getTaskEditMetadataMock).toHaveBeenCalledWith("token", 42, {});
  });
});
