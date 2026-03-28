import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import {
  listTasks,
  type AzureDevOpsTask,
  type TaskListFilters,
} from "@/lib/azure-devops/tasks";

type LoadTaskListResult = {
  error: string | null;
  items: AzureDevOpsTask[];
};

export async function loadTaskList(
  filters: TaskListFilters,
): Promise<LoadTaskListResult> {
  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const items = await listTasks(accessToken, filters);

    return {
      error: null,
      items,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load tasks.",
      items: [],
    };
  }
}
