import {
  createTaskListSearchParams,
  type TaskListFilterInput,
} from "@/lib/tasks/filters";

const TASK_LIST_PATH = "/tasks";

function appendSearchParams(pathname: string, filters: TaskListFilterInput = {}) {
  const searchParams = createTaskListSearchParams(filters);
  const query = searchParams.toString();

  if (!query) {
    return pathname;
  }

  return `${pathname}?${query}`;
}

export function getTaskDetailHref(
  taskId: number,
  filters: TaskListFilterInput = {},
) {
  return appendSearchParams(`/tasks/${taskId}`, filters);
}

export function getTaskListHref(filters: TaskListFilterInput = {}) {
  return appendSearchParams(TASK_LIST_PATH, filters);
}

export function getDefaultTaskListHref() {
  return getTaskListHref();
}
