import type { AzureDevOpsTask } from "@/lib/azure-devops/tasks";
import {
  normalizeWorkItemTypes,
} from "@/lib/tasks/work-item-type";

type SearchParamValue = string | string[] | undefined;

export type TaskListSearchParams = Readonly<Record<string, SearchParamValue>>;

export type TaskListFilterInput = Readonly<{
  areaPath?: string | null;
  assignee?: string | null;
  iterationPath?: string | null;
  priorities?: readonly string[];
  query?: string;
  states?: readonly string[];
  types?: readonly string[];
}>;

export type TaskListFilters = Readonly<{
  areaPath: string | null;
  assignee: string | null;
  iterationPath: string | null;
  priorities: readonly string[];
  query: string;
  states: readonly string[];
  types: readonly string[];
}>;

export type TaskFilterOptions = Readonly<{
  assignees: readonly string[];
  priorities: readonly string[];
  states: readonly string[];
  types: readonly string[];
}>;

export type TaskFilterPreset = Readonly<{
  filters: TaskListFilters;
  key: "all" | "mine";
  label: string;
  title: string;
}>;

type TaskFilterableTask = Pick<
  AzureDevOpsTask,
  | "areaPath"
  | "assignee"
  | "id"
  | "iterationPath"
  | "priority"
  | "projectId"
  | "projectName"
  | "state"
  | "title"
  | "type"
>;

const EMPTY_FILTER_OPTIONS: TaskFilterOptions = {
  assignees: [],
  priorities: [],
  states: [],
  types: [],
};

function compareAlphabetical(left: string, right: string) {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function comparePriority(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const leftIsNumeric = Number.isFinite(leftNumber);
  const rightIsNumeric = Number.isFinite(rightNumber);

  if (leftIsNumeric && rightIsNumeric && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  if (leftIsNumeric !== rightIsNumeric) {
    return leftIsNumeric ? -1 : 1;
  }

  return compareAlphabetical(left, right);
}

function normalizeSingleValue(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizeTaskPathValue(value: string | null | undefined) {
  const normalizedValue = normalizeSingleValue(value);

  if (!normalizedValue) {
    return null;
  }

  const segments = normalizedValue
    .split("\\")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.length > 0 ? segments.join("\\") : null;
}

function dedupeStrings(values: readonly string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalizedValue = normalizeSingleValue(value);

    if (!normalizedValue) {
      continue;
    }

    const key = normalizedValue.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalizedValue);
  }

  return result;
}

function normalizeArrayValues(
  values: readonly string[] | undefined,
  compare: (left: string, right: string) => number,
) {
  return dedupeStrings(values ?? []).sort(compare);
}

function normalizeTypeFilterValues(values: readonly string[] | undefined) {
  return normalizeWorkItemTypes(values);
}

function readFirstValue(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return normalizeSingleValue(value[0]);
  }

  return normalizeSingleValue(value);
}

function readManyValues(value: SearchParamValue) {
  if (!value) {
    return [];
  }

  return Array.isArray(value)
    ? value.map((item) => item.trim()).filter(Boolean)
    : [value.trim()].filter(Boolean);
}

function normalizeMatchValue(value: string) {
  return value.trim().toLowerCase();
}

export function getDefaultTaskListFilters(): TaskListFilters {
  return {
    areaPath: null,
    assignee: null,
    iterationPath: null,
    priorities: [],
    query: "",
    states: [],
    types: [],
  };
}

export function getEmptyTaskFilterOptions(): TaskFilterOptions {
  return EMPTY_FILTER_OPTIONS;
}

export function normalizeTaskListFilters(
  filters: TaskListFilterInput = {},
): TaskListFilters {
  return {
    areaPath: normalizeTaskPathValue(filters.areaPath),
    assignee: normalizeSingleValue(filters.assignee),
    iterationPath: normalizeTaskPathValue(filters.iterationPath),
    priorities: normalizeArrayValues(filters.priorities, comparePriority),
    query: normalizeSingleValue(filters.query) ?? "",
    states: normalizeArrayValues(filters.states, compareAlphabetical),
    types: normalizeTypeFilterValues(filters.types),
  };
}

export function parseTaskListFilters(
  searchParams: TaskListSearchParams,
): TaskListFilters {
  return normalizeTaskListFilters({
    areaPath: readFirstValue(searchParams.areaPath),
    assignee: readFirstValue(searchParams.assignee),
    iterationPath: readFirstValue(searchParams.iterationPath),
    priorities: readManyValues(searchParams.priority),
    query: readFirstValue(searchParams.q) ?? "",
    states: readManyValues(searchParams.state),
    types: readManyValues(searchParams.type),
  });
}

export function createTaskListSearchParams(
  filters: TaskListFilterInput = {},
) {
  const normalizedFilters = normalizeTaskListFilters(filters);
  const searchParams = new URLSearchParams();

  if (normalizedFilters.areaPath) {
    searchParams.set("areaPath", normalizedFilters.areaPath);
  }

  if (normalizedFilters.query) {
    searchParams.set("q", normalizedFilters.query);
  }

  if (normalizedFilters.assignee) {
    searchParams.set("assignee", normalizedFilters.assignee);
  }

  if (normalizedFilters.iterationPath) {
    searchParams.set("iterationPath", normalizedFilters.iterationPath);
  }

  for (const state of normalizedFilters.states) {
    searchParams.append("state", state);
  }

  for (const priority of normalizedFilters.priorities) {
    searchParams.append("priority", priority);
  }

  for (const type of normalizedFilters.types) {
    searchParams.append("type", type);
  }

  return searchParams;
}

export function areTaskListFiltersEqual(
  left: TaskListFilterInput,
  right: TaskListFilterInput,
) {
  const normalizedLeft = normalizeTaskListFilters(left);
  const normalizedRight = normalizeTaskListFilters(right);

  return (
    normalizedLeft.areaPath === normalizedRight.areaPath &&
    normalizedLeft.assignee === normalizedRight.assignee &&
    normalizedLeft.iterationPath === normalizedRight.iterationPath &&
    normalizedLeft.query === normalizedRight.query &&
    normalizedLeft.states.length === normalizedRight.states.length &&
    normalizedLeft.priorities.length === normalizedRight.priorities.length &&
    normalizedLeft.types.length === normalizedRight.types.length &&
    normalizedLeft.states.every((value, index) => value === normalizedRight.states[index]) &&
    normalizedLeft.types.every((value, index) => value === normalizedRight.types[index]) &&
    normalizedLeft.priorities.every(
      (value, index) => value === normalizedRight.priorities[index],
    )
  );
}

export function isTaskListFiltered(filters: TaskListFilterInput) {
  return !areTaskListFiltersEqual(filters, getDefaultTaskListFilters());
}

const TASK_FILTER_PRESETS = [
  {
    key: "all",
    label: "Work Items",
    title: "Work Items",
    filters: getDefaultTaskListFilters(),
  },
  {
    key: "mine",
    label: "Your Queue",
    title: "Your Queue",
    filters: normalizeTaskListFilters({ assignee: "me" }),
  },
] as const satisfies ReadonlyArray<TaskFilterPreset>;

export function listTaskFilterPresets() {
  return TASK_FILTER_PRESETS;
}

export function getActiveTaskFilterPreset(filters: TaskListFilterInput) {
  return (
    TASK_FILTER_PRESETS.find((preset) =>
      areTaskListFiltersEqual(preset.filters, filters),
    ) ?? null
  );
}

export function getTaskListTitle(filters: TaskListFilterInput) {
  const preset = getActiveTaskFilterPreset(filters);

  if (preset) {
    return preset.title;
  }

  return isTaskListFiltered(filters) ? "Filtered Work Items" : "Work Items";
}

export function getTaskFilterOptions<T extends TaskFilterableTask>(
  tasks: readonly T[],
  selectedFilters: TaskListFilterInput = {},
): TaskFilterOptions {
  const normalizedFilters = normalizeTaskListFilters(selectedFilters);
  const assignees = dedupeStrings(
    tasks
      .map((task) => task.assignee)
      .filter(
        (assignee) => normalizeMatchValue(assignee) !== normalizeMatchValue("Unassigned"),
      ),
  ).sort(compareAlphabetical);
  const states = normalizeArrayValues(
    [...tasks.map((task) => task.state), ...normalizedFilters.states],
    compareAlphabetical,
  );
  const priorities = normalizeArrayValues(
    [...tasks.map((task) => task.priority), ...normalizedFilters.priorities],
    comparePriority,
  );
  const types = normalizeWorkItemTypes([
    ...tasks.map((task) => task.type),
    ...normalizedFilters.types,
  ]);

  if (
    normalizedFilters.assignee &&
    normalizedFilters.assignee !== "me" &&
    normalizeMatchValue(normalizedFilters.assignee) !== normalizeMatchValue("Unassigned") &&
    !assignees.some(
      (assignee) =>
        normalizeMatchValue(assignee) === normalizeMatchValue(normalizedFilters.assignee ?? ""),
    )
  ) {
    assignees.push(normalizedFilters.assignee);
    assignees.sort(compareAlphabetical);
  }

  return {
    assignees,
    priorities,
    states,
    types,
  };
}

function matchesTaskPath(selectedPath: string | null, taskPath: string) {
  const normalizedSelectedPath = normalizeTaskPathValue(selectedPath);

  if (!normalizedSelectedPath) {
    return true;
  }

  const normalizedTaskPath = normalizeTaskPathValue(taskPath);

  if (!normalizedTaskPath) {
    return false;
  }

  const selectedKey = normalizedSelectedPath.toLowerCase();
  const taskKey = normalizedTaskPath.toLowerCase();

  return taskKey === selectedKey || taskKey.startsWith(`${selectedKey}\\`);
}

export function getTaskPathLeaf(path: string | null | undefined) {
  const normalizedPath = normalizeTaskPathValue(path);

  if (!normalizedPath) {
    return "";
  }

  const segments = normalizedPath.split("\\");
  return segments.at(-1) ?? normalizedPath;
}

export function getCompactTaskPathBreadcrumb(path: string | null | undefined) {
  const normalizedPath = normalizeTaskPathValue(path);

  if (!normalizedPath) {
    return "";
  }

  const segments = normalizedPath.split("\\");

  if (segments.length <= 3) {
    return segments.join(" / ");
  }

  const root = segments[0];
  const parent = segments.at(-2);
  const leaf = segments.at(-1);

  return [root, "...", parent, leaf].filter(Boolean).join(" / ");
}

type ApplyTaskListFiltersOptions = Readonly<{
  assigneeAlreadyScopedToMe?: boolean;
}>;

export function applyTaskListFilters<T extends TaskFilterableTask>(
  tasks: readonly T[],
  filters: TaskListFilterInput,
  options: ApplyTaskListFiltersOptions = {},
) {
  const normalizedFilters = normalizeTaskListFilters(filters);
  const queryTokens = normalizedFilters.query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return tasks.filter((task) => {
    if (!matchesTaskPath(normalizedFilters.areaPath, task.areaPath)) {
      return false;
    }

    if (normalizedFilters.assignee === "me") {
      if (!options.assigneeAlreadyScopedToMe) {
        return false;
      }
    } else if (normalizedFilters.assignee) {
      const assigneeMatches =
        normalizeMatchValue(task.assignee) ===
        normalizeMatchValue(normalizedFilters.assignee);

      if (!assigneeMatches) {
        return false;
      }
    }

    if (normalizedFilters.states.length > 0) {
      const normalizedState = normalizeMatchValue(task.state);

      if (
        !normalizedFilters.states.some(
          (state) => normalizeMatchValue(state) === normalizedState,
        )
      ) {
        return false;
      }
    }

    if (!matchesTaskPath(normalizedFilters.iterationPath, task.iterationPath)) {
      return false;
    }

    if (normalizedFilters.types.length > 0) {
      const normalizedType = normalizeMatchValue(task.type);

      if (
        !normalizedFilters.types.some(
          (type) => normalizeMatchValue(type) === normalizedType,
        )
      ) {
        return false;
      }
    }

    if (normalizedFilters.priorities.length > 0) {
      const normalizedPriority = normalizeMatchValue(task.priority);

      if (
        !normalizedFilters.priorities.some(
          (priority) => normalizeMatchValue(priority) === normalizedPriority,
        )
      ) {
        return false;
      }
    }

    if (queryTokens.length === 0) {
      return true;
    }

    const haystack = [
      String(task.id),
      task.title,
      task.projectName,
      task.state,
      task.priority,
      task.assignee,
      task.areaPath,
      task.iterationPath,
      task.type,
    ]
      .join(" ")
      .toLowerCase();

    return queryTokens.every((token) => haystack.includes(token));
  });
}
