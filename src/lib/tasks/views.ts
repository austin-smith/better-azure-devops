import type { TaskListFilters } from "@/lib/azure-devops/tasks";

export type TaskViewDefinition = {
  filters: TaskListFilters;
  label: string;
  shortLabel: string;
  slug: string;
  title: string;
};

const BUILT_IN_TASK_VIEWS = [
  {
    slug: "all",
    label: "All tasks",
    shortLabel: "All",
    title: "Tasks",
    filters: {},
  },
  {
    slug: "mine",
    label: "My tasks",
    shortLabel: "Mine",
    title: "My Tasks",
    filters: { assignee: "me" },
  },
] as const satisfies ReadonlyArray<TaskViewDefinition>;

export function listTaskViews() {
  return BUILT_IN_TASK_VIEWS;
}

export function getDefaultTaskView() {
  return BUILT_IN_TASK_VIEWS[0];
}

export function getTaskView(viewSlug: string) {
  return BUILT_IN_TASK_VIEWS.find((view) => view.slug === viewSlug) ?? null;
}
