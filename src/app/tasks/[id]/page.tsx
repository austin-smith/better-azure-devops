import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TaskDetail } from "@/components/tasks/task-detail";
import { getAzureDevOpsConfig, hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { loadTaskDetail } from "@/lib/tasks/load-task-detail";
import { parseOptionalTaskView } from "@/lib/tasks/navigation";

function parseTaskId(value: string) {
  const taskId = Number(value);
  return Number.isInteger(taskId) && taskId > 0 ? taskId : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const taskId = parseTaskId(id);

  if (!taskId) {
    notFound();
  }

  const { detail } = await loadTaskDetail(taskId);

  return {
    title: detail?.title ? `Task #${taskId}: ${detail.title}` : `Task #${taskId}`,
  };
}

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  const taskId = parseTaskId(id);

  if (!taskId) {
    notFound();
  }

  const config = hasAzureDevOpsConfig() ? getAzureDevOpsConfig() : null;
  const { detail, error } = await loadTaskDetail(taskId);

  return (
    <TaskDetail
      detail={detail}
      detailError={error}
      projectLabel={config?.project ?? "Tasks"}
      taskId={taskId}
      view={parseOptionalTaskView(view)}
    />
  );
}
