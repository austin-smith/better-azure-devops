import { cache } from "react";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import {
  getTaskDetails,
  type AzureDevOpsTaskDetail,
} from "@/lib/azure-devops/tasks";

type LoadTaskDetailResult = {
  detail: AzureDevOpsTaskDetail | null;
  error: string | null;
};

export const loadTaskDetail = cache(
  async (taskId: number): Promise<LoadTaskDetailResult> => {
    try {
      const accessToken = await getAzureDevOpsAccessToken();
      const detail = await getTaskDetails(accessToken, taskId);

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
