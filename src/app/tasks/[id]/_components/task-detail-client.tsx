"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TaskDetailContent } from "./task-detail-content";
import { TaskDetailHeader } from "./task-detail-header";
import { TaskDetailSidebar } from "./task-detail-sidebar";
import { ThemeToggle } from "@/components/themes/theme-toggle";
import { AppHeader } from "@/components/app-header";
import type {
  AzureDevOpsTaskDetail as TaskDetailData,
  AzureDevOpsTaskEditMetadata,
} from "@/lib/azure-devops/tasks";
import {
  applyTaskDetailEditableValues,
  createTaskDetailEditableValues,
  getTaskDetailEditableChanges,
  hasTaskDetailEditableChanges,
  type TaskDetailEditableValues,
} from "@/lib/tasks/task-detail-edit";

type TaskDetailProps = {
  detail: TaskDetailData | null;
  detailError: string | null;
  taskId: number;
  taskListHref: string;
  taskListLabel: string;
  taskProjectId: string | null;
};

export function TaskDetail({
  detail,
  detailError,
  taskId,
  taskListHref,
  taskListLabel,
  taskProjectId,
}: TaskDetailProps) {
  const router = useRouter();
  const [currentDetail, setCurrentDetail] = useState(detail);
  const [draftValues, setDraftValues] = useState<TaskDetailEditableValues | null>(
    detail ? createTaskDetailEditableValues(detail) : null,
  );
  const [editMetadata, setEditMetadata] = useState<AzureDevOpsTaskEditMetadata | null>(
    null,
  );
  const [editMetadataError, setEditMetadataError] = useState<string | null>(null);
  const [isLoadingEditMetadata, setIsLoadingEditMetadata] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentDetail(detail);
    setDraftValues(detail ? createTaskDetailEditableValues(detail) : null);
    setSaveError(null);
  }, [detail]);

  useEffect(() => {
    if (!detail) {
      setEditMetadata(null);
      setEditMetadataError(null);
      setIsLoadingEditMetadata(false);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    const projectId = detail.projectId ?? taskProjectId;

    if (projectId) {
      params.set("project", projectId);
    }

    setIsLoadingEditMetadata(true);
    setEditMetadataError(null);

    void (async () => {
      try {
        const response = await fetch(
          `/api/tasks/${taskId}/editable-metadata${params.size > 0 ? `?${params.toString()}` : ""}`,
          {
            signal: controller.signal,
          },
        );
        const payload = (await response.json()) as
          | {
              error?: string;
              item?: AzureDevOpsTaskEditMetadata;
            }
          | undefined;

        if (!response.ok || !payload?.item) {
          throw new Error(payload?.error ?? "Failed to load task edit metadata.");
        }

        setEditMetadata(payload.item);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setEditMetadata(null);
        setEditMetadataError(
          error instanceof Error
            ? error.message
            : "Failed to load task edit metadata.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingEditMetadata(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [detail, taskId, taskProjectId]);

  const displayDetail =
    currentDetail && draftValues
      ? applyTaskDetailEditableValues(currentDetail, draftValues)
      : currentDetail;
  const isDirty =
    currentDetail && draftValues
      ? hasTaskDetailEditableChanges(
          createTaskDetailEditableValues(currentDetail),
          draftValues,
        )
      : false;

  function handleDraftChange(nextValues: TaskDetailEditableValues) {
    setDraftValues(nextValues);
    setSaveError(null);
  }

  function resetDraft() {
    if (!currentDetail) {
      return;
    }

    setDraftValues(createTaskDetailEditableValues(currentDetail));
    setSaveError(null);
  }

  async function saveDraft() {
    if (!currentDetail || !draftValues) {
      return;
    }

    const changes = getTaskDetailEditableChanges(
      createTaskDetailEditableValues(currentDetail),
      draftValues,
    );

    if (Object.keys(changes).length === 0) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const params = new URLSearchParams();
      const projectId = currentDetail.projectId ?? taskProjectId;

      if (projectId) {
        params.set("project", projectId);
      }

      const response = await fetch(
        `/api/tasks/${taskId}${params.size > 0 ? `?${params.toString()}` : ""}`,
        {
          body: JSON.stringify({
            changes,
            revision: currentDetail.revision,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );
      const payload = (await response.json()) as
        | {
            error?: string;
            item?: TaskDetailData;
          }
        | undefined;

      if (!response.ok || !payload?.item) {
        throw new Error(payload?.error ?? "Failed to update task.");
      }

      setCurrentDetail(payload.item);
      setDraftValues(createTaskDetailEditableValues(payload.item));
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to update task.");
    } finally {
      setIsSaving(false);
    }
  }

  const headerItems = [
    { href: "/", label: "Home" },
    { href: taskListHref, label: taskListLabel },
    { label: `Work Item #${taskId}` },
  ];

  return (
    <>
      <AppHeader
        actions={<ThemeToggle />}
        items={headerItems}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col">
          <TaskDetailHeader
            detail={displayDetail}
            isDirty={isDirty}
            isSaving={isSaving}
            onDiscard={resetDraft}
            onSave={() => {
              void saveDraft();
            }}
            taskId={taskId}
          />

          <div className="flex min-h-0 flex-1">
            <TaskDetailContent detail={displayDetail} detailError={detailError} />
            <TaskDetailSidebar
              detail={displayDetail}
              editMetadata={editMetadata}
              editMetadataError={editMetadataError}
              draftValues={draftValues}
              isDirty={isDirty}
              isLoadingEditMetadata={isLoadingEditMetadata}
              isSaving={isSaving}
              onDraftChange={handleDraftChange}
              taskProjectId={taskProjectId}
              saveError={saveError}
            />
          </div>
        </div>
      </div>
    </>
  );
}
