"use client";

import { useEffect, useState } from "react";
import { TaskDetailContent } from "./task-detail-content";
import { TaskDetailHeader } from "./task-detail-header";
import { TaskDetailSidebar } from "./task-detail-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppHeader } from "@/components/app-header";
import type { AzureDevOpsTaskDetail as TaskDetailData } from "@/lib/azure-devops/tasks";
import { getDefaultTaskViewHref } from "@/lib/tasks/navigation";

type TaskDetailProps = {
  detail: TaskDetailData | null;
  detailError: string | null;
  projectLabel: string;
  taskId: number;
};

export function TaskDetail({
  detail,
  detailError,
  projectLabel,
  taskId,
}: TaskDetailProps) {
  const [currentDetail, setCurrentDetail] = useState(detail);

  useEffect(() => {
    setCurrentDetail(detail);
  }, [detail]);

  const headerItems = [
    { href: getDefaultTaskViewHref(), label: projectLabel },
    { label: `Task #${taskId}` },
  ];

  return (
    <>
      <AppHeader
        actions={<ThemeToggle />}
        items={headerItems}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col">
          <TaskDetailHeader detail={currentDetail} taskId={taskId} />

          <div className="flex min-h-0 flex-1">
            <TaskDetailContent detail={currentDetail} detailError={detailError} />
            <TaskDetailSidebar
              detail={currentDetail}
              onUpdated={setCurrentDetail}
              taskId={taskId}
            />
          </div>
        </div>
      </div>
    </>
  );
}
