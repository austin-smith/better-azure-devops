import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TaskTable } from "@/components/tasks/task-table";
import { getAzureDevOpsConfig, hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { loadTaskList } from "@/lib/tasks/load-task-list";
import { getTaskView } from "@/lib/tasks/views";

const MISSING_CONFIG_ERROR =
  "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_PROJECT.";

type TaskViewPageProps = {
  params: Promise<{ viewSlug: string }>;
};

export async function generateMetadata({
  params,
}: TaskViewPageProps): Promise<Metadata> {
  const { viewSlug } = await params;
  const view = getTaskView(viewSlug);

  if (!view) {
    notFound();
  }

  return {
    title: view.title,
  };
}

export default async function TaskViewPage({
  params,
}: TaskViewPageProps) {
  const { viewSlug } = await params;
  const view = getTaskView(viewSlug);

  if (!view) {
    notFound();
  }

  const config = hasAzureDevOpsConfig() ? getAzureDevOpsConfig() : null;
  const { error, items } = config
    ? await loadTaskList(view.filters)
    : {
        error: MISSING_CONFIG_ERROR,
        items: [],
      };

  return (
    <TaskTable
      error={error}
      items={items}
      projectLabel={config?.project ?? "Tasks"}
      view={view}
    />
  );
}
