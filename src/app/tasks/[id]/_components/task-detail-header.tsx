import { Loader2Icon, RotateCcwIcon, SaveIcon } from "lucide-react";
import { ProjectImage } from "@/components/project-image";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { WorkItemTypeLabel } from "@/components/tasks/work-item-type-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AzureDevOpsTaskDetail as TaskDetailData } from "@/lib/azure-devops/tasks";
import { getTaskStateBadgeVariant } from "@/lib/tasks/state";

type TaskDetailHeaderProps = {
  detail: TaskDetailData | null;
  isDirty: boolean;
  isSaving: boolean;
  mode?: "create" | "edit";
  onDiscard: () => void;
  onSave: () => void;
  taskId: number;
};

export function TaskDetailHeader({
  detail,
  isDirty,
  isSaving,
  mode = "edit",
  onDiscard,
  onSave,
  taskId,
}: TaskDetailHeaderProps) {
  const isCreateMode = mode === "create";

  return (
    <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-start md:px-6">
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-[15px] font-semibold leading-normal text-foreground">
          {isCreateMode ? (
            <span className="font-mono font-normal text-muted-foreground">
              New work item*
            </span>
          ) : (
            <span className="font-mono font-normal text-muted-foreground">#{taskId}</span>
          )}{" "}
          {detail?.title || "Work Item"}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {detail ? (
            <>
              <Badge variant="outline">
                <ProjectImage
                  className="size-3.5 rounded-sm ring-0"
                  imageClassName="rounded-sm"
                  imageUrl={detail.projectImageUrl}
                  name={detail.projectName}
                  size="sm"
                />
                <span>{detail.projectName}</span>
              </Badge>
              <Badge variant="outline">
                <WorkItemTypeLabel type={detail.type} />
              </Badge>
              <Badge
                variant={
                  isCreateMode
                    ? "secondary"
                    : getTaskStateBadgeVariant(detail.state)
                }
              >
                {isCreateMode ? "Unsaved" : detail.state}
              </Badge>
              <PriorityBadge priority={detail.priority} />
            </>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          disabled={!isDirty || isSaving || !detail}
          onClick={onDiscard}
          size="sm"
          variant="outline"
        >
          <RotateCcwIcon data-icon="inline-start" />
          Discard
        </Button>
        <Button
          disabled={!isDirty || isSaving || !detail}
          onClick={onSave}
          size="sm"
        >
          {isSaving ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : (
            <SaveIcon data-icon="inline-start" />
          )}
          Save
        </Button>
      </div>
    </div>
  );
}
