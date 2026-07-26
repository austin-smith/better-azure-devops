import type { Metadata } from "next";
import { TaskTable } from "@/components/tasks/task-table";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import type { AzureDevOpsProject } from "@/lib/azure-devops/projects";
import type { AzureDevOpsTask } from "@/lib/azure-devops/tasks";
import {
  hasAzureDevOpsConfig,
} from "@/lib/azure-devops/config";
import {
  createPublicAzureDevOpsError,
  getPublicAzureDevOpsError,
} from "@/lib/azure-devops/errors";
import { getDefaultWorkItemTypes } from "@/lib/tasks/work-item-type";
import {
  getTaskListTitle,
  normalizeTaskListFilters,
  parseTaskListFilters,
  type TaskFilterOptions,
  type TaskListSearchParams,
} from "@/lib/tasks/filters";
import { loadTaskList } from "@/lib/tasks/load-task-list";

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
  let error = hasAzureDevOpsConfig()
    ? null
    : createPublicAzureDevOpsError("missing_config");
  let filterOptions: TaskFilterOptions = {
    assignees: [],
    priorities: [],
    states: [],
    types: getDefaultWorkItemTypes(),
  };
  let items: AzureDevOpsTask[] = [];
  let selectedProjects: Pick<
    AzureDevOpsProject,
    "defaultTeamImageUrl" | "id" | "name"
  >[] = [];
  let activeProjectCount = 0;

  if (hasAzureDevOpsConfig()) {
    filters = normalizeTaskListFilters(parsedFilters);

    try {
      const accessToken = await getAzureDevOpsAccessToken();
      const selection = await loadAzureDevOpsProjectSelection(accessToken);
      activeProjectCount = selection.selectedProjects.length;
      selectedProjects = selection.selectedProjects.map((project) => ({
        defaultTeamImageUrl: project.defaultTeamImageUrl,
        id: project.id,
        name: project.name,
      }));

      if (selection.selectedProjects.length === 0) {
        error = createPublicAzureDevOpsError("project_selection_required");
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
      error = getPublicAzureDevOpsError(loadError);
    }
  }

  return (
    <TaskTable
      error={error}
      filterOptions={filterOptions}
      filters={filters}
      items={items}
      projects={selectedProjects}
      title={title}
      activeProjectCount={activeProjectCount}
    />
  );
}
