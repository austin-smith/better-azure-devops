import { cache } from "react";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import {
  getTaskDetails,
  type AzureDevOpsTaskDetail,
} from "@/lib/azure-devops/tasks";
import {
  getPublicAzureDevOpsError,
  type PublicAzureDevOpsError,
} from "@/lib/azure-devops/errors";
import { reportAzureDevOpsError } from "@/lib/azure-devops/report-error";

type LoadTaskDetailResult = {
  detail: AzureDevOpsTaskDetail | null;
  error: PublicAzureDevOpsError | null;
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
      reportAzureDevOpsError(error);

      return {
        detail: null,
        error: getPublicAzureDevOpsError(error),
      };
    }
  },
);
