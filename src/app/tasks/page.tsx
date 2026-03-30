import type { Metadata } from "next";
import { TaskTable } from "@/components/tasks/task-table";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import type { AzureDevOpsTask } from "@/lib/azure-devops/tasks";
import {
  hasAzureDevOpsConfig,
} from "@/lib/azure-devops/config";
import { getDefaultWorkItemTypes } from "@/lib/tasks/work-item-type";
import {
  getTaskListTitle,
  normalizeTaskListFilters,
  parseTaskListFilters,
  type TaskFilterOptions,
  type TaskListSearchParams,
} from "@/lib/tasks/filters";
import { loadTaskList } from "@/lib/tasks/load-task-list";

const MISSING_CONFIG_ERROR =
  "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL.";
const EMPTY_PROJECTS_ERROR =
  "Select at least one Azure DevOps project to load work items.";

type TaskListPageProps = {
  searchParams: Promise<TaskListSearchParams>;
};

export async function generateMetadata({
  searchParams,
}: TaskListPageProps): Promise<Metadata> {
  const filters = parseTaskListFilters(await searchParams);

  return {
    title: getTaskListTitle(filters),
  };
}

export default async function TaskListPage({
  searchParams,
}: TaskListPageProps) {
  const parsedFilters = parseTaskListFilters(await searchParams);
  const title = getTaskListTitle(parsedFilters);
  let filters = parsedFilters;
  let error = hasAzureDevOpsConfig() ? null : MISSING_CONFIG_ERROR;
  let filterOptions: TaskFilterOptions = {
    assignees: [],
    priorities: [],
    states: [],
    types: getDefaultWorkItemTypes(),
  };
  let items: AzureDevOpsTask[] = [];
  let activeProjectCount = 0;

  if (hasAzureDevOpsConfig()) {
    filters = normalizeTaskListFilters(parsedFilters);

    try {
      const accessToken = await getAzureDevOpsAccessToken();
      const selection = await loadAzureDevOpsProjectSelection(accessToken);
      activeProjectCount = selection.selectedProjects.length;

      if (selection.selectedProjects.length === 0) {
        error = EMPTY_PROJECTS_ERROR;
      } else {
        const result = await loadTaskList(
          accessToken,
          selection.selectedProjects,
          filters,
          { includeFilterOptions: true },
        );

        error = result.error;
        filterOptions = result.filterOptions;
        items = result.items;
      }
    } catch (loadError) {
      error = loadError instanceof Error ? loadError.message : "Failed to load work items.";
    }
  }

  return (
    <TaskTable
      error={error}
      filterOptions={filterOptions}
      filters={filters}
      items={items}
      title={title}
      activeProjectCount={activeProjectCount}
    />
  );
}
