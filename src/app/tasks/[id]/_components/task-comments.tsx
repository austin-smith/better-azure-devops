import { TaskDetailSectionLabel } from "./task-detail-section-label";
import { DateLabel } from "@/components/date-label";
import { CommentReactions } from "@/components/tasks/comment-reactions";
import { TaskMarkup } from "@/components/tasks/task-markup";
import { UserAvatar } from "@/components/user-avatar";
import { Card } from "@/components/ui/card";
import type { AzureDevOpsTaskDetail as TaskDetailData } from "@/lib/azure-devops/tasks";

type TaskCommentsProps = {
  comments: TaskDetailData["comments"];
};

function CommentBody({
  comment,
}: {
  comment: TaskDetailData["comments"][number];
}) {
  return (
    <TaskMarkup
      className="mt-1"
      emptyMessage="No comment text."
      html={comment.format === "html" ? comment.html : undefined}
      markdown={comment.format === "markdown" ? comment.text : undefined}
      text={comment.format === "unknown" ? comment.text : undefined}
    />
  );
}

export function TaskComments({ comments }: TaskCommentsProps) {
  return (
    <div className="mt-8">
      <TaskDetailSectionLabel title="Discussion" count={comments.length} />
      <div className="space-y-4">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <Card key={comment.id} size="sm" className="gap-0 p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <UserAvatar
                  avatarUrl={comment.authorAvatarUrl}
                  name={comment.authorName}
                  size="sm"
                />
                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {comment.authorName}
                  </span>
                  <DateLabel
                    className="shrink-0 text-xs text-muted-foreground"
                    value={comment.createdAt}
                  />
                </div>
              </div>
              <CommentBody comment={comment} />
              <CommentReactions reactions={comment.reactions} />
            </Card>
          ))
        ) : (
          <p className="py-2 text-sm text-muted-foreground">No comments yet.</p>
        )}
      </div>
    </div>
  );
}
