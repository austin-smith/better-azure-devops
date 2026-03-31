import { ArrowUpRightIcon, Loader2Icon } from "lucide-react";
import { ProjectImage } from "@/components/project-image";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { WorkItemTypeLabel } from "@/components/tasks/work-item-type-label";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { AzureDevOpsTaskDetail as TaskDetailData } from "@/lib/azure-devops/tasks";
import { getTaskStateBadgeVariant } from "@/lib/tasks/state";

type TaskDetailHeaderProps = {
  detail: TaskDetailData | null;
  isDirty: boolean;
  isSaving: boolean;
  onDiscard: () => void;
  onSave: () => void;
  taskId: number;
};

export function TaskDetailHeader({
  detail,
  isDirty,
  isSaving,
  onDiscard,
  onSave,
  taskId,
}: TaskDetailHeaderProps) {
  return (
    <div className="flex items-start gap-4 border-b px-4 py-3 md:px-6">
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold leading-normal text-foreground">
          {detail?.url ? (
            <a
              className="font-mono font-normal text-muted-foreground hover:text-foreground"
              href={detail.url}
              rel="noreferrer"
              target="_blank"
            >
              #{taskId}
            </a>
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
              <Badge variant={getTaskStateBadgeVariant(detail.state)}>{detail.state}</Badge>
              <PriorityBadge priority={detail.priority} />
            </>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          disabled={!isDirty || isSaving || !detail}
          onClick={onDiscard}
          size="sm"
          variant="outline"
        >
          Discard
        </Button>
        <Button
          disabled={!isDirty || isSaving || !detail}
          onClick={onSave}
          size="sm"
        >
          {isSaving ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
          Save
        </Button>
        {detail?.url ? (
          <a
            className={buttonVariants({ size: "icon-xs", variant: "ghost" })}
            href={detail.url}
            rel="noreferrer"
            target="_blank"
          >
            <ArrowUpRightIcon />
          </a>
        ) : null}
      </div>
    </div>
  );
}
