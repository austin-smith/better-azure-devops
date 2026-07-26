import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AzureDevOpsFailure } from "@/components/azure-devops-failure";
import { DateLabel } from "@/components/date-label";
import { RepositoryPullRequestRow } from "@/components/repositories/repository-pull-request-row";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { ThemeToggle } from "@/components/themes/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTaskStateBadgeVariant } from "@/lib/tasks/state";
import type { DashboardOverview as DashboardOverviewData } from "@/lib/tasks/load-dashboard-overview";
import type { DashboardPullRequests } from "@/lib/repositories/load-dashboard-pull-requests";
import {
  getDefaultTaskListHref,
  getTaskDetailHref,
  getTaskListHref,
} from "@/lib/tasks/navigation";
import { cn } from "@/lib/utils";

const MAX_ROWS = 5;

type DashboardOverviewProps = {
  overview: DashboardOverviewData;
  pullRequests: DashboardPullRequests;
};

function StatTile({
  href,
  label,
  value,
}: {
  href?: string;
  label: string;
  value: number;
}) {
  const content = (
    <div className="flex flex-col gap-0.5 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function Panel({
  action,
  children,
  count,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  count?: number;
  title: string;
}) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-1.5">
        <h2 className="text-xs font-medium text-muted-foreground">
          {title}
          {count === undefined ? null : (
            <span className="ml-1.5 tabular-nums">{count}</span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function ViewAll({ href }: { href: string }) {
  return (
    <Button
      className="h-6"
      nativeButton={false}
      render={<Link href={href} />}
      size="xs"
      variant="ghost"
    >
      View all
      <ArrowRightIcon data-icon="inline-end" />
    </Button>
  );
}

export function DashboardOverview({
  overview,
  pullRequests,
}: DashboardOverviewProps) {
  const tasksHref = getDefaultTaskListHref();
  const queueHref = getTaskListHref({ assignee: "me" });

  return (
    <>
      <AppHeader actions={<ThemeToggle />} items={[{ label: "Home" }]} />

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-3 md:p-4">
          {overview.error ? (
            <AzureDevOpsFailure error={overview.error} />
          ) : null}

          {/* Every tile is something the reader can act on, and each one is
              the headline for a panel below rather than a lone number. */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatTile
              href={queueHref}
              label="Your queue"
              value={overview.queueCount}
            />
            <StatTile
              label="Awaiting your review"
              value={pullRequests.awaitingReview.length}
            />
            <StatTile
              label="Your pull requests"
              value={pullRequests.createdByMe.length}
            />
            <StatTile
              href={tasksHref}
              label="Open work items"
              value={overview.openTaskCount}
            />
          </div>

          <div className="grid items-start gap-3 lg:grid-cols-2">
            <Panel
              count={pullRequests.awaitingReview.length}
              title="Awaiting your review"
            >
              {pullRequests.awaitingReview.length > 0 ? (
                <ol className="divide-y">
                  {pullRequests.awaitingReview
                    .slice(0, MAX_ROWS)
                    .map((pullRequest) => (
                      <RepositoryPullRequestRow
                        key={`${pullRequest.repository.id}:${pullRequest.pullRequestId}`}
                        pullRequest={pullRequest}
                        showRepository
                      />
                    ))}
                </ol>
              ) : (
                <EmptyRow>
                  {pullRequests.isAvailable
                    ? "Nothing is waiting on your review."
                    : "Pull request activity is unavailable."}
                </EmptyRow>
              )}
            </Panel>

            <Panel
              count={pullRequests.createdByMe.length}
              title="Your pull requests"
            >
              {pullRequests.createdByMe.length > 0 ? (
                <ol className="divide-y">
                  {pullRequests.createdByMe
                    .slice(0, MAX_ROWS)
                    .map((pullRequest) => (
                      <RepositoryPullRequestRow
                        key={`${pullRequest.repository.id}:${pullRequest.pullRequestId}`}
                        pullRequest={pullRequest}
                        showRepository
                      />
                    ))}
                </ol>
              ) : (
                <EmptyRow>
                  {pullRequests.isAvailable
                    ? "You have no active pull requests."
                    : "Pull request activity is unavailable."}
                </EmptyRow>
              )}
            </Panel>

            <Panel
              action={<ViewAll href={queueHref} />}
              count={overview.queueCount}
              title="Your queue"
            >
              {overview.queueItems.length > 0 ? (
                <ol className="divide-y">
                  {overview.queueItems.slice(0, MAX_ROWS).map((task) => (
                    <li key={task.id}>
                      <Link
                        className="flex min-w-0 flex-col gap-0.5 px-3 py-2 transition-colors hover:bg-muted/50"
                        href={getTaskDetailHref(
                          task.id,
                          { assignee: "me" },
                          { taskProjectId: task.projectId },
                        )}
                      >
                        <span className="truncate text-sm font-medium">
                          <span className="font-mono text-muted-foreground">
                            #{task.id}
                          </span>{" "}
                          {task.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <Badge variant={getTaskStateBadgeVariant(task.state)}>
                            {task.state}
                          </Badge>
                          <PriorityBadge priority={task.priority} />
                          <span className="truncate">{task.projectName}</span>
                          <span aria-hidden="true">·</span>
                          <DateLabel value={task.updatedAt} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyRow>No work items are assigned to you.</EmptyRow>
              )}
            </Panel>

            <Panel
              action={<ViewAll href={tasksHref} />}
              title="Work item states"
            >
              {overview.stateDistribution.length > 0 ? (
                <ol className="divide-y">
                  {overview.stateDistribution.map((item) => (
                    <li key={item.state}>
                      <Link
                        className="flex items-center gap-3 px-3 py-1.5 transition-colors hover:bg-muted/50"
                        href={getTaskListHref({ states: [item.state] })}
                      >
                        <Badge
                          className="shrink-0"
                          variant={getTaskStateBadgeVariant(item.state)}
                        >
                          {item.state}
                        </Badge>
                        {/* A share bar reads faster than a raw count when the
                            question is which states dominate. */}
                        <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-foreground/60"
                            style={{
                              width: `${Math.max(item.share * 100, 2)}%`,
                            }}
                          />
                        </span>
                        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {item.count}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyRow>No open work items.</EmptyRow>
              )}
            </Panel>
          </div>

          {/* Kept as a compact strip: these were previously a headline tile and
              a full card showing the same three numbers. */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Blocked", value: overview.blockedCount },
              {
                label: `Stale ${overview.staleAfterDays}d+`,
                value: overview.staleCount,
              },
              { label: "Unassigned", value: overview.unassignedCount },
            ].map((stat) => (
              <div
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2",
                  stat.value === 0 && "text-muted-foreground",
                )}
                key={stat.label}
              >
                <span className="truncate text-xs text-muted-foreground">
                  {stat.label}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
