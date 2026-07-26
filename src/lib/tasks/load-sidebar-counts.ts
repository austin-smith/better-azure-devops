import { cache } from "react";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import { reportAzureDevOpsError } from "@/lib/azure-devops/report-error";
import { countTasks } from "@/lib/azure-devops/tasks";
import { normalizeTaskListFilters } from "@/lib/tasks/filters";

type SidebarCounts = {
  error: string | null;
  openTaskCount: number;
  queueCount: number;
};

const MISSING_CONFIG_ERROR =
  "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL.";

export const loadSidebarCounts = cache(async (): Promise<SidebarCounts> => {
  if (!hasAzureDevOpsConfig()) {
    return {
      error: MISSING_CONFIG_ERROR,
      openTaskCount: 0,
      queueCount: 0,
    };
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const selection = await loadAzureDevOpsProjectSelection(accessToken);

    if (selection.selectedProjects.length === 0) {
      return {
        error: null,
        openTaskCount: 0,
        queueCount: 0,
      };
    }

    const [openTaskCount, queueCount] = await Promise.all([
      countTasks(
        accessToken,
        selection.selectedProjects,
        normalizeTaskListFilters(),
      ),
      countTasks(
        accessToken,
        selection.selectedProjects,
        normalizeTaskListFilters({ assignee: "me" }),
      ),
    ]);

    return {
      error: null,
      openTaskCount,
      queueCount,
    };
  } catch (error) {
    reportAzureDevOpsError(error);

    return {
      error: error instanceof Error ? error.message : "Failed to load sidebar counts.",
      openTaskCount: 0,
      queueCount: 0,
    };
  }
});
