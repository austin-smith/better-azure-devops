// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { TaskDetailContent } from "@/app/tasks/[id]/_components/task-detail-content";
import { createPublicAzureDevOpsError } from "@/lib/azure-devops/errors";
import type { AzureDevOpsTaskDetail } from "@/lib/azure-devops/tasks";

vi.mock("@/components/date-label", () => ({
  DateLabel: ({ value }: { value: string }) => <span>{value}</span>,
}));

vi.mock("@/components/tasks/markdown-editor", () => ({
  MarkdownEditor: ({
    ariaLabel = "Markdown content",
    modeAriaLabel = "Markdown editor mode",
    onChange,
    previewAriaLabel = "Markdown preview",
    statisticsAriaLabel = "Markdown statistics",
    toolbarAriaLabel = "Markdown formatting",
    value,
  }: {
    ariaLabel?: string;
    modeAriaLabel?: string;
    onChange: (value: string) => void;
    previewAriaLabel?: string;
    statisticsAriaLabel?: string;
    toolbarAriaLabel?: string;
    value: string;
  }) => (
    <div>
      <div aria-label={toolbarAriaLabel} role="toolbar" />
      <textarea
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      />
      <div aria-label={modeAriaLabel} role="group" />
      <div aria-label={previewAriaLabel} role="region" />
      <div aria-label={statisticsAriaLabel} role="group" />
    </div>
  ),
}));

vi.mock("@/components/tasks/task-markup", () => ({
  TaskMarkup: ({
    emptyMessage,
    markup,
  }: {
    emptyMessage?: string;
    markup?: {
      content: string;
      format: string;
    } | null;
  }) => (
    <div
      data-format={markup?.format ?? ""}
      data-testid="task-markup"
    >
      {markup?.content || emptyMessage}
    </div>
  ),
}));

vi.mock("@/app/tasks/[id]/_components/task-comments", () => ({
  TaskComments: () => null,
}));

const baseDetail: AzureDevOpsTaskDetail = {
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
};

describe("TaskDetailContent", () => {
  it("renders task detail load errors with the shared alert component", () => {
    render(
      <TaskDetailContent
        descriptionDraft="Initial **markdown**"
        detail={baseDetail}
        detailError={{
          ...createPublicAzureDevOpsError("server"),
          message: "Failed to load task details.",
        }}
        isSaving={false}
        mode="edit"
        onDescriptionChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Failed to load task details.",
    );
    expect(screen.getByRole("alert")).toHaveAttribute("data-slot", "alert");
  });

  it("keeps HTML descriptions rendered until the user edits", () => {
    render(
      <TaskDetailContent
        descriptionDraft="Initial **HTML**"
        detail={{
          ...baseDetail,
          description: {
            content: "<p>Initial <strong>HTML</strong></p>",
            format: "html",
          },
        }}
        detailError={null}
        isSaving={false}
        mode="edit"
        onDescriptionChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-markup")).toHaveAttribute("data-format", "html");
    expect(screen.queryByLabelText("Description markdown content")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit description" }));

    expect(screen.getByLabelText("Description markdown content"))
      .toHaveValue("Initial **HTML**");
  });

  it("keeps markdown descriptions rendered until the user edits", () => {
    const { container } = render(
      <TaskDetailContent
        descriptionDraft="Initial **markdown**"
        detail={baseDetail}
        detailError={null}
        isSaving={false}
        mode="edit"
        onDescriptionChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-markup")).toHaveAttribute(
      "data-format",
      "markdown",
    );
    expect(screen.getByRole("region", { name: "Description" }))
      .toContainElement(screen.getByTestId("task-markup"));
    expect(container.querySelector('[data-slot="card"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="card-content"]')).not.toBeNull();
    expect(screen.queryByLabelText("Description markdown content")).not.toBeInTheDocument();

    const editButton = screen.getByRole("button", { name: "Edit description" });
    const descriptionRegion = screen.getByRole("region", { name: "Description" });

    expect(editButton).toHaveAttribute("aria-controls", descriptionRegion.id);
    expect(editButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(editButton);

    expect(screen.getByLabelText("Description markdown content")).toHaveValue(
      "Initial **markdown**",
    );
    expect(screen.getByRole("region", { name: "Description" }))
      .toContainElement(screen.getByLabelText("Description markdown content"));
    expect(screen.getByRole("region", { name: "Description" }))
      .toContainElement(
        screen.getByRole("region", { name: "Description markdown preview" }),
      );
    expect(screen.getByRole("region", { name: "Description" }))
      .toContainElement(
        screen.getByRole("toolbar", { name: "Description markdown formatting" }),
      );
    expect(screen.getByRole("region", { name: "Description" }))
      .toContainElement(
        screen.getByRole("group", { name: "Description markdown editor mode" }),
      );
    expect(screen.getByRole("region", { name: "Description" }))
      .toContainElement(
        screen.getByRole("group", { name: "Description markdown statistics" }),
      );
    expect(screen.getByRole("button", { name: "Close description editor" }))
      .toHaveAttribute("aria-controls", descriptionRegion.id);
    expect(screen.getByRole("button", { name: "Close description editor" }))
      .toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Close description editor" }))
      .toHaveTextContent("Close");
  });

  it("marks the description region busy while saving", () => {
    render(
      <TaskDetailContent
        descriptionDraft="Initial **markdown**"
        detail={baseDetail}
        detailError={null}
        isSaving
        mode="edit"
        onDescriptionChange={vi.fn()}
      />,
    );

    const descriptionRegion = screen.getByRole("region", { name: "Description" });

    expect(descriptionRegion).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Edit description" })).toBeDisabled();
  });

  it("renders empty descriptions with the shared empty state component", () => {
    const { container } = render(
      <TaskDetailContent
        descriptionDraft=""
        detail={{
          ...baseDetail,
          description: {
            content: "",
            format: "markdown",
          },
        }}
        detailError={null}
        isSaving={false}
        mode="edit"
        onDescriptionChange={vi.fn()}
      />,
    );

    expect(screen.getByText("No description.")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="empty"]')).not.toBeNull();
    expect(screen.queryByTestId("task-markup")).not.toBeInTheDocument();
  });

  it("renders empty pull request lists with the shared empty state component", () => {
    const { container } = render(
      <TaskDetailContent
        descriptionDraft="Initial **markdown**"
        detail={baseDetail}
        detailError={null}
        isSaving={false}
        mode="edit"
        onDescriptionChange={vi.fn()}
      />,
    );

    expect(screen.getByText("No pull requests.")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="empty"]')).toHaveLength(1);
  });

  it("closes the editor while preserving the unsaved draft in the rendered description", () => {
    const { rerender } = render(
      <TaskDetailContent
        descriptionDraft="Initial **markdown**"
        detail={baseDetail}
        detailError={null}
        isSaving={false}
        mode="edit"
        onDescriptionChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit description" }));
    expect(screen.getByLabelText("Description markdown content")).toHaveValue(
      "Initial **markdown**",
    );

    rerender(
      <TaskDetailContent
        descriptionDraft="Changed **markdown**"
        descriptionHasUnsavedChanges
        detail={baseDetail}
        detailError={null}
        isSaving={false}
        mode="edit"
        onDescriptionChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close description editor" }));

    expect(screen.queryByLabelText("Description markdown content")).not.toBeInTheDocument();
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Description" }))
      .toHaveAccessibleDescription("Unsaved");
    expect(screen.getByTestId("task-markup")).toHaveTextContent(
      "Changed **markdown**",
    );
    expect(screen.getByTestId("task-markup")).toHaveAttribute(
      "data-format",
      "markdown",
    );
    expect(screen.getByRole("button", { name: "Edit description" })).toHaveFocus();
  });

  it("marks the description section when the description draft is unsaved", () => {
    render(
      <TaskDetailContent
        descriptionDraft="Changed **markdown**"
        descriptionHasUnsavedChanges
        detail={{
          ...baseDetail,
          description: {
            content: "Changed **markdown**",
            format: "markdown",
          },
        }}
        detailError={null}
        isSaving={false}
        mode="edit"
        onDescriptionChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Description" }))
      .toHaveAccessibleDescription("Unsaved");
    expect(screen.getByRole("button", { name: "Edit description" }))
      .toBeInTheDocument();
  });

  it("keeps the unsaved description marker visible while editing", () => {
    render(
      <TaskDetailContent
        descriptionDraft="Changed **markdown**"
        descriptionHasUnsavedChanges
        detail={{
          ...baseDetail,
          description: {
            content: "Changed **markdown**",
            format: "markdown",
          },
        }}
        detailError={null}
        isSaving={false}
        mode="edit"
        onDescriptionChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit description" }));

    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Description" }))
      .toHaveAccessibleDescription("Unsaved");
    expect(screen.getByRole("button", { name: "Close description editor" }))
      .toBeInTheDocument();
  });

  it("closes the description editor when the draft is discarded", () => {
    const { rerender } = render(
      <TaskDetailContent
        descriptionDraft="Initial **markdown**"
        detail={baseDetail}
        detailError={null}
        draftResetKey={0}
        isSaving={false}
        mode="edit"
        onDescriptionChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit description" }));
    expect(screen.getByLabelText("Description markdown content")).toHaveValue(
      "Initial **markdown**",
    );

    rerender(
      <TaskDetailContent
        descriptionDraft="Initial **markdown**"
        detail={baseDetail}
        detailError={null}
        draftResetKey={1}
        isSaving={false}
        mode="edit"
        onDescriptionChange={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Description markdown content")).not.toBeInTheDocument();
    expect(screen.getByTestId("task-markup")).toHaveTextContent(
      "Initial **markdown**",
    );
    expect(screen.getByRole("button", { name: "Edit description" }))
      .toBeInTheDocument();
  });

  it("opens new work items directly in the editor", () => {
    render(
      <TaskDetailContent
        descriptionDraft=""
        detail={{
          ...baseDetail,
          description: {
            content: "",
            format: "markdown",
          },
        }}
        detailError={null}
        isSaving={false}
        mode="create"
        onDescriptionChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit description" }))
      .not.toBeInTheDocument();
    expect(screen.getByLabelText("Description markdown content")).toHaveValue("");
    expect(screen.getByRole("toolbar", { name: "Description markdown formatting" }))
      .toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Description markdown editor mode" }))
      .toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Description markdown preview" }))
      .toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Description markdown statistics" }))
      .toBeInTheDocument();
  });

});
