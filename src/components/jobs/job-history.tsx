"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useTransition } from "react";
import {
  CheckCircle2Icon,
  CircleXIcon,
  Clock3Icon,
  ListChecksIcon,
  Loader2Icon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getJobHistoryHref } from "@/lib/job-history/filters";
import type {
  JobHistoryItem,
  JobHistoryPage,
  JobHistoryStatus,
} from "@/lib/job-history/types";
import { cn } from "@/lib/utils";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function formatDuration(milliseconds: number) {
  const seconds = Math.max(Math.round(milliseconds / 1_000), 0);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

function getDuration(job: JobHistoryItem, now: string) {
  if (!job.startedAt) {
    return null;
  }

  const end =
    job.completedAt ??
    (job.status === "running" ? now : job.updatedAt);

  return formatDuration(
    new Date(end).getTime() - new Date(job.startedAt).getTime(),
  );
}

function isJobStalled(job: JobHistoryItem, now: string) {
  return (
    job.status === "running" &&
    job.leaseExpiresAt !== null &&
    job.leaseExpiresAt <= now
  );
}

function JobStatusBadge({
  job,
  now,
}: {
  job: JobHistoryItem;
  now: string;
}) {
  if (job.status === "completed") {
    return (
      <Badge variant="secondary">
        <CheckCircle2Icon data-icon="inline-start" />
        Completed
      </Badge>
    );
  }

  if (job.status === "failed") {
    return (
      <Badge variant="destructive">
        <CircleXIcon data-icon="inline-start" />
        Failed
      </Badge>
    );
  }

  if (job.status === "running") {
    if (isJobStalled(job, now)) {
      return (
        <Badge variant="outline">
          <TriangleAlertIcon data-icon="inline-start" />
          Stalled
        </Badge>
      );
    }

    return (
      <Badge>
        <Loader2Icon
          className="animate-spin"
          data-icon="inline-start"
        />
        Running
      </Badge>
    );
  }

  return (
    <Badge variant="outline">
      <Clock3Icon data-icon="inline-start" />
      {job.errorMessage ? "Retry queued" : "Queued"}
    </Badge>
  );
}

function JobProgress({
  job,
  now,
}: {
  job: JobHistoryItem;
  now: string;
}) {
  if (job.progressTotal > 0) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-xs tabular-nums">
          {job.progressCurrent} / {job.progressTotal}
        </span>
        {job.status === "running" ? (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {isJobStalled(job, now) ? "Last heartbeat" : "Updated"}{" "}
            {formatDateTime(job.updatedAt)}
          </span>
        ) : null}
      </div>
    );
  }

  if (job.status === "queued") {
    return (
      <span className="text-xs text-muted-foreground">
        {job.availableAt > now
          ? `Available ${formatDateTime(job.availableAt)}`
          : "Waiting"}
      </span>
    );
  }

  if (job.status === "running") {
    return (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {isJobStalled(job, now) ? "Last heartbeat" : "Updated"}{" "}
        {formatDateTime(job.updatedAt)}
      </span>
    );
  }

  return <span className="text-muted-foreground">—</span>;
}

function JobStatusFilter({
  counts,
  status,
}: Pick<JobHistoryPage, "counts" | "status">) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const options: {
    count: number;
    label: string;
    value: JobHistoryStatus;
  }[] = [
    { count: counts.all, label: "All", value: "all" },
    { count: counts.active, label: "Active", value: "active" },
    { count: counts.failed, label: "Failed", value: "failed" },
    {
      count: counts.completed,
      label: "Completed",
      value: "completed",
    },
  ];

  return (
    <ToggleGroup
      aria-label="Filter jobs by status"
      onValueChange={(values) => {
        const value = values[0];

        if (
          value !== "active" &&
          value !== "all" &&
          value !== "completed" &&
          value !== "failed"
        ) {
          return;
        }

        const nextSearchParams = new URLSearchParams(searchParams);

        nextSearchParams.delete("page");

        if (value === "all") {
          nextSearchParams.delete("status");
        } else {
          nextSearchParams.set("status", value);
        }

        const query = nextSearchParams.toString();

        router.replace(query ? `${pathname}?${query}` : pathname);
      }}
      size="sm"
      spacing={0}
      value={[status]}
      variant="outline"
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {option.count}
          </span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function JobHistoryPagination({
  page,
  pageCount,
  status,
  total,
}: Pick<JobHistoryPage, "page" | "pageCount" | "status" | "total">) {
  if (total === 0) {
    return null;
  }

  const first = (page - 1) * 50 + 1;
  const last = Math.min(page * 50, total);
  const linkClassName = buttonVariants({
    size: "sm",
    variant: "outline",
  });
  const disabledClassName = cn(
    linkClassName,
    "pointer-events-none opacity-50",
  );

  return (
    <div className="flex items-center gap-2 border-t px-3 py-2">
      <span className="text-xs text-muted-foreground">
        {first}–{last} of {total}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {page > 1 ? (
          <Link
            className={linkClassName}
            href={getJobHistoryHref({ page: page - 1, status })}
          >
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClassName}>
            Previous
          </span>
        )}
        <span className="min-w-14 text-center text-xs text-muted-foreground">
          {page} / {pageCount}
        </span>
        {page < pageCount ? (
          <Link
            className={linkClassName}
            href={getJobHistoryHref({ page: page + 1, status })}
          >
            Next
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClassName}>
            Next
          </span>
        )}
      </div>
    </div>
  );
}

export function JobHistory({
  generatedAt,
  history,
}: {
  generatedAt: string;
  history: JobHistoryPage;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        startRefresh(() => {
          router.refresh();
        });
      }
    }, 5_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [router]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <JobStatusFilter
          counts={history.counts}
          status={history.status}
        />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Refresh job history"
                size="icon-sm"
                variant="outline"
              />
            }
            onClick={() => {
              startRefresh(() => {
                router.refresh();
              });
            }}
          >
            <RefreshCwIcon
              className={isRefreshing ? "animate-spin" : undefined}
            />
          </TooltipTrigger>
          <TooltipContent>Refresh job history</TooltipContent>
        </Tooltip>
      </div>

      {history.items.length === 0 ? (
        <Empty className="min-h-80 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListChecksIcon />
            </EmptyMedia>
            <EmptyTitle>No jobs found</EmptyTitle>
            <EmptyDescription>
              {history.status === "all"
                ? "Background jobs will appear here when they are created."
                : "No jobs match this status."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-3">Job</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="pr-3 text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.items.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="max-w-md pl-3 align-top">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{job.label}</span>
                      {job.description ? (
                        <span className="text-xs text-muted-foreground">
                          {job.description}
                        </span>
                      ) : null}
                      {job.errorMessage ? (
                        <span
                          className={cn(
                            "max-w-xl break-words text-xs",
                            job.status === "failed"
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {job.errorMessage}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-0.5">
                      {job.resource.href ? (
                        <Link
                          className="font-medium underline-offset-4 hover:underline"
                          href={job.resource.href}
                        >
                          {job.resource.label}
                        </Link>
                      ) : (
                        <span className="font-medium">
                          {job.resource.label}
                        </span>
                      )}
                      {job.resource.description ? (
                        <span className="max-w-56 truncate text-xs text-muted-foreground">
                          {job.resource.description}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <JobStatusBadge job={job} now={generatedAt} />
                  </TableCell>
                  <TableCell className="align-top">
                    <JobProgress job={job} now={generatedAt} />
                  </TableCell>
                  <TableCell className="align-top font-mono text-xs tabular-nums">
                    {job.attemptCount} / {job.maxAttempts}
                  </TableCell>
                  <TableCell className="whitespace-nowrap align-top text-xs">
                    <time dateTime={job.createdAt}>
                      {formatDateTime(job.createdAt)}
                    </time>
                    {job.startedAt ? (
                      <span className="mt-0.5 block text-muted-foreground">
                        Started {formatDateTime(job.startedAt)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="pr-3 text-right align-top font-mono text-xs tabular-nums">
                    {getDuration(job, generatedAt) ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <JobHistoryPagination
            page={history.page}
            pageCount={history.pageCount}
            status={history.status}
            total={history.total}
          />
        </div>
      )}
    </div>
  );
}
