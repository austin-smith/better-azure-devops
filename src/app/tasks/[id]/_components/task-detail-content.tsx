import { GitBranchIcon } from "lucide-react";
import { TaskComments } from "./task-comments";
import { TaskDetailSectionLabel } from "./task-detail-section-label";
import { DateLabel } from "@/components/date-label";
import { TaskMarkup } from "@/components/tasks/task-markup";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { AzureDevOpsTaskDetail as TaskDetailData } from "@/lib/azure-devops/tasks";

type TaskDetailContentProps = {
  descriptionDraft: string;
  detail: TaskDetailData | null;
  detailError: string | null;
  isSaving: boolean;
  onDescriptionChange: (description: string) => void;
};

function pullRequestVariant(state: string) {
  switch (state.toLowerCase()) {
    case "completed":
      return "secondary";
    case "abandoned":
      return "destructive";
    default:
      return "outline";
  }
}

export function TaskDetailContent({
  descriptionDraft,
  detail,
  detailError,
  isSaving,
  onDescriptionChange,
}: TaskDetailContentProps) {
  const comments = detail?.comments ?? [];
  const linkedPullRequests = detail?.linkedPullRequests ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      {detailError ? (
        <div className="mb-4 border-l-2 border-destructive pl-3 text-sm text-destructive">
          {detailError}
        </div>
      ) : null}

      {detail ? (
        <div className="grid gap-3">
          <TaskDetailSectionLabel title="Description" />
          <Textarea
            className="h-72 min-h-72 resize-y rounded-lg border bg-background p-4 text-sm leading-6 [field-sizing:fixed]"
            disabled={isSaving}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Add a description..."
            value={descriptionDraft}
          />
          {detail.description.content.trim() ? (
            <div className="rounded-lg border bg-muted/20 p-4">
              <TaskMarkup markup={detail.description} />
            </div>
          ) : null}
        </div>
      ) : (
        <TaskMarkup emptyMessage="No description." markup={null} />
      )}

      <div className="mt-8">
        <TaskDetailSectionLabel
          title="Pull requests"
          count={linkedPullRequests.length}
        />
        <div className="space-y-2">
          {linkedPullRequests.length > 0 ? (
            linkedPullRequests.map((pullRequest) => (
              <a
                key={pullRequest.id}
                className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
                href={pullRequest.url || undefined}
                rel="noreferrer"
                target="_blank"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">
                      {pullRequest.repositoryName} · #{pullRequest.id}
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-foreground">
                      {pullRequest.title}
                    </div>
                  </div>
                  <Badge variant={pullRequestVariant(pullRequest.state)}>
                    {pullRequest.isDraft ? "Draft" : pullRequest.state}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <GitBranchIcon className="size-3" />
                    {pullRequest.sourceBranch || "source"} →{" "}
                    {pullRequest.targetBranch || "target"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <UserAvatar
                      avatarUrl={pullRequest.authorAvatarUrl}
                      name={pullRequest.authorName}
                      size="sm"
                    />
                    {pullRequest.authorName}
                  </span>
                  <DateLabel value={pullRequest.createdAt} />
                </div>
              </a>
            ))
          ) : (
            <p className="py-2 text-sm text-muted-foreground">None</p>
          )}
        </div>
      </div>

      <TaskComments comments={comments} />
    </div>
  );
}
