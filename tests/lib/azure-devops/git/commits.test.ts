import { getRepositoryCommitChanges } from "@/lib/azure-devops/git/commits";

const { azureDevOpsRequestMock } = vi.hoisted(() => ({
  azureDevOpsRequestMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/client", () => ({
  azureDevOpsRequest: azureDevOpsRequestMock,
}));

describe("Azure Git commits", () => {
  beforeEach(() => {
    azureDevOpsRequestMock.mockReset();
  });

  it("uses the commit-changes endpoint pagination parameters", async () => {
    azureDevOpsRequestMock.mockResolvedValue({ changes: [] });

    await getRepositoryCommitChanges(
      "token",
      "project id",
      "repository id",
      "commit/id",
      {
        cursor: "25",
        top: 50,
      },
    );

    expect(azureDevOpsRequestMock).toHaveBeenCalledWith(
      "/project%20id/_apis/git/repositories/repository%20id/commits/commit%2Fid/changes?skip=25&top=50",
      { accessToken: "token" },
    );
  });
});
