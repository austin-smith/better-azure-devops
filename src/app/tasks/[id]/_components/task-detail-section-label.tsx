import type { ReactNode } from "react";

type TaskDetailSectionLabelProps = {
  action?: ReactNode;
  count?: number;
  headingId?: string;
  title: string;
};

export function TaskDetailSectionLabel({
  action,
  count,
  headingId,
  title,
}: TaskDetailSectionLabelProps) {
  const trailingContent = action ?? (count !== undefined ? (
    <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
  ) : null);

  return (
    <div className="flex min-w-0 items-center justify-between gap-2 pb-2">
      <h3
        className="min-w-0 text-xs font-medium text-muted-foreground"
        id={headingId}
      >
        {title}
      </h3>
      {trailingContent ? (
        <div className="flex shrink-0 items-center">{trailingContent}</div>
      ) : null}
    </div>
  );
}
