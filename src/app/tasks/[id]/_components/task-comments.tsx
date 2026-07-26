import { TaskDetailSectionLabel } from "./task-detail-section-label";
import { DiscussionComment } from "@/components/azure-devops/discussion-comment";
import { CommentReactions } from "@/components/tasks/comment-reactions";
import type { AzureDevOpsTaskDetail as TaskDetailData } from "@/lib/azure-devops/tasks";

type TaskCommentsProps = {
  comments: TaskDetailData["comments"];
};

export function TaskComments({ comments }: TaskCommentsProps) {
  return (
    <div className="mt-8">
      <TaskDetailSectionLabel title="Discussion" count={comments.length} />
      <div className="space-y-4">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <DiscussionComment
              author={{
                avatarUrl: comment.authorAvatarUrl,
                name: comment.authorName,
              }}
              createdAt={comment.createdAt}
              key={comment.id}
              markup={comment}
            >
              <CommentReactions reactions={comment.reactions} />
            </DiscussionComment>
          ))
        ) : (
          <p className="py-2 text-sm text-muted-foreground">No comments yet.</p>
        )}
      </div>
    </div>
  );
}
