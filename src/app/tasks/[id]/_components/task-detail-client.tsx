"use client";

import { ExternalLinkIcon } from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TaskDetailContent } from "./task-detail-content";
import { TaskDetailHeader } from "./task-detail-header";
import { TaskDetailSidebar } from "./task-detail-sidebar";
import { ThemeToggle } from "@/components/themes/theme-toggle";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  AzureDevOpsTaskDetail as TaskDetailData,
  AzureDevOpsTaskEditMetadata,
} from "@/lib/azure-devops/tasks";
import {
  createPublicAzureDevOpsError,
  parsePublicAzureDevOpsError,
  type PublicAzureDevOpsError,
} from "@/lib/azure-devops/errors";
import {
  applyTaskDetailEditableValues,
  createTaskDetailEditableValues,
  getTaskDetailEditableChanges,
  rebaseTaskDetailEditableValues,
  serializeEditableMarkdownForAzureDevOps,
  type TaskDetailEditableValues,
} from "@/lib/tasks/task-detail-edit";

type TaskDetailProps = {
  createProjectId?: string | null;
  detail: TaskDetailData | null;
  detailError: PublicAzureDevOpsError | null;
  mode?: "create" | "edit";
  onCreateDiscard?: () => void;
  taskId: number;
  taskListHref: string;
  taskListLabel: string;
  taskProjectId: string | null;
};

function getTaskApiPath(taskId: number, projectId: string | null | undefined) {
  const params = new URLSearchParams();

  if (projectId) {
    params.set("project", projectId);
  }

  return `/api/tasks/${taskId}${params.size > 0 ? `?${params.toString()}` : ""}`;
}

export function TaskDetail({
  createProjectId = null,
  detail,
  detailError,
  mode = "edit",
  onCreateDiscard,
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
  const [saveErrorDetails, setSaveErrorDetails] =
    useState<PublicAzureDevOpsError | null>(null);
  const [saveRecoveryAction, setSaveRecoveryAction] =
    useState<"reload-latest" | "save">("save");
  const [draftResetKey, setDraftResetKey] = useState(0);

  useEffect(() => {
    setCurrentDetail(detail);
    setDraftValues(detail ? createTaskDetailEditableValues(detail) : null);
    setSaveError(null);
    setSaveErrorDetails(null);
    setSaveRecoveryAction("save");
  }, [detail]);

  useEffect(() => {
    if (!detail || mode === "create") {
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
  }, [detail, mode, taskId, taskProjectId]);

  const initialEditableValues = currentDetail
    ? createTaskDetailEditableValues(currentDetail)
    : null;
  const editableChanges = initialEditableValues && draftValues
    ? getTaskDetailEditableChanges(initialEditableValues, draftValues)
    : {};
  const displayDetail =
    currentDetail && draftValues
      ? applyTaskDetailEditableValues(currentDetail, draftValues)
      : currentDetail;
  const isDirty =
    currentDetail && draftValues
      ? mode === "create" || Object.keys(editableChanges).length > 0
      : false;
  const descriptionHasUnsavedChanges =
    mode !== "create" && Object.hasOwn(editableChanges, "description");

  function handleDraftChange(nextValues: TaskDetailEditableValues) {
    setDraftValues(nextValues);
    setSaveError(null);
    setSaveErrorDetails(null);
    setSaveRecoveryAction("save");
  }

  function resetDraft() {
    if (!currentDetail) {
      return;
    }

    if (mode === "create") {
      onCreateDiscard?.();
      return;
    }

    setDraftValues(createTaskDetailEditableValues(currentDetail));
    setSaveError(null);
    setSaveErrorDetails(null);
    setSaveRecoveryAction("save");
    setDraftResetKey((current) => current + 1);
  }

  async function reloadLatestAfterConflict() {
    if (!currentDetail || !draftValues) {
      return;
    }

    const initialValues = createTaskDetailEditableValues(currentDetail);
    const projectId = currentDetail.projectId ?? taskProjectId;

    setIsSaving(true);
    setSaveError(null);
    setSaveErrorDetails(null);

    try {
      const response = await fetch(getTaskApiPath(taskId, projectId));
      const payload = (await response.json()) as
        | {
            error?: unknown;
            errorDetails?: unknown;
            item?: TaskDetailData;
          }
        | undefined;

      if (!response.ok || !payload?.item) {
        const errorDetails =
          parsePublicAzureDevOpsError(payload?.errorDetails) ??
          createPublicAzureDevOpsError("unknown");

        setSaveError(errorDetails.message);
        setSaveErrorDetails(errorDetails);
        setSaveRecoveryAction("reload-latest");
        return;
      }

      setCurrentDetail(payload.item);
      setDraftValues(
        rebaseTaskDetailEditableValues(
          initialValues,
          draftValues,
          createTaskDetailEditableValues(payload.item),
        ),
      );
      setSaveRecoveryAction("save");
    } catch {
      const errorDetails = createPublicAzureDevOpsError("network");
      setSaveError(errorDetails.message);
      setSaveErrorDetails(errorDetails);
      setSaveRecoveryAction("reload-latest");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDraft() {
    if (!currentDetail || !draftValues) {
      return;
    }

    if (mode === "create") {
      if (!draftValues.title.trim()) {
        setSaveError("Title is required.");
        setSaveErrorDetails(null);
        return;
      }

      setIsSaving(true);
      setSaveError(null);
      setSaveErrorDetails(null);
      setSaveRecoveryAction("save");

      try {
        const description = draftValues.description.trim()
          ? serializeEditableMarkdownForAzureDevOps(draftValues.description)
          : undefined;

        const response = await fetch("/api/tasks", {
          body: JSON.stringify({
            areaPath: draftValues.areaPath || undefined,
            description,
            priority: draftValues.priority,
            projectId: currentDetail.projectId ?? createProjectId,
            title: draftValues.title,
            type: currentDetail.type,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const payload = (await response.json()) as
          | {
              error?: unknown;
              errorDetails?: unknown;
              item?: TaskDetailData;
            }
          | undefined;

        if (!response.ok) {
          const errorDetails = parsePublicAzureDevOpsError(
            payload?.errorDetails,
          );
          const responseError =
            typeof payload?.error === "string" ? payload.error : null;

          setSaveError(
            errorDetails?.message ??
              responseError ??
              "Failed to create work item.",
          );
          setSaveErrorDetails(errorDetails);
          return;
        }

        if (!payload?.item) {
          const errorDetails = createPublicAzureDevOpsError(
            "create_status_unknown",
          );

          setSaveError(errorDetails.message);
          setSaveErrorDetails(errorDetails);
          return;
        }

        const createdTask = payload.item;
        const projectId = createdTask.projectId ?? createProjectId;

        startTransition(() => {
          router.push(
            `/tasks/${createdTask.id}${projectId ? `?taskProject=${encodeURIComponent(projectId)}` : ""}`,
          );
          router.refresh();
        });
      } catch {
        const errorDetails = createPublicAzureDevOpsError(
          "create_status_unknown",
        );
        setSaveError(errorDetails.message);
        setSaveErrorDetails(errorDetails);
      } finally {
        setIsSaving(false);
      }

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
    setSaveErrorDetails(null);
    setSaveRecoveryAction("save");

    try {
      const projectId = currentDetail.projectId ?? taskProjectId;

      const response = await fetch(
        getTaskApiPath(taskId, projectId),
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
            error?: unknown;
            errorDetails?: unknown;
            item?: TaskDetailData;
          }
        | undefined;

      if (!response.ok || !payload?.item) {
        const errorDetails = parsePublicAzureDevOpsError(
          payload?.errorDetails,
        );
        const responseError =
          typeof payload?.error === "string" ? payload.error : null;

        setSaveError(
          errorDetails?.message ??
            responseError ??
            "Failed to update task.",
        );
        setSaveErrorDetails(errorDetails);
        setSaveRecoveryAction(
          errorDetails?.code === "revision_conflict"
            ? "reload-latest"
            : "save",
        );
        return;
      }

      setCurrentDetail(payload.item);
      setDraftValues(createTaskDetailEditableValues(payload.item));
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      const errorDetails = createPublicAzureDevOpsError("network");
      setSaveError(
        error instanceof Error ? error.message : errorDetails.message,
      );
      setSaveErrorDetails(errorDetails);
    } finally {
      setIsSaving(false);
    }
  }

  const openInDevOpsAction = displayDetail?.url && mode !== "create" ? (
    <Tooltip>
      <TooltipTrigger
        render={(
          <a
            aria-label="Open in DevOps"
            className={buttonVariants({
              className: "text-muted-foreground hover:text-foreground",
              size: "icon-xs",
              variant: "ghost",
            })}
            href={displayDetail.url}
            rel="noreferrer"
            target="_blank"
          />
        )}
      >
        <ExternalLinkIcon />
      </TooltipTrigger>
      <TooltipContent>Open in DevOps</TooltipContent>
    </Tooltip>
  ) : null;
  const headerItems = [
    { href: "/", label: "Home" },
    { href: taskListHref, label: taskListLabel },
    {
      action: openInDevOpsAction,
      label: mode === "create" ? "New Work Item" : `Work Item #${taskId}`,
    },
  ];

  return (
    <>
      <AppHeader
        actions={<ThemeToggle />}
        items={headerItems}
      />

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <TaskDetailHeader
            detail={displayDetail}
            isDirty={isDirty}
            isSaving={isSaving}
            mode={mode}
            onDiscard={resetDraft}
            onSave={() => {
              void saveDraft();
            }}
            taskId={taskId}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
            <TaskDetailContent
              descriptionDraft={draftValues?.description ?? ""}
              descriptionHasUnsavedChanges={descriptionHasUnsavedChanges}
              detail={displayDetail}
              detailError={detailError}
              draftResetKey={draftResetKey}
              isSaving={isSaving}
              mode={mode}
              onDescriptionChange={(description) => {
                if (!draftValues) {
                  return;
                }

                handleDraftChange({
                  ...draftValues,
                  description,
                });
              }}
            />
            <TaskDetailSidebar
              detail={displayDetail}
              editMetadata={editMetadata}
              editMetadataError={editMetadataError}
              draftValues={draftValues}
              isDirty={isDirty}
              isLoadingEditMetadata={isLoadingEditMetadata}
              isSaving={isSaving}
              mode={mode}
              onDraftChange={handleDraftChange}
              onRetrySave={() => {
                if (
                  mode === "create" &&
                  saveErrorDetails?.code === "create_status_unknown"
                ) {
                  return;
                }

                if (saveRecoveryAction === "reload-latest") {
                  void reloadLatestAfterConflict();
                  return;
                }

                void saveDraft();
              }}
              taskProjectId={taskProjectId}
              saveError={saveError}
              saveErrorDetails={saveErrorDetails}
            />
          </div>
        </div>
      </div>
    </>
  );
}
