import { POST } from "@/app/api/repos/[projectId]/[repositoryId]/analytics/refresh/route";

const {
  enqueueRepositorySyncMock,
  getAzureDevOpsAccessTokenMock,
  getRepositoryMock,
  isRepositoryAnalyticsEnabledMock,
  loadAzureDevOpsProjectSelectionMock,
  saveRepositoryMock,
} = vi.hoisted(() => ({
  enqueueRepositorySyncMock: vi.fn(),
  getAzureDevOpsAccessTokenMock: vi.fn(),
  getRepositoryMock: vi.fn(),
  isRepositoryAnalyticsEnabledMock: vi.fn(),
  loadAzureDevOpsProjectSelectionMock: vi.fn(),
  saveRepositoryMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/access-token", () => ({
  getAzureDevOpsAccessToken: getAzureDevOpsAccessTokenMock,
}));
vi.mock("@/lib/azure-devops/git/repositories", () => ({
  getRepository: getRepositoryMock,
}));
vi.mock("@/lib/azure-devops/project-selection", () => ({
  loadAzureDevOpsProjectSelection:
    loadAzureDevOpsProjectSelectionMock,
}));
vi.mock("@/lib/analytics/refresh", () => ({
  enqueueRepositorySync: enqueueRepositorySyncMock,
  saveRepository: saveRepositoryMock,
}));
vi.mock("@/lib/analytics/settings", () => ({
  isRepositoryAnalyticsEnabled: isRepositoryAnalyticsEnabledMock,
}));

describe("POST repository analytics refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isRepositoryAnalyticsEnabledMock.mockReturnValue(true);
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    loadAzureDevOpsProjectSelectionMock.mockResolvedValue({
      selectedProjectIds: ["project"],
    });
  });

  it("rejects refreshes while repository analytics is disabled", async () => {
    isRepositoryAnalyticsEnabledMock.mockReturnValue(false);

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({
        projectId: "project",
        repositoryId: "repository",
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Enable repository analytics in Settings before syncing.",
    });
    expect(getAzureDevOpsAccessTokenMock).not.toHaveBeenCalled();
    expect(enqueueRepositorySyncMock).not.toHaveBeenCalled();
  });

  it("rejects a disabled repository before enqueueing work", async () => {
    getRepositoryMock.mockResolvedValue({
      id: "repository",
      isDisabled: true,
    });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({
        projectId: "project",
        repositoryId: "repository",
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "This repository is disabled in Azure DevOps.",
    });
    expect(saveRepositoryMock).toHaveBeenCalledOnce();
    expect(enqueueRepositorySyncMock).not.toHaveBeenCalled();
  });

  it("does not re-enable analytics for an unselected project", async () => {
    loadAzureDevOpsProjectSelectionMock.mockResolvedValueOnce({
      selectedProjectIds: [],
    });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({
        projectId: "project",
        repositoryId: "repository",
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "Select this Azure DevOps project before syncing analytics.",
    });
    expect(getRepositoryMock).not.toHaveBeenCalled();
    expect(saveRepositoryMock).not.toHaveBeenCalled();
    expect(enqueueRepositorySyncMock).not.toHaveBeenCalled();
  });
});
