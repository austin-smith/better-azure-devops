import type { ReactNode } from "react";
import { AzureDevOpsMarkupView } from "@/components/azure-devops/azure-devops-markup";
import { DateLabel } from "@/components/date-label";
import { IdentityImage } from "@/components/identity-image";
import { Card } from "@/components/ui/card";
import type { AzureDevOpsMarkup } from "@/lib/azure-devops/markup";
import { cn } from "@/lib/utils";

export type DiscussionCommentProps = {
  author: {
    avatarUrl: string | null;
    name: string;
  };
  bodyClassName?: string;
  children?: ReactNode;
  className?: string;
  createdAt: string | null;
  emptyMessage?: string;
  headerMetadata?: ReactNode;
  markup: AzureDevOpsMarkup;
};

export function DiscussionComment({
  author,
  bodyClassName,
  children,
  className,
  createdAt,
  emptyMessage = "No comment text.",
  headerMetadata,
  markup,
}: DiscussionCommentProps) {
  return (
    <Card
      className={cn("gap-0 p-3 shadow-sm", className)}
      size="sm"
    >
      <div className="flex min-w-0 items-center gap-2">
        <IdentityImage
          imageUrl={author.avatarUrl}
          label={author.name}
          size="sm"
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-semibold text-foreground">
            {author.name}
          </span>
          {createdAt ? (
            <DateLabel
              className="shrink-0 text-xs text-muted-foreground"
              value={createdAt}
            />
          ) : null}
          {headerMetadata ? (
            <div className="ml-auto shrink-0">{headerMetadata}</div>
          ) : null}
        </div>
      </div>
      <AzureDevOpsMarkupView
        className={cn("mt-1", bodyClassName)}
        emptyMessage={emptyMessage}
        markup={markup}
      />
      {children}
    </Card>
  );
}
