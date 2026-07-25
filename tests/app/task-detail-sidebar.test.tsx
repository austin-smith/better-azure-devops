// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskDetailSidebar } from "@/app/tasks/[id]/_components/task-detail-sidebar";
import type { AzureDevOpsTaskDetail } from "@/lib/azure-devops/tasks";
import { createTaskDetailEditableValues } from "@/lib/tasks/task-detail-edit";

vi.mock("@/components/date-label", () => ({
  DateLabel: ({ value }: { value: string }) => <span>{value}</span>,
}));

vi.mock("@/components/project-image", () => ({
  ProjectImage: ({ name }: { name: string }) => <span>{name}</span>,
}));

const detail = {
  areaPath: "Project\\Area",
  assignee: "Ada Lovelace",
  assigneeAvatarUrl: null,
  assigneeValue: "ada@example.com",
  comments: [],
  description: {
    content: "Initial **markdown**",
    format: "markdown",
  },
  id: 42,
  iterationPath: "Project\\Sprint 1",
  linkedPullRequests: [],
  priority: "2",
  projectId: "project-id",
  projectImageUrl: null,
  projectName: "Project",
  reason: "Updated",
  revision: 7,
  state: "Active",
  tags: [],
  title: "Investigate issue",
  type: "Task",
  updatedAt: "2025-01-05T12:00:00.000Z",
  url: "https://example.com/task/42",
} satisfies AzureDevOpsTaskDetail;

function renderSidebar(options: {
  editMetadataError?: string | null;
  saveError?: string | null;
} = {}) {
  return render(
    <TaskDetailSidebar
      detail={detail}
      draftValues={createTaskDetailEditableValues(detail)}
      editMetadata={{ priorities: ["1", "2", "3"] }}
      editMetadataError={options.editMetadataError ?? null}
      isDirty
      isLoadingEditMetadata={false}
      isSaving={false}
      onDraftChange={vi.fn()}
      saveError={options.saveError ?? null}
      taskProjectId="project-id"
    />,
  );
}

describe("TaskDetailSidebar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders save errors with the shared alert component", () => {
    renderSidebar({ saveError: "Failed to update task." });

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to update task.");
    expect(screen.getByRole("alert")).toHaveAttribute("data-slot", "alert");
  });

  it("renders edit metadata errors with the shared alert component", () => {
    renderSidebar({ editMetadataError: "Failed to load priorities." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Failed to load priorities.",
    );
    expect(screen.getByRole("alert")).toHaveAttribute("data-slot", "alert");
  });

  it("uses field labels for editable sidebar controls", () => {
    const { container } = renderSidebar();

    expect(screen.getByLabelText("Title")).toHaveValue("Investigate issue");
    expect(container.querySelector('label[for="task-detail-assignee"]'))
      .toHaveTextContent("Assignee");
    expect(container.querySelector('label[for="task-detail-priority"]'))
      .toHaveTextContent("Priority");
    expect(container.querySelector('label[for="task-detail-area"]'))
      .toHaveTextContent("Area");
    expect(container.querySelector('label[for="task-detail-iteration"]'))
      .toHaveTextContent("Iteration");
    expect(screen.getByRole("button", { name: "Assignee: Ada Lovelace" }))
      .toHaveTextContent("Ada Lovelace");
    expect(screen.getByRole("combobox", { name: "Priority: 2" }))
      .toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Area: Project\\Area" }))
      .toHaveTextContent("Project\\Area");
    expect(screen.getByRole("button", { name: "Iteration: Project\\Sprint 1" }))
      .toHaveTextContent("Project\\Sprint 1");
    expect(container.querySelector("label button")).toBeNull();
  });

  it("only enables sidebar scrolling in the desktop side-by-side layout", () => {
    const { container } = renderSidebar();
    const sidebar = container.querySelector("aside");

    expect(sidebar).toHaveClass("lg:overflow-y-auto");
    expect(sidebar).not.toHaveClass("overflow-y-auto");
  });

  it("renders lookup errors with the shared alert component", async () => {
    vi.stubGlobal("ResizeObserver", class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: "Failed to load areas." }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    )));

    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Area: Project\\Area" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to load areas.",
      );
    });
    expect(screen.getByRole("alert")).toHaveAttribute("data-slot", "alert");
  });

  it("labels lookup loading states", async () => {
    vi.stubGlobal("ResizeObserver", class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    });
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Area: Project\\Area" }));

    await waitFor(() => {
      expect(screen.getByText("Loading areas...")).toBeInTheDocument();
    });
  });
});
