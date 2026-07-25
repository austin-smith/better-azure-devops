// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { TaskDetailHeader } from "@/app/tasks/[id]/_components/task-detail-header";
import type { AzureDevOpsTaskDetail } from "@/lib/azure-devops/tasks";

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

describe("TaskDetailHeader", () => {
  it("uses icon-aligned save and discard actions", () => {
    const { container } = render(
      <TaskDetailHeader
        detail={detail}
        isDirty
        isSaving={false}
        onDiscard={vi.fn()}
        onSave={vi.fn()}
        taskId={42}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Discard" })
        .querySelector('[data-icon="inline-start"]'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save" })
        .querySelector('[data-icon="inline-start"]'),
    ).toBeInTheDocument();
    expect(container.querySelector("h2")).toHaveClass("break-words");
    expect(screen.getByRole("button", { name: "Save" }).parentElement)
      .toHaveClass("shrink-0");
  });

  it("keeps save and discard disabled until there are changes", () => {
    render(
      <TaskDetailHeader
        detail={detail}
        isDirty={false}
        isSaving={false}
        onDiscard={vi.fn()}
        onSave={vi.fn()}
        taskId={42}
      />,
    );

    expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("calls save and discard actions when enabled", () => {
    const onDiscard = vi.fn();
    const onSave = vi.fn();

    render(
      <TaskDetailHeader
        detail={detail}
        isDirty
        isSaving={false}
        onDiscard={onDiscard}
        onSave={onSave}
        taskId={42}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
  });
});
