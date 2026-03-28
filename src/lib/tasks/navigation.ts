import type { TaskView } from "@/lib/azure-devops/tasks";

const TASK_VIEW_DETAILS = {
  all: {
    href: "/",
    label: "All tasks",
    shortLabel: "All",
  },
  mine: {
    href: "/mine",
    label: "My tasks",
    shortLabel: "Mine",
  },
} as const satisfies Record<
  TaskView,
  {
    href: string;
    label: string;
    shortLabel: string;
  }
>;

function normalizeTaskView(
  value: string | string[] | null | undefined,
): TaskView | null {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (candidate === "all" || candidate === "mine") {
    return candidate;
  }

  return null;
}

export const TASK_VIEW_OPTIONS = [
  { id: "all", label: TASK_VIEW_DETAILS.all.shortLabel },
  { id: "mine", label: TASK_VIEW_DETAILS.mine.shortLabel },
] as const satisfies ReadonlyArray<{
  id: TaskView;
  label: string;
}>;

export function getTaskDetailHref(taskId: number, view: TaskView) {
  return `/tasks/${taskId}?view=${view}`;
}

export function getTaskViewHref(view: TaskView) {
  return TASK_VIEW_DETAILS[view].href;
}

export function getTaskViewLabel(view: TaskView) {
  return TASK_VIEW_DETAILS[view].label;
}

export function parseOptionalTaskView(
  value: string | string[] | null | undefined,
) {
  return normalizeTaskView(value);
}

export function parseTaskView(value: string | string[] | null | undefined) {
  return normalizeTaskView(value) ?? "all";
}
