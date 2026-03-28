"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PriorityBadgeProps = {
  className?: string;
  priority: string;
};

function priorityBadgeClassName(priority: string) {
  switch (priority.trim().toLowerCase()) {
    case "1":
    case "high":
      return "border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/20";
    case "2":
    case "medium":
      return "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-300";
    default:
      return "border-border bg-secondary text-secondary-foreground";
  }
}

function formatPriorityLabel(priority: string) {
  const value = priority.trim();
  return `P${value || "?"}`;
}

export function PriorityBadge({ className, priority }: PriorityBadgeProps) {
  return (
    <Badge
      className={cn("px-1.5", priorityBadgeClassName(priority), className)}
      variant="outline"
    >
      {formatPriorityLabel(priority)}
    </Badge>
  );
}
