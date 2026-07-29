import "server-only";
import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  lt,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import { getLocalSettingsDb } from "@/db";
import { jobs } from "@/db/schema";

const JOB_ATTEMPT_TIMEOUT_MILLISECONDS = 2 * 60 * 60 * 1_000;
const JOB_HEARTBEAT_MILLISECONDS = 30_000;
const JOB_LEASE_MILLISECONDS = 2 * 60 * 1_000;
const JOB_RETENTION_MILLISECONDS = 30 * 24 * 60 * 60 * 1_000;

export type Job = typeof jobs.$inferSelect;

type JobWriteDatabase = Pick<
  ReturnType<typeof getLocalSettingsDb>,
  "insert" | "query" | "update"
>;

function now() {
  return new Date().toISOString();
}

function leaseExpiration() {
  return new Date(Date.now() + JOB_LEASE_MILLISECONDS).toISOString();
}

export function getJob(jobId: string) {
  return (
    getLocalSettingsDb().query.jobs
      .findFirst({
        where: eq(jobs.id, jobId),
      })
      .sync() ?? null
  );
}

export function getActiveJob(input: {
  resourceId: string;
  resourceType: string;
  type: string;
}) {
  return (
    getLocalSettingsDb().query.jobs
      .findFirst({
        orderBy: (table, { desc }) => [desc(table.createdAt)],
        where: and(
          eq(jobs.resourceId, input.resourceId),
          eq(jobs.resourceType, input.resourceType),
          eq(jobs.type, input.type),
          inArray(jobs.status, ["queued", "running"]),
        ),
      })
      .sync() ?? null
  );
}

export function getLatestJob(input: {
  resourceId: string;
  resourceType: string;
  type: string;
}) {
  return (
    getLocalSettingsDb().query.jobs
      .findFirst({
        orderBy: (table) => [desc(table.createdAt)],
        where: and(
          eq(jobs.resourceId, input.resourceId),
          eq(jobs.resourceType, input.resourceType),
          eq(jobs.type, input.type),
        ),
      })
      .sync() ?? null
  );
}

export function enqueueJob(
  input: {
    maxAttempts?: number;
    payload: string;
    priority?: number;
    replaceQueued?: boolean;
    resourceId: string;
    resourceType: string;
    type: string;
  },
  database?: JobWriteDatabase,
) {
  function enqueue(target: JobWriteDatabase) {
    const existing =
      target.query.jobs
        .findFirst({
          orderBy: (table, { desc }) => [desc(table.createdAt)],
          where: and(
            eq(jobs.resourceId, input.resourceId),
            eq(jobs.resourceType, input.resourceType),
            eq(jobs.type, input.type),
            inArray(jobs.status, ["queued", "running"]),
          ),
        })
        .sync() ?? null;

    if (existing?.status === "running") {
      return existing;
    }

    const timestamp = now();
    const priority = input.priority ?? 0;

    if (existing) {
      if (
        input.replaceQueued ||
        priority > existing.priority
      ) {
        target
          .update(jobs)
          .set({
            availableAt: input.replaceQueued
              ? timestamp
              : existing.availableAt,
            payload: input.replaceQueued
              ? input.payload
              : existing.payload,
            priority: Math.max(priority, existing.priority),
            updatedAt: timestamp,
          })
          .where(
            and(
              eq(jobs.id, existing.id),
              eq(jobs.status, "queued"),
            ),
          )
          .run();
      }

      return target.query.jobs
        .findFirst({
          where: eq(jobs.id, existing.id),
        })
        .sync()!;
    }

    const job: typeof jobs.$inferInsert = {
      availableAt: timestamp,
      createdAt: timestamp,
      id: randomUUID(),
      maxAttempts: input.maxAttempts ?? 3,
      payload: input.payload,
      priority,
      resourceId: input.resourceId,
      resourceType: input.resourceType,
      type: input.type,
      updatedAt: timestamp,
    };

    target.insert(jobs).values(job).run();

    return target.query.jobs
      .findFirst({
        where: eq(jobs.id, job.id),
      })
      .sync()!;
  }

  return database
    ? enqueue(database)
    : getLocalSettingsDb().transaction(enqueue);
}

export function claimNextJob(type: string) {
  const db = getLocalSettingsDb();

  return db.transaction((transaction) => {
    const timestamp = now();
    const candidate =
      transaction.query.jobs
        .findFirst({
          orderBy: (table) => [
            desc(table.priority),
            asc(table.availableAt),
            asc(table.createdAt),
          ],
          where: and(
            eq(jobs.type, type),
            eq(jobs.status, "queued"),
            lt(jobs.attemptCount, jobs.maxAttempts),
            lte(jobs.availableAt, timestamp),
          ),
        })
        .sync() ?? null;

    if (!candidate) {
      return null;
    }

    const claimed = transaction
      .update(jobs)
      .set({
        attemptCount: sql`${jobs.attemptCount} + 1`,
        errorMessage: null,
        leaseExpiresAt: leaseExpiration(),
        startedAt: candidate.startedAt ?? timestamp,
        status: "running",
        updatedAt: timestamp,
      })
      .where(
        and(
          eq(jobs.id, candidate.id),
          eq(jobs.status, "queued"),
        ),
      )
      .run();

    if (claimed.changes === 0) {
      return null;
    }

    return transaction.query.jobs
      .findFirst({
        where: eq(jobs.id, candidate.id),
      })
      .sync()!;
  });
}

export function renewJobLease(jobId: string, attemptCount: number) {
  return getLocalSettingsDb()
    .update(jobs)
    .set({
      leaseExpiresAt: leaseExpiration(),
      updatedAt: now(),
    })
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.status, "running"),
        eq(jobs.attemptCount, attemptCount),
      ),
    )
    .run().changes;
}

export async function runJobAttempt<T>(
  job: Job,
  operation: (signal: AbortSignal) => Promise<T>,
) {
  const controller = new AbortController();
  let abortError: Error | null = null;
  const abort = (error: Error) => {
    if (controller.signal.aborted) {
      return;
    }

    abortError = error;
    controller.abort(error);
  };
  const timeout = setTimeout(() => {
    abort(new Error("The job attempt exceeded its two-hour time limit."));
  }, JOB_ATTEMPT_TIMEOUT_MILLISECONDS);
  const heartbeat = setInterval(() => {
    try {
      if (renewJobLease(job.id, job.attemptCount) === 0) {
        abort(new Error("The job lease was lost."));
      }
    } catch (error) {
      abort(
        error instanceof Error
          ? error
          : new Error("The job heartbeat failed.", {
              cause: error,
            }),
      );
    }
  }, JOB_HEARTBEAT_MILLISECONDS);
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => {
        reject(abortError ?? new Error("The job attempt was cancelled."));
      },
      { once: true },
    );
  });

  timeout.unref();
  heartbeat.unref();

  try {
    return await Promise.race([
      operation(controller.signal),
      aborted,
    ]);
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeat);
  }
}

export function updateJobProgress(
  jobId: string,
  attemptCount: number,
  progress: {
    current?: number;
    total?: number;
  },
) {
  return getLocalSettingsDb()
    .update(jobs)
    .set({
      leaseExpiresAt: leaseExpiration(),
      progressCurrent: progress.current,
      progressTotal: progress.total,
      updatedAt: now(),
    })
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.status, "running"),
        eq(jobs.attemptCount, attemptCount),
      ),
    )
    .run().changes;
}

export function completeJob(jobId: string, attemptCount: number) {
  const timestamp = now();

  const completed = getLocalSettingsDb()
    .update(jobs)
    .set({
      completedAt: timestamp,
      leaseExpiresAt: null,
      status: "completed",
      updatedAt: timestamp,
    })
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.status, "running"),
        eq(jobs.attemptCount, attemptCount),
      ),
    )
    .run().changes;

  return completed === 0 ? null : getJob(jobId);
}

export function retryOrFailJob(
  jobId: string,
  attemptCount: number,
  errorMessage: string,
  retryDelayMilliseconds: number,
) {
  const job = getJob(jobId);

  if (
    !job ||
    job.status !== "running" ||
    job.attemptCount !== attemptCount
  ) {
    return job;
  }

  const timestamp = now();
  const retry = job.attemptCount < job.maxAttempts;

  getLocalSettingsDb()
    .update(jobs)
    .set({
      availableAt: retry
        ? new Date(
            Date.now() + Math.max(retryDelayMilliseconds, 0),
          ).toISOString()
        : job.availableAt,
      completedAt: retry ? null : timestamp,
      errorMessage,
      leaseExpiresAt: null,
      status: retry ? "queued" : "failed",
      updatedAt: timestamp,
    })
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.status, "running"),
        eq(jobs.attemptCount, attemptCount),
      ),
    )
    .run();

  return getJob(jobId);
}

function recoverRunningJobs(condition: SQL, errorMessage: string) {
  const timestamp = now();
  const db = getLocalSettingsDb();

  return db.transaction((transaction) => {
    const running = transaction
      .select({
        attemptCount: jobs.attemptCount,
        id: jobs.id,
        maxAttempts: jobs.maxAttempts,
      })
      .from(jobs)
      .where(condition)
      .all();
    let recovered = 0;

    for (const job of running) {
      const retry = job.attemptCount < job.maxAttempts;

      recovered += transaction
        .update(jobs)
        .set({
          availableAt: retry ? timestamp : undefined,
          completedAt: retry ? null : timestamp,
          errorMessage,
          leaseExpiresAt: null,
          status: retry ? "queued" : "failed",
          updatedAt: timestamp,
        })
        .where(
          and(
            eq(jobs.id, job.id),
            eq(jobs.status, "running"),
            eq(jobs.attemptCount, job.attemptCount),
          ),
        )
        .run().changes;
    }

    return recovered;
  });
}

export function recoverExpiredJobs() {
  const timestamp = now();

  return recoverRunningJobs(
    and(
      eq(jobs.status, "running"),
      lte(jobs.leaseExpiresAt, timestamp),
    )!,
    "The job stopped responding and its lease expired.",
  );
}

export function deleteExpiredJobHistory() {
  const cutoff = new Date(
    Date.now() - JOB_RETENTION_MILLISECONDS,
  ).toISOString();

  return getLocalSettingsDb()
    .delete(jobs)
    .where(
      and(
        inArray(jobs.status, ["completed", "failed"]),
        lt(jobs.completedAt, cutoff),
      ),
    )
    .run().changes;
}
