import type { PublicAzureDevOpsError } from "@/lib/azure-devops/errors";

const { loadTaskDetailMock, notFoundMock } = vi.hoisted(() => ({
  loadTaskDetailMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/lib/tasks/load-task-detail", () => ({
  loadTaskDetail: loadTaskDetailMock,
}));

vi.mock("@/app/tasks/[id]/_components/task-detail-client", () => ({
  TaskDetail: () => null,
}));

describe("/tasks/[id] page", () => {
  beforeEach(() => {
    loadTaskDetailMock.mockReset();
    notFoundMock.mockClear();
  });

  it("uses the route not-found boundary for missing Azure DevOps work items", async () => {
    loadTaskDetailMock.mockResolvedValue({
      detail: null,
      error: {
        actionLabel: null,
        canRetry: false,
        code: "not_found",
        command: null,
        message: "The work item was not found.",
        retryAfterSeconds: null,
        title: "Work item not found",
      } satisfies PublicAzureDevOpsError,
    });

    const { default: TaskDetailPage } = await import("@/app/tasks/[id]/page");

    await expect(
      TaskDetailPage({
        params: Promise.resolve({ id: "42" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
