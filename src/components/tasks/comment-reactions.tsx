import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AzureDevOpsTaskCommentReaction } from "@/lib/azure-devops/tasks";
import { cn } from "@/lib/utils";

type CommentReactionsProps = {
  reactions: AzureDevOpsTaskCommentReaction[];
};

const COMMENT_REACTION_META = {
  confused: {
    emoji: "😖",
    label: "Upset",
    summary: "Upset by",
  },
  dislike: {
    emoji: "👎",
    label: "Dislike",
    summary: "Disliked by",
  },
  heart: {
    emoji: "❤️",
    label: "Heart",
    summary: "Loved by",
  },
  hooray: {
    emoji: "🎉",
    label: "Hooray",
    summary: "Celebrated by",
  },
  like: {
    emoji: "👍",
    label: "Like",
    summary: "Liked by",
  },
  smile: {
    emoji: "😃",
    label: "Laugh",
    summary: "Laughed by",
  },
} as const;

export function CommentReactions({ reactions }: CommentReactionsProps) {
  if (reactions.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {reactions.map((reaction) => {
        const meta = COMMENT_REACTION_META[reaction.type];
        const badge = (
          <Badge
            aria-label={`${meta.label}: ${reaction.count}`}
            className={cn(
              "h-6 px-2.5",
              reaction.isCurrentUserEngaged && "border-foreground/30 bg-muted/40",
            )}
            variant="outline"
          >
            <span aria-hidden="true">{meta.emoji}</span>
            <span>{reaction.count}</span>
            <span className="sr-only">{meta.label}</span>
          </Badge>
        );

        return (
          <Tooltip key={reaction.type}>
            <TooltipTrigger render={<span className="inline-flex" />}>
              {badge}
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              <div className="flex max-w-72 flex-col gap-2">
                <p className="font-semibold">
                  {`${meta.summary} ${reaction.count} ${reaction.count === 1 ? "user" : "users"}`}
                </p>
                {reaction.users.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {reaction.users.map((user) => (
                      <div key={user.name}>{user.name}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
