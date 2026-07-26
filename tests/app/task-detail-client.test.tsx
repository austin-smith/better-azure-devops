// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskDetail } from "@/app/tasks/[id]/_components/task-detail-client";
import type { PublicAzureDevOpsError } from "@/lib/azure-devops/errors";
import type { AzureDevOpsTaskDetail } from "@/lib/azure-devops/tasks";

const routerPushMock = vi.fn();
const routerRefreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    refresh: routerRefreshMock,
  }),
}));

vi.mock("@/components/app-header", () => ({
  AppHeader: () => null,
}));

vi.mock("@/components/themes/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

vi.mock("@/app/tasks/[id]/_components/task-detail-content", () => ({
  TaskDetailContent: () => null,
}));

vi.mock("@/app/tasks/[id]/_components/task-detail-sidebar", () => ({
  TaskDetailSidebar: ({
    onRetrySave,
    saveErrorDetails,
  }: {
    onRetrySave: () => void;
    saveErrorDetails: PublicAzureDevOpsError | null;
  }) =>
    saveErrorDetails ? (
      <div>
        <span>{saveErrorDetails.title}</span>
        {saveErrorDetails.canRetry && saveErrorDetails.actionLabel ? (
          <button onClick={onRetrySave} type="button">
            {saveErrorDetails.actionLabel}
          </button>
        ) : null}
      </div>
    ) : null,
}));

vi.mock("@/components/project-image", () => ({
  ProjectImage: ({ name }: { name: string }) => <span>{name}</span>,
}));

const source =
  "https://dev.azure.com/example/project/_apis/wit/attachments/file?id=1";
const proxy = `/api/azure-devops/asset?src=${encodeURIComponent(source)}`;
const detail = {
  areaPath: "Project\\Area",
  assignee: "Unassigned",
  assigneeAvatarUrl: null,
  assigneeValue: null,
  comments: [],
  description: {
    content: [
      "[Ada Lovelace](./ado-mention/ada)",
      "",
      `![Diagram](${proxy})`,
    ].join("\n"),
    format: "markdown",
  },
  id: 0,
  iterationPath: "Project\\Sprint 1",
  linkedPullRequests: [],
  priority: "2",
  projectId: "project-id",
  projectImageUrl: null,
  projectName: "Project",
  reason: "",
  revision: 1,
  state: "New",
  tags: [],
  title: "Created task",
  type: "Task",
  updatedAt: "2025-01-05T12:00:00.000Z",
  url: "",
} satisfies AzureDevOpsTaskDetail;

describe("TaskDetail", () => {
  beforeEach(() => {
    routerPushMock.mockClear();
    routerRefreshMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serializes editor-only markdown before creating work items", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({
        item: {
          id: 99,
          projectId: "project-id",
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 201,
      },
    ));

    vi.stubGlobal("fetch", fetchMock);

    render(
      <TaskDetail
        createProjectId="project-id"
        detail={detail}
        detailError={null}
        mode="create"
        taskId={0}
        taskListHref="/tasks"
        taskListLabel="Tasks"
        taskProjectId="project-id"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/tasks",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      description?: string;
    };

    expect(body.description).toBe([
      "@<ada>",
      "",
      `![Diagram](${source})`,
    ].join("\n"));
  });

  it("does not offer a blind retry when create confirmation is lost", async () => {
    const fetchMock = vi.fn().mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(
      <TaskDetail
        createProjectId="project-id"
        detail={detail}
        detailError={null}
        mode="create"
        taskId={0}
        taskListHref="/tasks"
        taskListLabel="Tasks"
        taskProjectId="project-id"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Confirm the work item before retrying"),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
