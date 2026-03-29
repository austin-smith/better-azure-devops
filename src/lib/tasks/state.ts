import { differenceInCalendarDays } from "date-fns";
import { parseDateValue } from "@/lib/date-display";
import type { AzureDevOpsTask } from "@/lib/azure-devops/tasks";

type TaskStateBadgeVariant = "destructive" | "outline" | "secondary";

function normalizeState(state: string) {
  return state.trim().toLowerCase();
}

export function getTaskStateBadgeVariant(state: string): TaskStateBadgeVariant {
  switch (normalizeState(state)) {
    case "done":
    case "closed":
    case "completed":
    case "removed":
      return "secondary";
    case "blocked":
      return "destructive";
    default:
      return "outline";
  }
}

export function isBlockedTask(task: Pick<AzureDevOpsTask, "state">) {
  return normalizeState(task.state) === "blocked";
}

export function isUnassignedTask(task: Pick<AzureDevOpsTask, "assignee">) {
  return task.assignee.trim().toLowerCase() === "unassigned";
}

export function isStaleTask(
  task: Pick<AzureDevOpsTask, "updatedAt">,
  now: Date,
  staleAfterDays = 7,
) {
  const updatedAt = parseDateValue(task.updatedAt);

  if (!updatedAt) {
    return false;
  }

  return differenceInCalendarDays(now, updatedAt) >= staleAfterDays;
}
