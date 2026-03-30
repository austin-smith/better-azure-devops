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
  options: {
    taskProjectId?: string | null;
  } = {},
) {
  const href = appendSearchParams(`/tasks/${taskId}`, filters);

  if (!options.taskProjectId) {
    return href;
  }

  const url = new URL(href, "http://localhost");
  url.searchParams.set("taskProject", options.taskProjectId);

  return `${url.pathname}${url.search}`;
}

export function getTaskListHref(filters: TaskListFilterInput = {}) {
  return appendSearchParams(TASK_LIST_PATH, filters);
}

export function getDefaultTaskListHref() {
  return getTaskListHref();
}
