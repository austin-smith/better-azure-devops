import type { AzureDevOpsTask } from "@/lib/azure-devops/tasks";

export function createTask(
  overrides: Partial<AzureDevOpsTask> = {},
): AzureDevOpsTask {
  return {
    areaPath: "Project\\Area\\Team",
    assignee: "Ada Lovelace",
    assigneeAvatarUrl: null,
    descriptionHtml: "<p>Task description</p>",
    id: 101,
    iterationPath: "Project\\Iteration\\Sprint 1",
    priority: "2",
    projectId: "project-id",
    projectImageUrl: null,
    projectName: "Project",
    state: "Active",
    title: "Investigate pipeline failure",
    type: "Task",
    updatedAt: "2025-01-05T12:00:00.000Z",
    ...overrides,
  };
}
