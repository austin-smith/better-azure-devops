"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircleIcon,
  BarChart3Icon,
  Clock3Icon,
  DownloadIcon,
  RefreshCwIcon,
} from "lucide-react";
import { IdentityImage } from "@/components/identity-image";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ANALYTICS_RANGES,
  getAnalyticsRangeLabel,
  type AnalyticsRange,
} from "@/lib/analytics/filters";
import type { RepositoryAnalyticsReport } from "@/lib/analytics/report";
import type { RepositoryAnalyticsJob } from "@/lib/analytics/refresh";

type RepositoryAnalyticsProps = {
  activeJob: RepositoryAnalyticsJob | null;
  branch: string;
  lastSyncedAt: string | null;
  projectId: string;
  range: AnalyticsRange;
  report: RepositoryAnalyticsReport;
  repositoryId: string;
};

const numberFormatter = new Intl.NumberFormat("en-US");

function AnalyticsChartsFallback() {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {[
        {
          description: "Added and deleted lines by merge week",
          title: "Weekly footprint",
        },
        {
          description: "Completed pull requests by measured churn",
          title: "Pull request size",
        },
      ].map((chart) => (
        <Card key={chart.title}>
          <CardHeader>
            <CardTitle>{chart.title}</CardTitle>
            <CardDescription>{chart.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const RepositoryAnalyticsCharts = dynamic(
  () =>
    import(
      "@/components/repositories/repository-analytics-charts"
    ).then((module) => module.RepositoryAnalyticsCharts),
  {
    loading: AnalyticsChartsFallback,
    ssr: false,
  },
);

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-2xl tabular-nums">
          {formatNumber(value)}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function ContributorAvatarStack({
  contributors,
}: {
  contributors: RepositoryAnalyticsReport["hotspots"][number]["contributors"];
}) {
  if (contributors.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <AvatarGroup
      aria-label={`${contributors.length} contributor${contributors.length === 1 ? "" : "s"}`}
      className="justify-end"
    >
      {contributors.map((contributor) => (
        <Tooltip key={contributor.id}>
          <TooltipTrigger
            render={
              <button
                aria-label={contributor.displayName}
                className="rounded-full ring-2 ring-background focus-visible:outline-none focus-visible:ring-ring"
                type="button"
              />
            }
          >
            <IdentityImage
              imageUrl={contributor.imageUrl}
              label={contributor.displayName}
              size="sm"
            />
          </TooltipTrigger>
          <TooltipContent>{contributor.displayName}</TooltipContent>
        </Tooltip>
      ))}
    </AvatarGroup>
  );
}

function RefreshStatus({
  job,
}: {
  job: RepositoryAnalyticsJob;
}) {
  if (job.status === "failed") {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Refresh failed</AlertTitle>
        <AlertDescription>
          {job.errorMessage ?? "Azure DevOps analytics could not be refreshed."}
        </AlertDescription>
      </Alert>
    );
  }

  if (job.status === "completed") {
    return null;
  }

  if (job.status === "queued") {
    const retrying = Boolean(job.errorMessage);

    return (
      <div className="flex min-h-9 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Clock3Icon />
        <span className="font-medium text-foreground">
          {retrying ? "Retry queued" : "Queued"}
        </span>
        {retrying ? (
          <span className="min-w-0 truncate" title={job.errorMessage ?? undefined}>
            {job.errorMessage}
          </span>
        ) : null}
        <span className="ml-auto shrink-0">
          {job.availableAt > new Date().toISOString()
            ? formatDateTime(job.availableAt)
            : "Waiting to start"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-h-9 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <RefreshCwIcon className="animate-spin" />
      <span className="font-medium text-foreground">Syncing</span>
      {job.progressTotal > 0 ? (
        <span className="ml-auto font-mono tabular-nums">
          {formatNumber(job.progressCurrent)} /{" "}
          {formatNumber(job.progressTotal)}
        </span>
      ) : job.startedAt ? (
        <span className="ml-auto">
          Started {formatDateTime(job.startedAt)}
        </span>
      ) : null}
    </div>
  );
}

export function RepositoryAnalytics({
  activeJob,
  branch,
  lastSyncedAt,
  projectId,
  range,
  report,
  repositoryId,
}: RepositoryAnalyticsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [job, setJob] = useState(activeJob);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const activeJobId =
    job?.status === "queued" || job?.status === "running"
      ? job.id
      : null;

  useEffect(() => {
    if (!activeJobId) {
      return;
    }

    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      let finished = false;

      try {
        const response = await fetch(
          `/api/repos/${encodeURIComponent(projectId)}/${encodeURIComponent(repositoryId)}/analytics/jobs/${encodeURIComponent(activeJobId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as {
          error?: string;
          job?: RepositoryAnalyticsJob;
        };

        if (!response.ok || !payload.job) {
          throw new Error(payload.error ?? "Refresh status is unavailable.");
        }

        setRefreshError(null);
        setJob(payload.job);

        if (payload.job.status === "completed") {
          finished = true;
          setJob(null);
          router.refresh();
        } else if (payload.job.status === "failed") {
          finished = true;
        }
      } catch (error) {
        setRefreshError(
          error instanceof Error ? error.message : "Refresh status is unavailable.",
        );
      } finally {
        if (!cancelled && !finished) {
          timer = window.setTimeout(poll, 1_500);
        }
      }
    };

    timer = window.setTimeout(poll, 1_500);

    return () => {
      cancelled = true;

      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [activeJobId, projectId, repositoryId, router]);

  const exportBase = useMemo(() => {
    const params = new URLSearchParams({
      branch,
      range,
    });

    return `/api/repos/${encodeURIComponent(projectId)}/${encodeURIComponent(repositoryId)}/analytics/export?${params}`;
  }, [branch, projectId, range, repositoryId]);

  function updateQuery(name: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());

    if (value === null) {
      next.delete(name);
    } else {
      next.set(name, value);
    }

    router.push(`${pathname}?${next}`);
  }

  async function startRefresh() {
    setIsStarting(true);
    setRefreshError(null);

    try {
      const response = await fetch(
        `/api/repos/${encodeURIComponent(projectId)}/${encodeURIComponent(repositoryId)}/analytics/refresh`,
        {
          method: "POST",
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        job?: RepositoryAnalyticsJob;
      };

      if (!response.ok || !payload.job) {
        throw new Error(payload.error ?? "Analytics refresh could not start.");
      }

      setJob(payload.job);
    } catch (error) {
      setRefreshError(
        error instanceof Error
          ? error.message
          : "Analytics refresh could not start.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  const refreshActive =
    job?.status === "queued" || job?.status === "running";
  const refreshQueued = job?.status === "queued";
  const refreshRunning = job?.status === "running";
  const refreshRetryQueued =
    refreshQueued && Boolean(job.errorMessage);
  const hasData = report.totals.pullRequests > 0;
  const coveragePercent =
    report.coverage.eligibleFiles === 0
      ? report.coverage.pullRequests === 0 ||
        report.coverage.measuredPullRequests ===
          report.coverage.pullRequests
        ? 100
        : 0
      : Math.round(
          (report.coverage.measuredFiles /
            report.coverage.eligibleFiles) *
            100,
        );

  return (
    <div className="flex flex-col gap-4 p-3 md:p-4">
      <section className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">
            Analytics
          </h1>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge className="font-mono font-normal" variant="outline">
              {branch}
            </Badge>
            {lastSyncedAt ? (
              <span>
                Updated {formatDateTime(lastSyncedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            onValueChange={(value) => updateQuery("range", value)}
            value={range}
          >
            <SelectTrigger aria-label="Time window" className="min-w-28">
              <Clock3Icon aria-hidden="true" />
              <SelectValue>
                {getAnalyticsRangeLabel(range)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {ANALYTICS_RANGES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {getAnalyticsRangeLabel(value)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {hasData ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    className={buttonVariants({
                      size: "sm",
                      variant: "outline",
                    })}
                    href={`${exportBase}&format=csv`}
                  />
                }
              >
                <DownloadIcon data-icon="inline-start" />
                CSV
              </TooltipTrigger>
              <TooltipContent>Download CSV</TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <Button
                aria-label="Sync analytics now"
                disabled={isStarting || refreshActive}
                onClick={startRefresh}
                size="icon"
                variant="outline"
              >
                <RefreshCwIcon
                  className={
                    isStarting || refreshRunning ? "animate-spin" : undefined
                  }
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sync analytics now</TooltipContent>
          </Tooltip>
        </div>
      </section>

      {job && (hasData || job.status === "failed") ? (
        <RefreshStatus job={job} />
      ) : null}
      {refreshError ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Refresh unavailable</AlertTitle>
          <AlertDescription>{refreshError}</AlertDescription>
        </Alert>
      ) : null}

      {!hasData ? (
        <Empty className="min-h-80 border">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
            >
              {refreshRunning ? (
                <RefreshCwIcon className="animate-spin" />
              ) : refreshQueued ? (
                <Clock3Icon />
              ) : (
                <BarChart3Icon />
              )}
            </EmptyMedia>
            <EmptyTitle>
              {refreshRunning
                ? "Syncing"
                : refreshRetryQueued
                  ? "Retry queued"
                  : refreshQueued
                    ? "Queued"
                    : "No data"}
            </EmptyTitle>
            <EmptyDescription>
              {refreshRunning
                ? job.progressTotal > 0
                  ? `${formatNumber(job.progressCurrent)} of ${formatNumber(job.progressTotal)} pull requests`
                  : "Loading completed pull requests"
                : refreshRetryQueued
                  ? `${job.errorMessage} Retrying ${formatDateTime(job.availableAt)}.`
                  : refreshQueued
                    ? "Waiting to start"
                    : `No completed pull requests in ${getAnalyticsRangeLabel(range).toLowerCase()}.`}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="Pull requests"
              value={report.totals.pullRequests}
            />
            <MetricCard
              label="Lines added"
              value={report.totals.additions}
            />
            <MetricCard
              label="Lines deleted"
              value={report.totals.deletions}
            />
            <MetricCard
              label="Total churn"
              value={report.totals.churn}
            />
            <MetricCard
              label="Files touched"
              value={report.totals.filesTouched}
            />
            <MetricCard
              label="Merge days"
              value={report.totals.mergeDays}
            />
          </section>

          <RepositoryAnalyticsCharts
            pullRequestSizes={report.pullRequestSizes}
            trend={report.trend}
          />

          <Card>
            <CardHeader>
              <CardTitle>Contributor footprint</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Contributor</TableHead>
                    <TableHead className="text-right">PRs</TableHead>
                    <TableHead className="text-right">Added</TableHead>
                    <TableHead className="text-right">Deleted</TableHead>
                    <TableHead className="text-right">Churn</TableHead>
                    <TableHead className="text-right">Files</TableHead>
                    <TableHead className="pr-4 text-right">Merge days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.contributors.map((contributor) => (
                    <TableRow key={contributor.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2">
                          <IdentityImage
                            imageUrl={contributor.imageUrl}
                            label={contributor.displayName}
                            size="sm"
                          />
                          <span className="font-medium">
                            {contributor.displayName}
                          </span>
                        </div>
                      </TableCell>
                      {[
                        contributor.pullRequests,
                        contributor.additions,
                        contributor.deletions,
                        contributor.churn,
                        contributor.filesTouched,
                        contributor.mergeDays,
                      ].map((value, index) => (
                        <TableCell
                          className={`text-right font-mono tabular-nums ${index === 5 ? "pr-4" : ""}`}
                          key={index}
                        >
                          {formatNumber(value)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Code hotspots</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Path</TableHead>
                    <TableHead className="text-right">Churn</TableHead>
                    <TableHead className="text-right">PRs</TableHead>
                    <TableHead className="pr-4 text-right">Contributors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.hotspots.slice(0, 10).map((hotspot) => (
                    <TableRow key={hotspot.path}>
                      <TableCell className="max-w-xl truncate pl-4 font-mono text-xs">
                        {hotspot.path}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatNumber(hotspot.churn)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatNumber(hotspot.pullRequests)}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <ContributorAvatarStack
                          contributors={hotspot.contributors}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
            <span>{coveragePercent}% measurement coverage</span>
            {report.coverage.incompletePullRequests > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {formatNumber(
                    report.coverage.incompletePullRequests,
                  )}{" "}
                  incomplete pull request
                  {report.coverage.incompletePullRequests === 1
                    ? ""
                    : "s"}
                </span>
              </>
            ) : null}
            {report.coverage.unavailableFiles > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {formatNumber(report.coverage.unavailableFiles)}{" "}
                  unavailable text file
                  {report.coverage.unavailableFiles === 1 ? "" : "s"}
                </span>
              </>
            ) : null}
            {report.coverage.tooLargeFiles > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {formatNumber(report.coverage.tooLargeFiles)} text file
                  {report.coverage.tooLargeFiles === 1 ? "" : "s"} above
                  the measurement limit
                </span>
              </>
            ) : null}
            {report.coverage.unattributedPullRequests > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {formatNumber(
                    report.coverage.unattributedPullRequests,
                  )}{" "}
                  pull request
                  {report.coverage.unattributedPullRequests === 1
                    ? ""
                    : "s"}{" "}
                  had no contributor identity
                </span>
              </>
            ) : null}
            {report.coverage.unsupportedPullRequests > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {formatNumber(
                    report.coverage.unsupportedPullRequests,
                  )}{" "}
                  unsupported merge
                  {report.coverage.unsupportedPullRequests === 1
                    ? ""
                    : "s"}
                </span>
              </>
            ) : null}
          </footer>
        </>
      )}
    </div>
  );
}
