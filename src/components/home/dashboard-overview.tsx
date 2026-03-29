import Link from "next/link";
import type { ComponentType } from "react";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  Clock3Icon,
  LayoutListIcon,
  UserCircle2Icon,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { DateLabel } from "@/components/date-label";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardOverview } from "@/lib/tasks/load-dashboard-overview";
import {
  getDefaultTaskListHref,
  getTaskDetailHref,
  getTaskListHref,
} from "@/lib/tasks/navigation";
import { getTaskStateBadgeVariant } from "@/lib/tasks/state";

type DashboardOverviewProps = {
  overview: DashboardOverview;
};

type KpiCardProps = {
  href?: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
};

function KpiCard({ href, icon: Icon, label, value }: KpiCardProps) {
  const card = (
    <Card
      size="sm"
      className={`h-full gap-0 ${href ? "transition-colors hover:bg-muted/40" : ""}`}
    >
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xs font-medium tracking-normal text-muted-foreground">
            {label}
          </CardTitle>
          <div className="flex size-7 items-center justify-center rounded-md border bg-background text-muted-foreground">
            <Icon className="size-3.5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );

  if (!href) {
    return card;
  }

  return <Link href={href}>{card}</Link>;
}

export function DashboardOverview({ overview }: DashboardOverviewProps) {
  const tasksHref = getDefaultTaskListHref();
  const queueHref = getTaskListHref({ assignee: "me" });

  return (
    <>
      <AppHeader
        actions={
          <>
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href={tasksHref} />}
            >
              Tasks
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href={queueHref} />}
            >
              Your Queue
            </Button>
            <ThemeToggle />
          </>
        }
        items={[{ label: "Home" }]}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-5">
          {overview.error ? (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="py-1 text-sm text-destructive">
                {overview.error}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              href={tasksHref}
              icon={LayoutListIcon}
              label="Open Tasks"
              value={overview.openTaskCount}
            />
            <KpiCard
              icon={Clock3Icon}
              label={`Updated ${overview.recentChangeWindowHours}h`}
              value={overview.recentChangeCount}
            />
            <KpiCard
              icon={AlertTriangleIcon}
              label="Needs Attention"
              value={overview.attentionCount}
            />
            <KpiCard
              href={queueHref}
              icon={UserCircle2Icon}
              label="Your Queue"
              value={overview.queueCount}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {/* Recent Changes */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Changes</CardTitle>
                <CardDescription>
                  {overview.recentChangeCount} updated in the last{" "}
                  {overview.recentChangeWindowHours}h
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overview.recentLatestItem ? (
                  <Link
                    className="flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                    href={getTaskDetailHref(overview.recentLatestItem.id)}
                  >
                    <div className="font-medium">
                      #{overview.recentLatestItem.id}{" "}
                      {overview.recentLatestItem.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant={getTaskStateBadgeVariant(
                          overview.recentLatestItem.state,
                        )}
                      >
                        {overview.recentLatestItem.state}
                      </Badge>
                      <span>{overview.recentLatestItem.assignee}</span>
                      <DateLabel value={overview.recentLatestItem.updatedAt} />
                    </div>
                  </Link>
                ) : (
                  <div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                    No recent changes.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Needs Attention */}
            <Card>
              <CardHeader>
                <CardTitle>Needs Attention</CardTitle>
                <CardDescription>
                  {overview.attentionCount} items flagged
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 sm:flex-col sm:items-start sm:justify-start">
                    <span className="text-xs font-medium text-muted-foreground">
                      Blocked
                    </span>
                    <span className="text-2xl font-semibold tracking-tight">
                      {overview.blockedCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 sm:flex-col sm:items-start sm:justify-start">
                    <span className="text-xs font-medium text-muted-foreground">
                      Stale ({overview.staleAfterDays}+ days)
                    </span>
                    <span className="text-2xl font-semibold tracking-tight">
                      {overview.staleCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 sm:flex-col sm:items-start sm:justify-start">
                    <span className="text-xs font-medium text-muted-foreground">
                      Unassigned
                    </span>
                    <span className="text-2xl font-semibold tracking-tight">
                      {overview.unassignedCount}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Project Health */}
            <Card>
              <CardHeader>
                <CardTitle>Project Health</CardTitle>
                <CardDescription>
                  {overview.openTaskCount} open across{" "}
                  {overview.stateDistribution.length} states
                </CardDescription>
                <CardAction>
                  <Button
                    nativeButton={false}
                    variant="outline"
                    size="sm"
                    render={<Link href={tasksHref} />}
                  >
                    View all
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {overview.stateDistribution.length > 0 ? (
                  <>
                    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                      {overview.stateDistribution.map((item) => (
                        <div
                          key={item.state}
                          className="bg-foreground/70 first:rounded-l-full last:rounded-r-full"
                          style={{
                            width: `${Math.max(item.share * 100, 2)}%`,
                            opacity: 0.4 + item.share * 0.6,
                          }}
                        />
                      ))}
                    </div>
                    <div className="grid gap-1.5">
                      {overview.stateDistribution.map((item) => (
                        <Link
                          key={item.state}
                          className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
                          href={getTaskListHref({ states: [item.state] })}
                        >
                          <Badge variant={getTaskStateBadgeVariant(item.state)}>
                            {item.state}
                          </Badge>
                          <span className="tabular-nums text-muted-foreground">
                            {item.count}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                    No open tasks.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Your Queue */}
            <Card>
              <CardHeader>
                <CardTitle>Your Queue</CardTitle>
                <CardDescription>
                  {overview.queueCount} assigned to you
                </CardDescription>
                <CardAction>
                  <Button
                    nativeButton={false}
                    variant="outline"
                    size="sm"
                    render={<Link href={queueHref} />}
                  >
                    View all
                    <ArrowRightIcon />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {overview.queueItems.length > 0 ? (
                  overview.queueItems.map((task) => (
                    <Link
                      key={task.id}
                      className="rounded-lg border p-3 transition-colors hover:bg-muted/40"
                      href={getTaskDetailHref(task.id, { assignee: "me" })}
                    >
                      <div className="line-clamp-2 font-medium">
                        #{task.id} {task.title}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant={getTaskStateBadgeVariant(task.state)}>
                          {task.state}
                        </Badge>
                        <PriorityBadge priority={task.priority} />
                        <DateLabel value={task.updatedAt} />
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                    No assigned tasks.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
