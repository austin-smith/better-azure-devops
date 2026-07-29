import "server-only";
import {
  and,
  count,
  desc,
  eq,
  inArray,
  type SQL,
} from "drizzle-orm";
import { getLocalSettingsDb } from "@/db";
import { jobs, repositories } from "@/db/schema";
import { getRepositoryHref } from "@/lib/azure-devops/git/urls";
import type {
  JobHistoryItem,
  JobHistoryPage,
  JobHistoryStatus,
} from "@/lib/job-history/types";
import type { Job } from "@/lib/jobs";

export const JOB_HISTORY_PAGE_SIZE = 50;

function getStatusCondition(status: JobHistoryStatus): SQL | undefined {
  if (status === "active") {
    return inArray(jobs.status, ["queued", "running"]);
  }

  if (status === "completed" || status === "failed") {
    return eq(jobs.status, status);
  }

  return undefined;
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function parsePayload(payload: string) {
  try {
    const parsed: unknown = JSON.parse(payload);

    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function getJobDescription(job: Job) {
  const payload = parsePayload(job.payload);

  if (!payload) {
    return null;
  }

  const origin =
    payload.origin === "manual"
      ? "Manual"
      : payload.origin === "scheduled"
        ? "Scheduled"
        : null;
  const mode =
    payload.mode === "bootstrap"
      ? "Full history"
      : payload.mode === "backfill"
      ? "Backfill"
      : payload.mode === "incremental" || payload.mode === "forward"
        ? "Incremental"
        : null;
  const parts = [origin, mode].filter((part) => part !== null);

  return parts.length > 0 ? parts.join(" · ") : null;
}

function getJobLabel(type: string) {
  if (type === "sync_repository_pull_requests") {
    return "Repository analytics sync";
  }

  return titleCase(type);
}

export function loadJobHistory(input: {
  page: number;
  status: JobHistoryStatus;
}): JobHistoryPage {
  const db = getLocalSettingsDb();
  const condition = getStatusCondition(input.status);
  const statusCounts = {
    completed: 0,
    failed: 0,
    queued: 0,
    running: 0,
  };

  for (const row of db
    .select({
      count: count(),
      status: jobs.status,
    })
    .from(jobs)
    .groupBy(jobs.status)
    .all()) {
    statusCounts[row.status] = row.count;
  }

  const total =
    db
      .select({ count: count() })
      .from(jobs)
      .where(condition)
      .get()?.count ?? 0;
  const pageCount = Math.max(
    1,
    Math.ceil(total / JOB_HISTORY_PAGE_SIZE),
  );
  const page = Math.min(input.page, pageCount);
  const rows = db
    .select({
      job: jobs,
      repository: {
        id: repositories.id,
        name: repositories.name,
        projectId: repositories.projectId,
        projectName: repositories.projectName,
      },
    })
    .from(jobs)
    .leftJoin(
      repositories,
      and(
        eq(jobs.resourceType, "repository"),
        eq(jobs.resourceId, repositories.id),
      ),
    )
    .where(condition)
    .orderBy(desc(jobs.createdAt))
    .limit(JOB_HISTORY_PAGE_SIZE)
    .offset((page - 1) * JOB_HISTORY_PAGE_SIZE)
    .all();

  return {
    counts: {
      active: statusCounts.queued + statusCounts.running,
      all:
        statusCounts.completed +
        statusCounts.failed +
        statusCounts.queued +
        statusCounts.running,
      completed: statusCounts.completed,
      failed: statusCounts.failed,
    },
    items: rows.map((row): JobHistoryItem => {
      const job = row.job;
      const repository = row.repository;

      return {
        attemptCount: job.attemptCount,
        availableAt: job.availableAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
        description: getJobDescription(job),
        errorMessage: job.errorMessage,
        id: job.id,
        label: getJobLabel(job.type),
        leaseExpiresAt: job.leaseExpiresAt,
        maxAttempts: job.maxAttempts,
        progressCurrent: job.progressCurrent,
        progressTotal: job.progressTotal,
        resource: repository
          ? {
              description: repository.projectName,
              href: `${getRepositoryHref(
                repository.projectId,
                repository.id,
              )}/analytics`,
              label: repository.name,
            }
          : {
              description: job.resourceId,
              href: null,
              label: titleCase(job.resourceType),
            },
        resourceId: job.resourceId,
        resourceType: job.resourceType,
        startedAt: job.startedAt,
        status: job.status,
        type: job.type,
        updatedAt: job.updatedAt,
      };
    }),
    page,
    pageCount,
    status: input.status,
    total,
  };
}
