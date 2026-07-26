import {
  listTasks,
  type AzureDevOpsTask,
} from "@/lib/azure-devops/tasks";
import type { AzureDevOpsProject } from "@/lib/azure-devops/projects";
import {
  getPublicAzureDevOpsError,
  type PublicAzureDevOpsError,
} from "@/lib/azure-devops/errors";
import { reportAzureDevOpsError } from "@/lib/azure-devops/report-error";
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
  error: PublicAzureDevOpsError | null;
  filterOptions: TaskFilterOptions;
  items: AzureDevOpsTask[];
};

type LoadTaskListOptions = {
  includeFilterOptions?: boolean;
  maxItems?: number;
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

    const items = await listTasks(
      accessToken,
      selectedProjects,
      serverScopedFilters,
      {
        maxItems: options.maxItems,
      },
    );

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
    reportAzureDevOpsError(error);

    return {
      error: getPublicAzureDevOpsError(error),
      filterOptions: getEmptyTaskFilterOptions(),
      items: [],
    };
  }
}
