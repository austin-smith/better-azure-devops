import type { Metadata } from "next";
import { TaskTable } from "@/components/tasks/task-table";
import { getAzureDevOpsConfig, hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { loadTaskList } from "@/lib/tasks/load-task-list";

export const metadata: Metadata = {
  title: "My Tasks",
};

export default async function MinePage() {
  const config = hasAzureDevOpsConfig() ? getAzureDevOpsConfig() : null;
  const { error, items } = config
    ? await loadTaskList("mine")
    : {
        error:
          "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_PROJECT.",
        items: [],
      };

  return (
    <TaskTable
      error={error}
      items={items}
      projectLabel={config?.project ?? "Tasks"}
    />
  );
}
