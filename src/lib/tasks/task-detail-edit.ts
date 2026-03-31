import type { AzureDevOpsTaskDetail } from "@/lib/azure-devops/tasks";

export type TaskDetailEditableAssignee = {
  avatarUrl: string | null;
  label: string;
  value: string | null;
};

export type TaskDetailEditableValues = {
  areaPath: string;
  assignee: TaskDetailEditableAssignee;
  iterationPath: string;
  priority: string;
  title: string;
};

export type TaskDetailEditableChanges = Partial<{
  areaPath: string;
  assignee: string | null;
  iterationPath: string;
  priority: string;
  title: string;
}>;

function normalizeEditableString(value: string) {
  return value.trim();
}

function normalizeEditableAssignee(
  assignee: TaskDetailEditableAssignee,
): TaskDetailEditableAssignee {
  const label = normalizeEditableString(assignee.label);
  const value = assignee.value?.trim() || null;

  return {
    avatarUrl: assignee.avatarUrl,
    label: label || "Unassigned",
    value,
  };
}

function comparableAssigneeValue(assignee: TaskDetailEditableAssignee) {
  return assignee.value ?? normalizeEditableString(assignee.label) ?? null;
}

export function createTaskDetailEditableValues(
  detail: Pick<
    AzureDevOpsTaskDetail,
    "areaPath" | "assignee" | "assigneeAvatarUrl" | "assigneeValue" | "iterationPath" | "priority" | "title"
  >,
): TaskDetailEditableValues {
  return normalizeTaskDetailEditableValues({
    areaPath: detail.areaPath,
    assignee: {
      avatarUrl: detail.assigneeAvatarUrl,
      label: detail.assignee,
      value: detail.assigneeValue,
    },
    iterationPath: detail.iterationPath,
    priority: detail.priority,
    title: detail.title,
  });
}

export function normalizeTaskDetailEditableValues(
  values: TaskDetailEditableValues,
): TaskDetailEditableValues {
  return {
    areaPath: normalizeEditableString(values.areaPath),
    assignee: normalizeEditableAssignee(values.assignee),
    iterationPath: normalizeEditableString(values.iterationPath),
    priority: normalizeEditableString(values.priority),
    title: normalizeEditableString(values.title),
  };
}

export function getTaskDetailEditableChanges(
  initialValues: TaskDetailEditableValues,
  draftValues: TaskDetailEditableValues,
): TaskDetailEditableChanges {
  const initial = normalizeTaskDetailEditableValues(initialValues);
  const draft = normalizeTaskDetailEditableValues(draftValues);
  const changes: TaskDetailEditableChanges = {};

  if (draft.title !== initial.title) {
    changes.title = draft.title;
  }

  if (draft.priority !== initial.priority) {
    changes.priority = draft.priority;
  }

  if (draft.areaPath !== initial.areaPath) {
    changes.areaPath = draft.areaPath;
  }

  if (draft.iterationPath !== initial.iterationPath) {
    changes.iterationPath = draft.iterationPath;
  }

  if (comparableAssigneeValue(draft.assignee) !== comparableAssigneeValue(initial.assignee)) {
    changes.assignee = draft.assignee.value;
  }

  return changes;
}

export function hasTaskDetailEditableChanges(
  initialValues: TaskDetailEditableValues,
  draftValues: TaskDetailEditableValues,
) {
  return Object.keys(getTaskDetailEditableChanges(initialValues, draftValues)).length > 0;
}

export function applyTaskDetailEditableValues(
  detail: AzureDevOpsTaskDetail,
  values: TaskDetailEditableValues,
): AzureDevOpsTaskDetail {
  const normalizedValues = normalizeTaskDetailEditableValues(values);

  return {
    ...detail,
    areaPath: normalizedValues.areaPath,
    assignee: normalizedValues.assignee.label,
    assigneeAvatarUrl: normalizedValues.assignee.avatarUrl,
    assigneeValue: normalizedValues.assignee.value,
    iterationPath: normalizedValues.iterationPath,
    priority: normalizedValues.priority,
    title: normalizedValues.title,
  };
}
