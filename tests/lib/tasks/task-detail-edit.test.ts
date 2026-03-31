import {
  applyTaskDetailEditableValues,
  createTaskDetailEditableValues,
  getTaskDetailEditableChanges,
  hasTaskDetailEditableChanges,
} from "@/lib/tasks/task-detail-edit";

describe("task detail edit helpers", () => {
  const detail = {
    areaPath: "Project\\Area\\Platform",
    assignee: "Ada Lovelace",
    assigneeAvatarUrl: "https://example.com/ada.png",
    assigneeValue: "ada@example.com",
    iterationPath: "Project\\Iteration\\Sprint 1",
    priority: "2",
    title: "Investigate issue",
  };

  it("creates editable values from task detail data", () => {
    expect(createTaskDetailEditableValues(detail)).toEqual({
      areaPath: "Project\\Area\\Platform",
      assignee: {
        avatarUrl: "https://example.com/ada.png",
        label: "Ada Lovelace",
        value: "ada@example.com",
      },
      iterationPath: "Project\\Iteration\\Sprint 1",
      priority: "2",
      title: "Investigate issue",
    });
  });

  it("detects changed editable fields", () => {
    const initialValues = createTaskDetailEditableValues(detail);
    const draftValues = {
      ...initialValues,
      assignee: {
        avatarUrl: null,
        label: "Grace Hopper",
        value: "grace@example.com",
      },
      title: "Updated title",
    };

    expect(getTaskDetailEditableChanges(initialValues, draftValues)).toEqual({
      assignee: "grace@example.com",
      title: "Updated title",
    });
    expect(hasTaskDetailEditableChanges(initialValues, draftValues)).toBe(true);
  });

  it("applies editable values back to task detail data", () => {
    const nextValues = {
      ...createTaskDetailEditableValues(detail),
      priority: "1",
      title: "Updated title",
    };

    expect(
      applyTaskDetailEditableValues(
        {
          ...detail,
          comments: [],
          descriptionHtml: "",
          id: 42,
          linkedPullRequests: [],
          projectId: "project-id",
          projectImageUrl: null,
          projectName: "Project",
          reason: "Updated",
          revision: 7,
          state: "Active",
          tags: [],
          type: "Task",
          updatedAt: "2025-01-05T12:00:00.000Z",
          url: "https://example.com/task/42",
        },
        nextValues,
      ),
    ).toMatchObject({
      assignee: "Ada Lovelace",
      assigneeValue: "ada@example.com",
      priority: "1",
      title: "Updated title",
    });
  });
});
