import { AzureDevOpsError } from "@/lib/azure-devops/errors";
import { getDefaultTaskListFilters } from "@/lib/tasks/filters";
import { loadTaskList } from "@/lib/tasks/load-task-list";

const { listTasksMock } = vi.hoisted(() => ({
  listTasksMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/tasks", () => ({
  listTasks: listTasksMock,
}));

describe("loadTaskList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports private diagnostics before returning a public failure", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    listTasksMock.mockRejectedValue(
      new AzureDevOpsError("Private WIQL response details.", {
        code: "server",
        status: 503,
      }),
    );

    const result = await loadTaskList(
      "token",
      [
        {
          defaultTeamImageUrl: null,
          id: "project-id",
          name: "Project",
          state: "wellFormed",
          url: "https://dev.azure.com/example/_apis/projects/project-id",
        },
      ],
      getDefaultTaskListFilters(),
    );

    expect(result).toMatchObject({
      error: {
        code: "server",
      },
      items: [],
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Azure DevOps request failed.",
      expect.stringContaining(
        '"message":"Private WIQL response details."',
      ),
    );
  });
});
