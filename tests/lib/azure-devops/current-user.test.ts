import { loadCurrentAzureDevOpsUser } from "@/lib/azure-devops/current-user";

const {
  azureDevOpsRequestMock,
  getAzureDevOpsAccessTokenMock,
  listAssignableUsersMock,
} = vi.hoisted(() => ({
  azureDevOpsRequestMock: vi.fn(),
  getAzureDevOpsAccessTokenMock: vi.fn(),
  listAssignableUsersMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/access-token", () => ({
  getAzureDevOpsAccessToken: getAzureDevOpsAccessTokenMock,
}));

vi.mock("@/lib/azure-devops/client", () => ({
  azureDevOpsRequest: azureDevOpsRequestMock,
}));

vi.mock("@/lib/azure-devops/cache-scope", () => ({
  AZURE_DEVOPS_METADATA_REVALIDATE_SECONDS: 300,
  getAzureDevOpsMetadataCacheTags: () => ["test-cache-tag"],
}));

vi.mock("@/lib/azure-devops/tasks", () => ({
  listAssignableUsers: listAssignableUsersMock,
}));

describe("loadCurrentAzureDevOpsUser", () => {
  beforeEach(() => {
    azureDevOpsRequestMock.mockReset();
    getAzureDevOpsAccessTokenMock.mockReset();
    listAssignableUsersMock.mockReset();
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
  });

  it("returns the primary profile when supplementary identity calls fail", async () => {
    azureDevOpsRequestMock.mockImplementation((path: string) => {
      if (path.startsWith("/_apis/profile/")) {
        return Promise.resolve({
          displayName: "Ada Lovelace",
          emailAddress: "ada@example.com",
        });
      }

      return Promise.reject(new Error("Connection data unavailable"));
    });
    listAssignableUsersMock.mockRejectedValue(
      new Error("Assignable users unavailable"),
    );

    await expect(loadCurrentAzureDevOpsUser()).resolves.toEqual({
      avatarUrl: null,
      email: "ada@example.com",
      id: null,
      name: "Ada Lovelace",
    });
  });
});
