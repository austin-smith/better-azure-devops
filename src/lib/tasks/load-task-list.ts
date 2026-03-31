import {
  listTasks,
  type AzureDevOpsTask,
} from "@/lib/azure-devops/tasks";
import type { AzureDevOpsProject } from "@/lib/azure-devops/projects";
import {
  applyTaskListFilters,
  areTaskListFiltersEqual,
  getDefaultTaskListFilters,
  getEmptyTaskFilterOptions,
  getTaskFilterOptions,
  type TaskFilterOptions,
  type TaskListFilters,
} from "@/lib/tasks/filters";

type LoadTaskListResult = {
  error: string | null;
  filterOptions: TaskFilterOptions;
  items: AzureDevOpsTask[];
};

type LoadTaskListOptions = {
  includeFilterOptions?: boolean;
};

function getServerScopedFilters(filters: TaskListFilters): TaskListFilters {
  return {
    areaPath: filters.areaPath,
    assignee: filters.assignee === "me" ? "me" : null,
    iterationPath: filters.iterationPath,
    priorities: filters.priorities,
    query: "",
    states: filters.states,
    types: filters.types,
  };
}

export async function loadTaskList(
  accessToken: string,
  selectedProjects: readonly AzureDevOpsProject[],
  filters: TaskListFilters,
  options: LoadTaskListOptions = {},
): Promise<LoadTaskListResult> {
  try {
    const includeFilterOptions = options.includeFilterOptions ?? false;
    const serverScopedFilters = getServerScopedFilters(filters);
    const hasServerScopedFilters = !areTaskListFiltersEqual(
      serverScopedFilters,
      getDefaultTaskListFilters(),
    );

    if (includeFilterOptions) {
      const [allItems, scopedItems] = await Promise.all([
        listTasks(accessToken, selectedProjects),
        hasServerScopedFilters
          ? listTasks(accessToken, selectedProjects, serverScopedFilters)
          : Promise.resolve<AzureDevOpsTask[] | null>(null),
      ]);

      return {
        error: null,
        filterOptions: getTaskFilterOptions(allItems, filters),
        items: applyTaskListFilters(
          scopedItems ?? allItems,
          {
            ...filters,
            query: "",
          },
          {
            assigneeAlreadyScopedToMe: hasServerScopedFilters
              ? serverScopedFilters.assignee === "me"
              : false,
          },
        ),
      };
    }

    const items = await listTasks(accessToken, selectedProjects, serverScopedFilters);

    return {
      error: null,
      filterOptions: getEmptyTaskFilterOptions(),
      items: applyTaskListFilters(
        items,
        {
          ...filters,
          query: "",
        },
        {
          assigneeAlreadyScopedToMe: serverScopedFilters.assignee === "me",
        },
      ),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load work items.",
      filterOptions: getEmptyTaskFilterOptions(),
      items: [],
    };
  }
}
