// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskDetail } from "@/app/tasks/[id]/_components/task-detail-client";
import {
  createPublicAzureDevOpsError,
  type PublicAzureDevOpsError,
} from "@/lib/azure-devops/errors";
import type { AzureDevOpsTaskDetail } from "@/lib/azure-devops/tasks";
import type { TaskDetailEditableValues } from "@/lib/tasks/task-detail-edit";

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
    draftValues,
    onDraftChange,
    onRetrySave,
    saveErrorDetails,
  }: {
    draftValues: TaskDetailEditableValues | null;
    onDraftChange: (values: TaskDetailEditableValues) => void;
    onRetrySave: () => void;
    saveErrorDetails: PublicAzureDevOpsError | null;
  }) =>
    (
      <div>
        <span data-testid="draft-title">{draftValues?.title}</span>
        <span data-testid="draft-description">
          {draftValues?.description}
        </span>
        {draftValues ? (
          <button
            onClick={() => {
              onDraftChange({
                ...draftValues,
                title: "Locally updated title",
              });
            }}
            type="button"
          >
            Edit title
          </button>
        ) : null}
        {saveErrorDetails ? (
          <>
            <span>{saveErrorDetails.title}</span>
            <span data-testid="recovery-command-count">
              {saveErrorDetails.recoveryCommands.length}
            </span>
            {saveErrorDetails.canRetry && saveErrorDetails.actionLabel ? (
              <button onClick={onRetrySave} type="button">
                {saveErrorDetails.actionLabel}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    ),
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

  it("reconstructs complete retry details from an untrusted create response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Untrusted response message.",
          errorDetails: {
            code: "network",
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 502,
        },
      ),
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
      await screen.findByRole("button", { name: "Try again" }),
    ).toBeVisible();
    expect(screen.getByText("Cannot reach Azure DevOps")).toBeVisible();
    expect(screen.getByTestId("recovery-command-count")).toHaveTextContent("0");
  });

  it("preserves local edits while rebasing conflict recovery onto the latest revision", async () => {
    const conflictError =
      createPublicAzureDevOpsError("revision_conflict");
    const latestDetail = {
      ...detail,
      description: {
        content: "Remotely updated description",
        format: "markdown" as const,
      },
      priority: "1",
      revision: 2,
      title: "Remotely updated title",
    };
    const patchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: conflictError.message,
            errorDetails: conflictError,
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 409,
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            item: {
              ...latestDetail,
              revision: 3,
              title: "Locally updated title",
            },
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        ),
      );
    const taskReloadMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errorDetails: {
              code: "network",
            },
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 502,
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ item: latestDetail }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      );
    const fetchMock = vi.fn(
      (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => {
        if (init?.method === "PATCH") {
          return patchMock(input, init);
        }

        if (!String(input).includes("/editable-metadata")) {
          return taskReloadMock(input, init);
        }

        return Promise.resolve(
          new Response(JSON.stringify({ item: { priorities: [] } }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          }),
        );
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    render(
      <TaskDetail
        detail={detail}
        detailError={null}
        taskId={42}
        taskListHref="/tasks"
        taskListLabel="Tasks"
        taskProjectId="project-id"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit title" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Reload latest version",
      }),
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Try again",
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("draft-title")).toHaveTextContent(
        "Locally updated title",
      );
      expect(screen.getByTestId("draft-description")).toHaveTextContent(
        "Remotely updated description",
      );
    });
    expect(taskReloadMock).toHaveBeenNthCalledWith(
      1,
      "/api/tasks/42?project=project-id",
      undefined,
    );
    expect(taskReloadMock).toHaveBeenNthCalledWith(
      2,
      "/api/tasks/42?project=project-id",
      undefined,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledTimes(2);
    });

    expect(
      JSON.parse(String(patchMock.mock.calls[1]?.[1]?.body)),
    ).toEqual({
      changes: {
        title: "Locally updated title",
      },
      revision: 2,
    });
  });
});
