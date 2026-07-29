import "server-only";
import {
  and,
  asc,
  eq,
  isNull,
  ne,
  or,
} from "drizzle-orm";
import { getLocalSettingsDb } from "@/db";
import {
  pullRequestFileMetrics,
  pullRequestMetrics,
  pullRequests,
  repositories,
} from "@/db/schema";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import {
  getAzureDevOpsConfig,
} from "@/lib/azure-devops/config";
import {
  AzureDevOpsDataError,
  AzureDevOpsError,
  describeAzureDevOpsError,
} from "@/lib/azure-devops/errors";
import { reportAzureDevOpsError } from "@/lib/azure-devops/report-error";
import { getRepositoryCommit } from "@/lib/azure-devops/git/commits";
import {
  getRepositoryPullRequest,
  listCompletedRepositoryPullRequests,
} from "@/lib/azure-devops/git/pull-requests";
import type {
  AzureGitPullRequest,
  AzureGitRepository,
} from "@/lib/azure-devops/git/types";
import { getGitVersionRefName } from "@/lib/azure-devops/git/urls";
import { TextResponseReadError } from "@/lib/azure-devops/text-response";
import {
  claimNextJob,
  completeJob,
  enqueueJob,
  getJob,
  getLatestJob,
  retryOrFailJob,
  runJobAttempt,
  type Job,
  updateJobProgress,
} from "@/lib/jobs";
import {
  measurePullRequestFiles,
  type AnalyticsFileMeasurement,
} from "@/lib/analytics/measure";
import { ANALYTICS_MEASUREMENT_VERSION } from "@/lib/analytics/measurement-version";
import { loadAnalyticsSettings } from "@/lib/analytics/settings";

export const REPOSITORY_ANALYTICS_JOB_TYPE =
  "sync_repository_pull_requests";

const INCREMENTAL_OVERLAP_MILLISECONDS = 24 * 60 * 60 * 1_000;
const FILE_METRIC_INSERT_BATCH_SIZE = 100;
const PULL_REQUEST_MEASUREMENT_CONCURRENCY = 2;

export type RepositoryAnalyticsJob = Job;

type RepositoryDatabase = Pick<
  ReturnType<typeof getLocalSettingsDb>,
  "insert" | "query" | "update"
>;

type RepositorySyncJobPayload = {
  mode: "bootstrap" | "incremental";
  origin: "manual" | "scheduled";
  version: 1;
  windowEnd: string;
  windowStart?: string;
};

function now() {
  return new Date().toISOString();
}

function addMilliseconds(value: string, milliseconds: number) {
  return new Date(
    new Date(value).getTime() + milliseconds,
  ).toISOString();
}

function subtractMilliseconds(value: string, milliseconds: number) {
  return addMilliseconds(value, -milliseconds);
}

function parseClosedAt(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function getAnalyticsRefreshIntervalHours() {
  return loadAnalyticsSettings().refreshIntervalHours;
}

function getHistoryWindowStart(
  windowEnd: string,
  historyWindowDays: number | null,
) {
  return historyWindowDays === null
    ? null
    : subtractMilliseconds(
        windowEnd,
        historyWindowDays * 24 * 60 * 60 * 1_000,
      );
}

export function needsRepositoryBootstrap(
  repository: typeof repositories.$inferSelect,
  historyWindowDays: number | null,
  referenceTime = now(),
) {
  if (!repository.historySyncCompletedAt) {
    return true;
  }

  const desiredStart = getHistoryWindowStart(
    referenceTime,
    historyWindowDays,
  );

  if (desiredStart === null) {
    return repository.pullRequestsSyncedFrom !== null;
  }

  return (
    repository.pullRequestsSyncedFrom !== null &&
    repository.pullRequestsSyncedFrom > desiredStart
  );
}

export function getAnalyticsTargetRefName(branch: string) {
  const normalized = branch.trim().replace(/^refs\/heads\//, "");
  const targetRefName = getGitVersionRefName({
    type: "branch",
    value: normalized,
  });

  if (!targetRefName || normalized.length === 0 || normalized.length > 400) {
    throw new Error("A valid branch is required.");
  }

  return targetRefName;
}

export function getRepositoryRecord(
  repositoryId: string,
  database: Pick<RepositoryDatabase, "query"> = getLocalSettingsDb(),
) {
  return (
    database.query.repositories
      .findFirst({
        where: eq(repositories.id, repositoryId),
      })
      .sync() ?? null
  );
}

export function saveRepository(
  repository: AzureGitRepository,
  database: Pick<RepositoryDatabase, "insert"> = getLocalSettingsDb(),
) {
  const { orgUrl } = getAzureDevOpsConfig();
  const timestamp = now();
  const values: typeof repositories.$inferInsert = {
    defaultBranch: repository.defaultBranch,
    id: repository.id,
    isDisabled: repository.isDisabled,
    isTracked: true,
    name: repository.name,
    nextPullRequestSyncAt: timestamp,
    organizationUrl: orgUrl,
    projectId: repository.project.id,
    projectName: repository.project.name,
    updatedAt: timestamp,
    webUrl: repository.webUrl,
  };

  database
    .insert(repositories)
    .values(values)
    .onConflictDoUpdate({
      set: {
        defaultBranch: values.defaultBranch,
        isDisabled: values.isDisabled,
        isTracked: true,
        name: values.name,
        organizationUrl: values.organizationUrl,
        projectId: values.projectId,
        projectName: values.projectName,
        updatedAt: timestamp,
        webUrl: values.webUrl,
      },
      target: repositories.id,
    })
    .run();
}

export function getRepositoryAnalyticsJob(repositoryId: string) {
  return getLatestJob({
    resourceId: repositoryId,
    resourceType: "repository",
    type: REPOSITORY_ANALYTICS_JOB_TYPE,
  });
}

export function getRepositoryAnalyticsJobById(jobId: string) {
  const job = getJob(jobId);

  return job?.type === REPOSITORY_ANALYTICS_JOB_TYPE ? job : null;
}

function createSyncPayload(
  repository: typeof repositories.$inferSelect,
  origin: RepositorySyncJobPayload["origin"],
): RepositorySyncJobPayload {
  const windowEnd = now();
  const { historyWindowDays } = loadAnalyticsSettings();

  if (
    needsRepositoryBootstrap(
      repository,
      historyWindowDays,
      windowEnd,
    ) ||
    !repository.pullRequestsSyncedThrough
  ) {
    const windowStart = getHistoryWindowStart(
      windowEnd,
      historyWindowDays,
    );

    return {
      mode: "bootstrap",
      origin,
      version: 1,
      windowEnd,
      ...(windowStart ? { windowStart } : {}),
    };
  }

  return {
    mode: "incremental",
    origin,
    version: 1,
    windowEnd,
    windowStart: subtractMilliseconds(
      repository.pullRequestsSyncedThrough,
      INCREMENTAL_OVERLAP_MILLISECONDS,
    ),
  } satisfies RepositorySyncJobPayload;
}

function createBootstrapPayload(
  repository: typeof repositories.$inferSelect,
) {
  const windowEnd = now();
  const { historyWindowDays } = loadAnalyticsSettings();

  if (
    !needsRepositoryBootstrap(
      repository,
      historyWindowDays,
      windowEnd,
    )
  ) {
    return null;
  }

  const windowStart = getHistoryWindowStart(
    windowEnd,
    historyWindowDays,
  );

  return {
    mode: "bootstrap",
    origin: "scheduled",
    version: 1,
    windowEnd,
    ...(windowStart ? { windowStart } : {}),
  } satisfies RepositorySyncJobPayload;
}

function enqueueRepositoryJob(
  repository: typeof repositories.$inferSelect,
  payload: RepositorySyncJobPayload,
  priority: number,
  replaceQueued = false,
  database?: RepositoryDatabase,
) {
  return enqueueJob(
    {
      payload: JSON.stringify(payload),
      priority,
      replaceQueued,
      resourceId: repository.id,
      resourceType: "repository",
      type: REPOSITORY_ANALYTICS_JOB_TYPE,
    },
    database,
  );
}

export function enqueueRepositorySync(
  repositoryId: string,
  origin: RepositorySyncJobPayload["origin"],
  database?: RepositoryDatabase,
) {
  const repository = getRepositoryRecord(repositoryId, database);

  if (!repository) {
    throw new Error("Repository is not registered for synchronization.");
  }

  return enqueueRepositoryJob(
    repository,
    createSyncPayload(repository, origin),
    origin === "manual" ? 100 : 50,
    origin === "manual",
    database,
  );
}

export function enqueueRepositoryBootstrap(
  repositoryId: string,
  database?: RepositoryDatabase,
) {
  const repository = getRepositoryRecord(repositoryId, database);
  const payload = repository
    ? createBootstrapPayload(repository)
    : null;

  return repository && payload
    ? enqueueRepositoryJob(repository, payload, 0, false, database)
    : null;
}

function parseJobPayload(job: Job): RepositorySyncJobPayload {
  let value: unknown;

  try {
    value = JSON.parse(job.payload) as unknown;
  } catch {
    throw new Error("The analytics job payload is invalid.");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The analytics job payload is invalid.");
  }

  const payload = value as Record<string, unknown>;
  const mode = payload.mode;
  const origin = payload.origin;
  const windowEnd = payload.windowEnd;
  const windowStart = payload.windowStart;

  if (mode === "backfill") {
    const legacyWindowEnd = now();
    const legacyWindowStart = getHistoryWindowStart(
      legacyWindowEnd,
      loadAnalyticsSettings().historyWindowDays,
    );

    if (
      (origin !== "manual" && origin !== "scheduled") ||
      typeof windowEnd !== "string" ||
      Number.isNaN(Date.parse(windowEnd))
    ) {
      throw new Error("The analytics job payload is invalid.");
    }

    return {
      mode: "bootstrap",
      origin,
      version: 1,
      windowEnd: legacyWindowEnd,
      ...(legacyWindowStart
        ? { windowStart: legacyWindowStart }
        : {}),
    };
  }

  if (mode === "forward") {
    if (
      (origin !== "manual" && origin !== "scheduled") ||
      typeof windowEnd !== "string" ||
      typeof windowStart !== "string" ||
      Number.isNaN(Date.parse(windowEnd)) ||
      Number.isNaN(Date.parse(windowStart)) ||
      windowStart >= windowEnd
    ) {
      throw new Error("The analytics job payload is invalid.");
    }

    return {
      mode: "incremental",
      origin,
      version: 1,
      windowEnd,
      windowStart,
    };
  }

  if (
    (mode !== "bootstrap" && mode !== "incremental") ||
    (origin !== "manual" &&
      origin !== "scheduled") ||
    typeof windowEnd !== "string" ||
    Number.isNaN(Date.parse(windowEnd)) ||
    payload.version !== 1 ||
    (mode === "bootstrap" &&
      windowStart !== undefined &&
      (typeof windowStart !== "string" ||
        Number.isNaN(Date.parse(windowStart)) ||
        windowStart >= windowEnd)) ||
    (mode === "incremental" &&
      (typeof windowStart !== "string" ||
        Number.isNaN(Date.parse(windowStart)) ||
        windowStart >= windowEnd))
  ) {
    throw new Error("The analytics job payload is invalid.");
  }

  if (mode === "bootstrap") {
    return typeof windowStart === "string"
      ? { mode, origin, version: 1, windowEnd, windowStart }
      : { mode, origin, version: 1, windowEnd };
  }

  if (typeof windowStart !== "string") {
    throw new Error("The analytics job payload is invalid.");
  }

  return { mode, origin, version: 1, windowEnd, windowStart };
}

function getPullRequestKey(repositoryId: string, pullRequestId: number) {
  return and(
    eq(pullRequests.repositoryId, repositoryId),
    eq(pullRequests.pullRequestId, pullRequestId),
  );
}

function getPullRequestMetricKey(
  repositoryId: string,
  pullRequestId: number,
) {
  return and(
    eq(pullRequestMetrics.repositoryId, repositoryId),
    eq(pullRequestMetrics.pullRequestId, pullRequestId),
  );
}

function getPullRequestFileKey(
  repositoryId: string,
  pullRequestId: number,
) {
  return and(
    eq(pullRequestFileMetrics.repositoryId, repositoryId),
    eq(pullRequestFileMetrics.pullRequestId, pullRequestId),
  );
}

function upsertPullRequest(
  repositoryId: string,
  pullRequest: AzureGitPullRequest,
) {
  const closedAt = parseClosedAt(pullRequest.closedDate);

  if (!closedAt) {
    return null;
  }

  const db = getLocalSettingsDb();
  const pullRequestKey = getPullRequestKey(
    repositoryId,
    pullRequest.pullRequestId,
  );
  const metricKey = getPullRequestMetricKey(
    repositoryId,
    pullRequest.pullRequestId,
  );
  const fileKey = getPullRequestFileKey(
    repositoryId,
    pullRequest.pullRequestId,
  );
  const existing =
    db.select().from(pullRequests).where(pullRequestKey).get() ?? null;
  const existingMetrics =
    db.select().from(pullRequestMetrics).where(metricKey).get() ?? null;
  const mergeChanged =
    existing?.mergeCommitId !== pullRequest.lastMergeCommitId;
  const timestamp = now();
  const values: typeof pullRequests.$inferInsert = {
    closedAt,
    creatorDisplayName:
      pullRequest.createdBy?.displayName ?? "Unknown contributor",
    creatorId: pullRequest.createdBy?.id ?? null,
    creatorImageUrl: pullRequest.createdBy?.imageUrl ?? null,
    mergeCommitId: pullRequest.lastMergeCommitId,
    mergeStrategy: pullRequest.mergeStrategy,
    pullRequestId: pullRequest.pullRequestId,
    repositoryId,
    sourceRefName: pullRequest.sourceRefName,
    targetRefName: pullRequest.targetRefName,
    title: pullRequest.title,
    updatedAt: timestamp,
    webUrl: pullRequest.webUrl,
  };

  db.transaction((transaction) => {
    transaction
      .insert(pullRequests)
      .values(values)
      .onConflictDoUpdate({
        set: values,
        target: [
          pullRequests.repositoryId,
          pullRequests.pullRequestId,
        ],
      })
      .run();

    if (mergeChanged) {
      transaction.delete(pullRequestMetrics).where(metricKey).run();
      transaction.delete(pullRequestFileMetrics).where(fileKey).run();
    }
  });

  return {
    needsMeasurement:
      mergeChanged ||
      !existingMetrics ||
      existingMetrics.measurementVersion !==
        ANALYTICS_MEASUREMENT_VERSION,
    pullRequestId: pullRequest.pullRequestId,
  };
}

function summarizeFiles(files: readonly AnalyticsFileMeasurement[]) {
  const measured = files.filter(
    (file) => file.measurementStatus === "measured",
  );
  const incomplete = files.filter(
    (file) =>
      file.measurementStatus === "too_large" ||
      file.measurementStatus === "unavailable",
  );
  const eligibleFileCount = measured.length + incomplete.length;
  const unmeasuredFileCount = incomplete.length;
  const totals = measured.reduce(
    (sum, file) => ({
      additions: sum.additions + file.additions,
      deletions: sum.deletions + file.deletions,
    }),
    { additions: 0, deletions: 0 },
  );

  return {
    ...totals,
    eligibleFileCount,
    measuredFileCount: measured.length,
    measurementStatus:
      unmeasuredFileCount === 0
        ? ("measured" as const)
        : ("partial" as const),
    unmeasuredFileCount,
  };
}

function saveUnsupportedMetrics(
  repositoryId: string,
  pullRequestId: number,
) {
  const fileKey = getPullRequestFileKey(
    repositoryId,
    pullRequestId,
  );
  const measuredAt = now();
  const values: typeof pullRequestMetrics.$inferInsert = {
    additions: 0,
    deletions: 0,
    eligibleFileCount: 0,
    measuredAt,
    measuredFileCount: 0,
    measurementVersion: ANALYTICS_MEASUREMENT_VERSION,
    measurementStatus: "unsupported",
    pullRequestId,
    repositoryId,
    unmeasuredFileCount: 0,
  };

  getLocalSettingsDb().transaction((transaction) => {
    transaction.delete(pullRequestFileMetrics).where(fileKey).run();
    transaction
      .insert(pullRequestMetrics)
      .values(values)
      .onConflictDoUpdate({
        set: values,
        target: [
          pullRequestMetrics.repositoryId,
          pullRequestMetrics.pullRequestId,
        ],
      })
      .run();
  });
}

async function measurePullRequest(
  accessToken: string,
  repository: typeof repositories.$inferSelect,
  pullRequest: typeof pullRequests.$inferSelect,
  signal: AbortSignal,
) {
  if (!pullRequest.mergeCommitId) {
    saveUnsupportedMetrics(
      repository.id,
      pullRequest.pullRequestId,
    );
    return;
  }

  const mergeCommit = await getRepositoryCommit(
    accessToken,
    repository.projectId,
    repository.id,
    pullRequest.mergeCommitId,
    { signal },
  );
  const firstParentId = mergeCommit.parents[0] ?? null;
  let strategy = pullRequest.mergeStrategy?.toLowerCase() ?? null;
  let targetBeforeMergeId: string | null = null;

  if (
    firstParentId &&
    mergeCommit.parents.length === 1 &&
    strategy !== "squash"
  ) {
    const details = await getRepositoryPullRequest(
      accessToken,
      repository.projectId,
      repository.id,
      pullRequest.pullRequestId,
      { signal },
    );

    strategy = details.mergeStrategy?.toLowerCase() ?? null;
    targetBeforeMergeId = details.lastMergeTargetCommitId;
  }

  const supported =
    Boolean(firstParentId) &&
    (mergeCommit.parents.length >= 2 ||
      strategy === "squash" ||
      targetBeforeMergeId === firstParentId);

  if (!firstParentId || !supported) {
    saveUnsupportedMetrics(
      repository.id,
      pullRequest.pullRequestId,
    );
    return;
  }

  const files = await measurePullRequestFiles(
    accessToken,
    repository.projectId,
    repository.id,
    {
      baseCommitId: firstParentId,
      signal,
      targetCommitId: pullRequest.mergeCommitId,
    },
  );
  const measuredAt = now();
  const summary = summarizeFiles(files);
  const fileKey = getPullRequestFileKey(
    repository.id,
    pullRequest.pullRequestId,
  );
  const metricValues: typeof pullRequestMetrics.$inferInsert = {
    ...summary,
    measuredAt,
    measurementVersion: ANALYTICS_MEASUREMENT_VERSION,
    pullRequestId: pullRequest.pullRequestId,
    repositoryId: repository.id,
  };

  getLocalSettingsDb().transaction((transaction) => {
    transaction.delete(pullRequestFileMetrics).where(fileKey).run();

    for (
      let offset = 0;
      offset < files.length;
      offset += FILE_METRIC_INSERT_BATCH_SIZE
    ) {
      transaction
        .insert(pullRequestFileMetrics)
        .values(
          files
            .slice(offset, offset + FILE_METRIC_INSERT_BATCH_SIZE)
            .map((file) => ({
            ...file,
            measuredAt,
            pullRequestId: pullRequest.pullRequestId,
            repositoryId: repository.id,
          })),
        )
        .run();
    }

    transaction
      .insert(pullRequestMetrics)
      .values(metricValues)
      .onConflictDoUpdate({
        set: metricValues,
        target: [
          pullRequestMetrics.repositoryId,
          pullRequestMetrics.pullRequestId,
        ],
      })
      .run();
  });
}

async function processPullRequestSafely(
  accessToken: string,
  repository: typeof repositories.$inferSelect,
  pullRequestId: number,
  signal: AbortSignal,
) {
  const key = getPullRequestKey(repository.id, pullRequestId);
  const pullRequest =
    getLocalSettingsDb()
      .select()
      .from(pullRequests)
      .where(key)
      .get() ?? null;

  if (!pullRequest) {
    return;
  }

  try {
    await measurePullRequest(
      accessToken,
      repository,
      pullRequest,
      signal,
    );
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }

    if (error instanceof TextResponseReadError) {
      throw error;
    }

    if (
      error instanceof AzureDevOpsError &&
      error.code !== "not_found"
    ) {
      throw error;
    }

    reportAzureDevOpsError(error);
    const measuredAt = now();
    const values: typeof pullRequestMetrics.$inferInsert = {
      additions: 0,
      deletions: 0,
      eligibleFileCount: 0,
      measuredAt,
      measuredFileCount: 0,
      measurementVersion: ANALYTICS_MEASUREMENT_VERSION,
      measurementStatus: "failed",
      pullRequestId,
      repositoryId: repository.id,
      unmeasuredFileCount: 0,
    };

    getLocalSettingsDb().transaction((transaction) => {
      transaction.delete(pullRequestFileMetrics).where(
        getPullRequestFileKey(repository.id, pullRequestId),
      ).run();
      transaction
        .insert(pullRequestMetrics)
        .values(values)
        .onConflictDoUpdate({
          set: values,
          target: [
            pullRequestMetrics.repositoryId,
            pullRequestMetrics.pullRequestId,
          ],
        })
        .run();
    });
  }
}

function listStalePullRequestIds(repositoryId: string) {
  return getLocalSettingsDb()
    .select({ pullRequestId: pullRequests.pullRequestId })
    .from(pullRequests)
    .leftJoin(
      pullRequestMetrics,
      and(
        eq(
          pullRequestMetrics.repositoryId,
          pullRequests.repositoryId,
        ),
        eq(
          pullRequestMetrics.pullRequestId,
          pullRequests.pullRequestId,
        ),
      ),
    )
    .where(
      and(
        eq(pullRequests.repositoryId, repositoryId),
        or(
          isNull(pullRequestMetrics.measurementVersion),
          ne(
            pullRequestMetrics.measurementVersion,
            ANALYTICS_MEASUREMENT_VERSION,
          ),
          eq(pullRequestMetrics.measurementStatus, "failed"),
        ),
      ),
    )
    .orderBy(asc(pullRequests.closedAt))
    .all()
    .map((row) => row.pullRequestId);
}

async function loadCompletedPullRequests(
  accessToken: string,
  repository: typeof repositories.$inferSelect,
  payload: RepositorySyncJobPayload,
  signal: AbortSignal,
) {
  const pullRequestIds = new Set<number>();
  const pullRequestIdsToMeasure = new Set<number>();
  let cursor: string | null = null;

  do {
    signal.throwIfAborted();

    const page = await listCompletedRepositoryPullRequests(
      accessToken,
      repository.projectId,
      repository.id,
      {
        cursor,
        maxClosedAt: payload.windowEnd,
        minClosedAt: payload.windowStart ?? null,
        signal,
      },
    );

    for (const pullRequest of page.items) {
      const saved = upsertPullRequest(repository.id, pullRequest);

      if (!saved) {
        continue;
      }

      pullRequestIds.add(saved.pullRequestId);

      if (saved.needsMeasurement) {
        pullRequestIdsToMeasure.add(saved.pullRequestId);
      }
    }

    cursor = page.nextCursor;
  } while (cursor);

  for (const pullRequestId of listStalePullRequestIds(repository.id)) {
    pullRequestIds.add(pullRequestId);
    pullRequestIdsToMeasure.add(pullRequestId);
  }

  return {
    pullRequestIds: [...pullRequestIds],
    pullRequestIdsToMeasure: [...pullRequestIdsToMeasure],
  };
}

function finishRepositorySync(
  repository: typeof repositories.$inferSelect,
  payload: RepositorySyncJobPayload,
) {
  const timestamp = now();

  getLocalSettingsDb()
    .update(repositories)
    .set({
      historySyncCompletedAt:
        payload.mode === "bootstrap"
          ? timestamp
          : repository.historySyncCompletedAt,
      lastPullRequestSyncAt: timestamp,
      nextPullRequestSyncAt: addMilliseconds(
        timestamp,
        getAnalyticsRefreshIntervalHours() * 60 * 60 * 1_000,
      ),
      pullRequestsSyncedThrough: payload.windowEnd,
      pullRequestsSyncedFrom:
        payload.mode === "bootstrap"
          ? (payload.windowStart ?? null)
          : repository.pullRequestsSyncedFrom,
      updatedAt: timestamp,
    })
    .where(eq(repositories.id, repository.id))
    .run();
}

async function processRepositorySyncJob(
  job: Job,
  signal: AbortSignal,
) {
  const repository = getRepositoryRecord(job.resourceId);

  if (!repository || !repository.isTracked || repository.isDisabled) {
    throw new Error("This repository is not available for synchronization.");
  }

  const trackedRepository = repository;
  const parsedPayload = parseJobPayload(job);
  const payload = createSyncPayload(
    trackedRepository,
    parsedPayload.origin,
  );
  const accessToken = await getAzureDevOpsAccessToken();
  const { pullRequestIds, pullRequestIdsToMeasure } =
    await loadCompletedPullRequests(
      accessToken,
      trackedRepository,
      payload,
      signal,
    );
  let processed =
    pullRequestIds.length - pullRequestIdsToMeasure.length;

  updateJobProgress(job.id, job.attemptCount, {
    current: processed,
    total: pullRequestIds.length,
  });

  let nextIndex = 0;
  let failure: unknown = null;

  async function processNextPullRequest() {
    while (
      failure === null &&
      nextIndex < pullRequestIdsToMeasure.length
    ) {
      signal.throwIfAborted();

      const pullRequestId = pullRequestIdsToMeasure[nextIndex];
      nextIndex += 1;

      try {
        await processPullRequestSafely(
          accessToken,
          trackedRepository,
          pullRequestId,
          signal,
        );
        processed += 1;
        updateJobProgress(job.id, job.attemptCount, {
          current: processed,
        });
      } catch (error) {
        failure = error;
      }
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          PULL_REQUEST_MEASUREMENT_CONCURRENCY,
          pullRequestIdsToMeasure.length,
        ),
      },
      () => processNextPullRequest(),
    ),
  );

  if (failure !== null) {
    throw failure;
  }

  signal.throwIfAborted();
  finishRepositorySync(trackedRepository, payload);
}

function getRetryDelay(error: unknown, attemptCount: number) {
  if (error instanceof AzureDevOpsError && error.code === "throttled") {
    return (error.retryAfterSeconds ?? 30) * 1_000;
  }

  return Math.min(60 * 60 * 1_000, 60_000 * 5 ** (attemptCount - 1));
}

function getJobErrorMessage(error: unknown) {
  const descriptor = describeAzureDevOpsError(error);

  if (
    descriptor.kind !== "upstream" ||
    error instanceof AzureDevOpsDataError ||
    error instanceof AzureDevOpsError
  ) {
    return descriptor.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 1_000);
  }

  return descriptor.message;
}

export async function runNextRepositoryAnalyticsJob() {
  const job = claimNextJob(REPOSITORY_ANALYTICS_JOB_TYPE);

  if (!job) {
    return null;
  }

  try {
    await runJobAttempt(job, (signal) =>
      processRepositorySyncJob(job, signal),
    );
    return completeJob(job.id, job.attemptCount);
  } catch (error) {
    reportAzureDevOpsError(error);
    const result = retryOrFailJob(
      job.id,
      job.attemptCount,
      getJobErrorMessage(error),
      getRetryDelay(error, job.attemptCount),
    );

    if (result?.status === "failed") {
      const timestamp = now();

      getLocalSettingsDb()
        .update(repositories)
        .set({
          nextPullRequestSyncAt: addMilliseconds(
            timestamp,
            60 * 60 * 1_000,
          ),
          updatedAt: timestamp,
        })
        .where(eq(repositories.id, job.resourceId))
        .run();
    }

    return result;
  }
}
