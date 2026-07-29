import "server-only";
import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  lte,
} from "drizzle-orm";
import { getLocalSettingsDb } from "@/db";
import { appSettings, jobs, repositories } from "@/db/schema";
import {
  readAppSetting,
  writeAppSettings,
} from "@/db/repositories/app-settings";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import {
  hasAzureDevOpsConfig,
} from "@/lib/azure-devops/config";
import { AzureDevOpsError } from "@/lib/azure-devops/errors";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import { listRepositories } from "@/lib/azure-devops/git/repositories";
import { reportAzureDevOpsError } from "@/lib/azure-devops/report-error";
import {
  enqueueRepositoryBootstrap,
  enqueueRepositorySync,
  needsRepositoryBootstrap,
  REPOSITORY_ANALYTICS_JOB_TYPE,
  runNextRepositoryAnalyticsJob,
  saveRepository,
} from "@/lib/analytics/refresh";
import { loadAnalyticsSettings } from "@/lib/analytics/settings";
import {
  deleteExpiredJobHistory,
  recoverExpiredJobs,
} from "@/lib/jobs";

const CATALOG_REFRESHED_AT_KEY =
  "analytics.repository-catalog-refreshed-at.v1";
const CATALOG_REFRESH_REQUEST_ID_KEY =
  "analytics.repository-catalog-refresh-request-id.v1";
const CATALOG_REFRESHED_REQUEST_ID_KEY =
  "analytics.repository-catalog-refreshed-request-id.v1";
const CATALOG_RETRY_AT_KEY =
  "analytics.repository-catalog-retry-at.v1";
const CATALOG_EPOCH = "1970-01-01T00:00:00.000Z";
const CATALOG_REFRESH_MILLISECONDS = 6 * 60 * 60 * 1_000;
const SCHEDULER_TICK_MILLISECONDS = 15_000;
const WORKER_IDLE_MILLISECONDS = 1_000;

type SchedulerState = {
  started: true;
};

type LocalSettingsTransaction = Parameters<
  Parameters<
    ReturnType<typeof getLocalSettingsDb>["transaction"]
  >[0]
>[0];

const schedulerStateKey = Symbol.for("better-ado.analytics-scheduler");
const globalScheduler = globalThis as typeof globalThis & {
  [schedulerStateKey]?: SchedulerState;
};

function now() {
  return new Date().toISOString();
}

function getCatalogRefreshState() {
  const requestId = readAppSetting(
    CATALOG_REFRESH_REQUEST_ID_KEY,
  );
  const refreshedRequestId = readAppSetting(
    CATALOG_REFRESHED_REQUEST_ID_KEY,
  );
  const hasPendingRequest = requestId !== refreshedRequestId;
  const retryAt = readAppSetting(CATALOG_RETRY_AT_KEY);
  const retryTimestamp = retryAt ? Date.parse(retryAt) : Number.NaN;
  const retryDeferred =
    !Number.isNaN(retryTimestamp) && retryTimestamp > Date.now();
  const refreshedAt = readAppSetting(CATALOG_REFRESHED_AT_KEY);
  const timestamp = refreshedAt ? Date.parse(refreshedAt) : Number.NaN;
  const intervalElapsed =
    Number.isNaN(timestamp) ||
    timestamp <= Date.now() - CATALOG_REFRESH_MILLISECONDS;

  return {
    canSchedule: !hasPendingRequest,
    requestId,
    shouldRefresh:
      !retryDeferred && (hasPendingRequest || intervalElapsed),
  };
}

export function requestRepositoryCatalogRefresh() {
  writeAppSettings([
    {
      key: CATALOG_REFRESH_REQUEST_ID_KEY,
      value: randomUUID(),
    },
    {
      key: CATALOG_RETRY_AT_KEY,
      value: CATALOG_EPOCH,
    },
  ]);
}

async function refreshRepositoryCatalog(requestId: string | null) {
  const accessToken = await getAzureDevOpsAccessToken();
  const selection =
    await loadAzureDevOpsProjectSelection(accessToken);
  const repositoryGroups = await Promise.all(
    selection.selectedProjects.map((project) =>
      listRepositories(accessToken, project.id),
    ),
  );
  const timestamp = now();
  const db = getLocalSettingsDb();

  return db.transaction((transaction) => {
    const currentRequestId =
      transaction.query.appSettings
        .findFirst({
          columns: {
            value: true,
          },
          where: eq(
            appSettings.key,
            CATALOG_REFRESH_REQUEST_ID_KEY,
          ),
        })
        .sync()?.value ?? null;

    if (currentRequestId !== requestId) {
      return false;
    }

    transaction
      .update(repositories)
      .set({ isTracked: false, updatedAt: timestamp })
      .run();

    for (const repository of repositoryGroups.flat()) {
      saveRepository(repository, transaction);
    }

    const settings = [
      {
        key: CATALOG_REFRESHED_AT_KEY,
        value: timestamp,
      },
      {
        key: CATALOG_RETRY_AT_KEY,
        value: CATALOG_EPOCH,
      },
      ...(requestId
        ? [
            {
              key: CATALOG_REFRESHED_REQUEST_ID_KEY,
              value: requestId,
            },
          ]
        : []),
    ];

    for (const setting of settings) {
      transaction
        .insert(appSettings)
        .values({
          ...setting,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          set: {
            updatedAt: timestamp,
            value: setting.value,
          },
          target: appSettings.key,
        })
        .run();
    }

    return true;
  });
}

function deferRepositoryCatalogRefresh(
  error: unknown,
  requestId: string | null,
) {
  const delayMilliseconds =
    error instanceof AzureDevOpsError && error.code === "throttled"
      ? (error.retryAfterSeconds ?? 30) * 1_000
      : 5 * 60 * 1_000;
  const timestamp = now();
  const retryAt = new Date(
    Date.now() + delayMilliseconds,
  ).toISOString();

  getLocalSettingsDb().transaction((transaction) => {
    const currentRequestId =
      transaction.query.appSettings
        .findFirst({
          columns: {
            value: true,
          },
          where: eq(
            appSettings.key,
            CATALOG_REFRESH_REQUEST_ID_KEY,
          ),
        })
        .sync()?.value ?? null;

    if (currentRequestId !== requestId) {
      return;
    }

    transaction
      .insert(appSettings)
      .values({
        key: CATALOG_RETRY_AT_KEY,
        updatedAt: timestamp,
        value: retryAt,
      })
      .onConflictDoUpdate({
        set: {
          updatedAt: timestamp,
          value: retryAt,
        },
        target: appSettings.key,
      })
      .run();
  });
}

function enqueueDueIncrementalSyncs(
  database: LocalSettingsTransaction,
) {
  const timestamp = now();
  const { historyWindowDays } = loadAnalyticsSettings();
  const dueRepositories = database
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.isTracked, true),
        eq(repositories.isDisabled, false),
        isNotNull(repositories.historySyncCompletedAt),
        lte(repositories.nextPullRequestSyncAt, timestamp),
      ),
    )
    .orderBy(asc(repositories.nextPullRequestSyncAt))
    .all();

  for (const repository of dueRepositories) {
    if (
      needsRepositoryBootstrap(
        repository,
        historyWindowDays,
        timestamp,
      )
    ) {
      continue;
    }

    enqueueRepositorySync(repository.id, "scheduled", database);
  }
}

function enqueueNextBootstrap(database: LocalSettingsTransaction) {
  const timestamp = now();
  const { historyWindowDays } = loadAnalyticsSettings();
  const activeRepositoryIds = new Set(
    database
      .select({ resourceId: jobs.resourceId })
      .from(jobs)
      .where(
        and(
          eq(jobs.resourceType, "repository"),
          eq(jobs.type, REPOSITORY_ANALYTICS_JOB_TYPE),
          inArray(jobs.status, ["queued", "running"]),
        ),
      )
      .all()
      .map((job) => job.resourceId),
  );
  const dueRepositories = database
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.isTracked, true),
        eq(repositories.isDisabled, false),
        lte(repositories.nextPullRequestSyncAt, timestamp),
      ),
    )
    .orderBy(asc(repositories.updatedAt))
    .all();
  const repository = dueRepositories.find(
    (candidate) =>
      !activeRepositoryIds.has(candidate.id) &&
      needsRepositoryBootstrap(
        candidate,
        historyWindowDays,
        timestamp,
      ),
  );

  if (repository) {
    enqueueRepositoryBootstrap(repository.id, database);
  }
}

function scheduleRepositoryJobs(requestId: string | null) {
  return getLocalSettingsDb().transaction((transaction) => {
    const requestState = new Map(
      transaction
        .select({
          key: appSettings.key,
          value: appSettings.value,
        })
        .from(appSettings)
        .where(
          inArray(appSettings.key, [
            CATALOG_REFRESH_REQUEST_ID_KEY,
            CATALOG_REFRESHED_REQUEST_ID_KEY,
          ]),
        )
        .all()
        .map((setting) => [setting.key, setting.value]),
    );
    const currentRequestId =
      requestState.get(CATALOG_REFRESH_REQUEST_ID_KEY) ?? null;
    const refreshedRequestId =
      requestState.get(CATALOG_REFRESHED_REQUEST_ID_KEY) ?? null;

    if (
      currentRequestId !== requestId ||
      currentRequestId !== refreshedRequestId
    ) {
      return false;
    }

    enqueueDueIncrementalSyncs(transaction);
    enqueueNextBootstrap(transaction);

    return true;
  });
}

export async function runAnalyticsSchedulerTick() {
  recoverExpiredJobs();
  deleteExpiredJobHistory();

  if (!hasAzureDevOpsConfig()) {
    return;
  }

  const catalog = getCatalogRefreshState();

  if (catalog.shouldRefresh) {
    try {
      const refreshed = await refreshRepositoryCatalog(
        catalog.requestId,
      );

      if (!refreshed) {
        return;
      }
    } catch (error) {
      deferRepositoryCatalogRefresh(error, catalog.requestId);
      reportAzureDevOpsError(error);
      return;
    }
  } else if (!catalog.canSchedule) {
    return;
  }

  scheduleRepositoryJobs(catalog.requestId);
}

async function runAnalyticsWorkerTick() {
  return runNextRepositoryAnalyticsJob();
}

function scheduleNextSchedulerTick() {
  const timer = setTimeout(async () => {
    try {
      await runAnalyticsSchedulerTick();
    } catch (error) {
      reportAzureDevOpsError(error);
    } finally {
      scheduleNextSchedulerTick();
    }
  }, SCHEDULER_TICK_MILLISECONDS);
  timer.unref();
}

function scheduleNextWorkerTick(delayMilliseconds: number) {
  const timer = setTimeout(async () => {
    let worked = false;

    try {
      worked = (await runAnalyticsWorkerTick()) !== null;
    } catch (error) {
      reportAzureDevOpsError(error);
    } finally {
      scheduleNextWorkerTick(
        worked ? 0 : WORKER_IDLE_MILLISECONDS,
      );
    }
  }, delayMilliseconds);
  timer.unref();
}

export function startAnalyticsScheduler() {
  if (globalScheduler[schedulerStateKey]) {
    return;
  }

  const state: SchedulerState = {
    started: true,
  };

  globalScheduler[schedulerStateKey] = state;

  void runAnalyticsSchedulerTick()
    .catch(reportAzureDevOpsError)
    .finally(() => {
      scheduleNextSchedulerTick();
    });
  scheduleNextWorkerTick(0);
}
