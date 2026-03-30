import { parseDateValue } from "@/lib/date-display";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import {
  getAzureDevOpsConfig,
  hasAzureDevOpsConfig,
} from "@/lib/azure-devops/config";
import type { AzureDevOpsTask } from "@/lib/azure-devops/tasks";
import {
  normalizeTaskListFilters,
} from "@/lib/tasks/filters";
import { loadTaskList } from "@/lib/tasks/load-task-list";
import { isBlockedTask, isStaleTask, isUnassignedTask } from "@/lib/tasks/state";

const MISSING_CONFIG_ERROR =
  "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL.";
const EMPTY_PROJECT_SELECTION_ERROR =
  "Select at least one Azure DevOps project.";
const RECENT_CHANGE_WINDOW_HOURS = 24;
const STALE_AFTER_DAYS = 7;
const MAX_QUEUE_ITEMS = 5;

type StateDistributionItem = {
  count: number;
  share: number;
  state: string;
};

export type DashboardOverview = {
  attentionCount: number;
  blockedCount: number;
  error: string | null;
  openTaskCount: number;
  projectCount: number;
  queueCount: number;
  queueItems: AzureDevOpsTask[];
  recentChangeCount: number;
  recentChangeWindowHours: number;
  recentLatestItem: AzureDevOpsTask | null;
  staleCount: number;
  staleAfterDays: number;
  stateDistribution: StateDistributionItem[];
  unassignedCount: number;
};

function sortStateDistribution(
  stateCounts: Map<string, number>,
  openTaskCount: number,
) {
  return [...stateCounts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .map(([state, count]) => ({
      count,
      share: openTaskCount > 0 ? count / openTaskCount : 0,
      state,
    }));
}

export async function loadDashboardOverview(): Promise<DashboardOverview> {
  try {
    const config = hasAzureDevOpsConfig() ? getAzureDevOpsConfig() : null;

    if (!config) {
      return {
        attentionCount: 0,
        blockedCount: 0,
        error: MISSING_CONFIG_ERROR,
        openTaskCount: 0,
        projectCount: 0,
        queueCount: 0,
        queueItems: [],
        recentChangeCount: 0,
        recentChangeWindowHours: RECENT_CHANGE_WINDOW_HOURS,
        recentLatestItem: null,
        staleCount: 0,
        staleAfterDays: STALE_AFTER_DAYS,
        stateDistribution: [],
        unassignedCount: 0,
      };
    }

    const accessToken = await getAzureDevOpsAccessToken();
    const selection = await loadAzureDevOpsProjectSelection(accessToken);

    if (selection.selectedProjects.length === 0) {
      return {
        attentionCount: 0,
        blockedCount: 0,
        error: EMPTY_PROJECT_SELECTION_ERROR,
        openTaskCount: 0,
        projectCount: 0,
        queueCount: 0,
        queueItems: [],
        recentChangeCount: 0,
        recentChangeWindowHours: RECENT_CHANGE_WINDOW_HOURS,
        recentLatestItem: null,
        staleCount: 0,
        staleAfterDays: STALE_AFTER_DAYS,
        stateDistribution: [],
        unassignedCount: 0,
      };
    }

    const [allTasksResult, queueResult] = await Promise.all([
      loadTaskList(
        accessToken,
        selection.selectedProjects,
        normalizeTaskListFilters(),
      ),
      loadTaskList(
        accessToken,
        selection.selectedProjects,
        normalizeTaskListFilters({
          assignee: "me",
        }),
      ),
    ]);
    const now = new Date();
    const openTaskCount = allTasksResult.items.length;
    const blockedCount = allTasksResult.items.filter(isBlockedTask).length;
    const staleCount = allTasksResult.items.filter((task) =>
      isStaleTask(task, now, STALE_AFTER_DAYS),
    ).length;
    const unassignedCount = allTasksResult.items.filter(isUnassignedTask).length;
    const recentChangeCount = allTasksResult.items.filter((task) => {
      const updatedAt = parseDateValue(task.updatedAt);

      if (!updatedAt) {
        return false;
      }

      return now.getTime() - updatedAt.getTime() <= RECENT_CHANGE_WINDOW_HOURS * 60 * 60 * 1000;
    }).length;
    const attentionTaskIds = new Set(
      allTasksResult.items
        .filter(
          (task) =>
            isBlockedTask(task) ||
            isStaleTask(task, now, STALE_AFTER_DAYS) ||
            isUnassignedTask(task),
        )
        .map((task) => task.id),
    );
    const stateCounts = allTasksResult.items.reduce((counts, task) => {
      counts.set(task.state, (counts.get(task.state) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());

    return {
      attentionCount: attentionTaskIds.size,
      blockedCount,
      error: allTasksResult.error ?? queueResult.error,
      openTaskCount,
      projectCount: selection.selectedProjects.length,
      queueCount: queueResult.items.length,
      queueItems: queueResult.items.slice(0, MAX_QUEUE_ITEMS),
      recentChangeCount,
      recentChangeWindowHours: RECENT_CHANGE_WINDOW_HOURS,
      recentLatestItem: allTasksResult.items[0] ?? null,
      staleCount,
      staleAfterDays: STALE_AFTER_DAYS,
      stateDistribution: sortStateDistribution(stateCounts, openTaskCount),
      unassignedCount,
    };
  } catch (error) {
    return {
      attentionCount: 0,
      blockedCount: 0,
      error: error instanceof Error ? error.message : "Failed to load dashboard overview.",
      openTaskCount: 0,
      projectCount: 0,
      queueCount: 0,
      queueItems: [],
      recentChangeCount: 0,
      recentChangeWindowHours: RECENT_CHANGE_WINDOW_HOURS,
      recentLatestItem: null,
      staleCount: 0,
      staleAfterDays: STALE_AFTER_DAYS,
      stateDistribution: [],
      unassignedCount: 0,
    };
  }
}
