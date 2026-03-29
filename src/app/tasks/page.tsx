import type { Metadata } from "next";
import { TaskTable } from "@/components/tasks/task-table";
import {
  getAzureDevOpsConfig,
  hasAzureDevOpsConfig,
} from "@/lib/azure-devops/config";
import { getDefaultWorkItemTypes } from "@/lib/tasks/work-item-type";
import {
  getTaskListTitle,
  parseTaskListFilters,
  type TaskListSearchParams,
} from "@/lib/tasks/filters";
import { loadTaskList } from "@/lib/tasks/load-task-list";

const MISSING_CONFIG_ERROR =
  "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_PROJECT.";

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
  const filters = parseTaskListFilters(await searchParams);
  const title = getTaskListTitle(filters);
  const config = hasAzureDevOpsConfig() ? getAzureDevOpsConfig() : null;
  const { error, filterOptions, items } = config
    ? await loadTaskList(filters, { includeFilterOptions: true })
    : {
        error: MISSING_CONFIG_ERROR,
        filterOptions: {
          assignees: [],
          priorities: [],
          states: [],
          types: getDefaultWorkItemTypes(),
        },
        items: [],
      };

  return (
    <TaskTable
      error={error}
      filterOptions={filterOptions}
      filters={filters}
      items={items}
      title={title}
    />
  );
}
