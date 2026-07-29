const { azureDevOpsRequestMock } = vi.hoisted(() => ({
  azureDevOpsRequestMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/client", () => ({
  azureDevOpsRequest: azureDevOpsRequestMock,
}));

import { listRepositoryCommitDiffs } from "@/lib/azure-devops/git/diffs";

const requestOptions = {
  baseCommitId: "base-commit",
  targetCommitId: "target-commit",
};

describe("repository commit diffs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    azureDevOpsRequestMock.mockResolvedValue({
      allChangesIncluded: true,
      changes: [],
    });
  });

  it("accepts a valid empty change collection", async () => {
    await expect(
      listRepositoryCommitDiffs(
        "token",
        "project-id",
        "repo-id",
        requestOptions,
      ),
    ).resolves.toEqual({
      allChangesIncluded: true,
      items: [],
      nextCursor: null,
    });
  });

  it.each([
    ["a missing collection", {}],
    ["a null collection", { changes: null }],
  ])("rejects %s", async (_description, response) => {
    azureDevOpsRequestMock.mockResolvedValueOnce(response);

    await expect(
      listRepositoryCommitDiffs(
        "token",
        "project-id",
        "repo-id",
        requestOptions,
      ),
    ).rejects.toMatchObject({
      descriptor: {
        kind: "malformed-response",
      },
    });
  });
});
