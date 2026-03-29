import { cn } from "@/lib/utils";
import { getWorkItemTypeMeta } from "@/lib/tasks/work-item-type";

type WorkItemTypeLabelProps = {
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  type: string;
};

export function WorkItemTypeLabel({
  className,
  iconClassName,
  labelClassName,
  type,
}: WorkItemTypeLabelProps) {
  const meta = getWorkItemTypeMeta(type);
  const Icon = meta.icon;

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <Icon className={cn("size-3.5 shrink-0", iconClassName)} />
      <span className={cn("truncate", labelClassName)}>{meta.label}</span>
    </span>
  );
}
