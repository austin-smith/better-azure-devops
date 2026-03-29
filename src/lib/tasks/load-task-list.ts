import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import {
  listTasks,
  type AzureDevOpsTask,
} from "@/lib/azure-devops/tasks";
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
  };
}

export async function loadTaskList(
  filters: TaskListFilters,
  options: LoadTaskListOptions = {},
): Promise<LoadTaskListResult> {
  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const includeFilterOptions = options.includeFilterOptions ?? false;
    const serverScopedFilters = getServerScopedFilters(filters);
    const hasServerScopedFilters = !areTaskListFiltersEqual(
      serverScopedFilters,
      getDefaultTaskListFilters(),
    );

    if (includeFilterOptions) {
      const [allItems, scopedItems] = await Promise.all([
        listTasks(accessToken),
        hasServerScopedFilters
          ? listTasks(accessToken, serverScopedFilters)
          : Promise.resolve<AzureDevOpsTask[] | null>(null),
      ]);

      return {
        error: null,
        filterOptions: getTaskFilterOptions(allItems, filters),
        items: applyTaskListFilters(scopedItems ?? allItems, filters, {
          assigneeAlreadyScopedToMe: hasServerScopedFilters
            ? serverScopedFilters.assignee === "me"
            : false,
        }),
      };
    }

    const items = await listTasks(accessToken, serverScopedFilters);

    return {
      error: null,
      filterOptions: getEmptyTaskFilterOptions(),
      items: applyTaskListFilters(items, filters, {
        assigneeAlreadyScopedToMe: serverScopedFilters.assignee === "me",
      }),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load tasks.",
      filterOptions: getEmptyTaskFilterOptions(),
      items: [],
    };
  }
}
