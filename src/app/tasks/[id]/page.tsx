import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TaskDetail } from "./_components/task-detail-client";
import {
  getTaskListTitle,
  parseTaskListFilters,
  type TaskListSearchParams,
} from "@/lib/tasks/filters";
import { loadTaskDetail } from "@/lib/tasks/load-task-detail";
import { getTaskListHref } from "@/lib/tasks/navigation";

function parseTaskId(value: string) {
  const taskId = Number(value);
  return Number.isInteger(taskId) && taskId > 0 ? taskId : null;
}

type TaskDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<TaskListSearchParams>;
};

function readTaskProjectId(searchParams: TaskListSearchParams) {
  const value = searchParams.taskProject;

  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return typeof value === "string" ? value.trim() || null : null;
}

export async function generateMetadata({
  params,
  searchParams,
}: TaskDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const taskId = parseTaskId(id);

  if (!taskId) {
    notFound();
  }

  const taskProjectId = readTaskProjectId(await searchParams);
  const { detail } = await loadTaskDetail(taskId, taskProjectId);

  return {
    title: detail?.title
      ? `Work Item #${taskId}: ${detail.title}`
      : `Work Item #${taskId}`,
  };
}

export default async function TaskDetailPage({
  params,
  searchParams,
}: TaskDetailPageProps) {
  const [{ id }, filters] = await Promise.all([
    params,
    searchParams.then(async (value) => ({
      filters: parseTaskListFilters(value),
      taskProjectId: readTaskProjectId(value),
    })),
  ]);
  const taskId = parseTaskId(id);

  if (!taskId) {
    notFound();
  }

  const { detail, error } = await loadTaskDetail(taskId, filters.taskProjectId);

  return (
    <TaskDetail
      detail={detail}
      detailError={error}
      taskId={taskId}
      taskListHref={getTaskListHref(filters.filters)}
      taskListLabel={getTaskListTitle(filters.filters)}
      taskProjectId={filters.taskProjectId}
    />
  );
}
