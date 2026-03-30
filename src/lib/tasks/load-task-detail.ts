import { cache } from "react";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import {
  getTaskDetails,
  type AzureDevOpsTaskDetail,
} from "@/lib/azure-devops/tasks";

type LoadTaskDetailResult = {
  detail: AzureDevOpsTaskDetail | null;
  error: string | null;
};

export const loadTaskDetail = cache(
  async (taskId: number, taskProjectId: string | null = null): Promise<LoadTaskDetailResult> => {
    try {
      const accessToken = await getAzureDevOpsAccessToken();
      const selection = taskProjectId
        ? await loadAzureDevOpsProjectSelection(accessToken, [taskProjectId])
        : null;
      const taskProject = selection?.selectedProjects[0] ?? null;
      const detail = await getTaskDetails(accessToken, taskId, {
        projectId: taskProject?.id ?? taskProjectId,
        projectImageUrl: taskProject?.defaultTeamImageUrl ?? null,
        projectName: taskProject?.name ?? null,
      });

      return {
        detail,
        error: null,
      };
    } catch (error) {
      return {
        detail: null,
        error: error instanceof Error ? error.message : "Failed to load task details.",
      };
    }
  },
);
