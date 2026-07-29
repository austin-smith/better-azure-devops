import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { getLocalSettingsDb } from "@/db";
import { repositories } from "@/db/schema";
import { writeAppSetting } from "@/db/repositories/app-settings";
import { ANALYTICS_ENABLED_KEY } from "@/lib/analytics/settings";
import {
  claimNextJob,
  completeJob,
  enqueueJob,
  getJob,
} from "@/lib/jobs";
import {
  requestRepositoryCatalogRefresh,
  runAnalyticsSchedulerTick,
} from "@/lib/analytics/scheduler";
import {
  enqueueRepositoryBootstrap,
  enqueueRepositorySync,
  runNextRepositoryAnalyticsJob,
  saveRepository,
} from "@/lib/analytics/refresh";

vi.mock("server-only", () => ({}));
const {
  getAzureDevOpsAccessTokenMock,
  hasAzureDevOpsConfigMock,
  listRepositoriesMock,
  loadAzureDevOpsProjectSelectionMock,
} = vi.hoisted(() => ({
  getAzureDevOpsAccessTokenMock: vi.fn(),
  hasAzureDevOpsConfigMock: vi.fn(() => true),
  listRepositoriesMock: vi.fn(),
  loadAzureDevOpsProjectSelectionMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/config", () => ({
  hasAzureDevOpsConfig: hasAzureDevOpsConfigMock,
}));
vi.mock("@/lib/azure-devops/access-token", () => ({
  getAzureDevOpsAccessToken: getAzureDevOpsAccessTokenMock,
}));
vi.mock("@/lib/azure-devops/git/repositories", () => ({
  listRepositories: listRepositoriesMock,
}));
vi.mock("@/lib/azure-devops/project-selection", () => ({
  loadAzureDevOpsProjectSelection:
    loadAzureDevOpsProjectSelectionMock,
}));
vi.mock("@/lib/analytics/refresh", () => ({
  enqueueRepositoryBootstrap: vi.fn(),
  enqueueRepositorySync: vi.fn(),
  needsRepositoryBootstrap: vi.fn(
    (repository: { historySyncCompletedAt: string | null }) =>
      repository.historySyncCompletedAt === null,
  ),
  REPOSITORY_ANALYTICS_JOB_TYPE:
    "sync_repository_pull_requests",
  runNextRepositoryAnalyticsJob: vi.fn(
    () => new Promise<never>(() => {}),
  ),
  saveRepository: vi.fn(),
}));

function createDeferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });

  return { promise, reject, resolve };
}

describe("analytics scheduler", () => {
  beforeEach(() => {
    process.env.LOCAL_SETTINGS_DATABASE_PATH =
      path.join(
        tmpdir(),
        `better-ado-scheduler-${randomUUID()}.sqlite`,
      );
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
    vi.clearAllMocks();
    hasAzureDevOpsConfigMock.mockReturnValue(true);
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    loadAzureDevOpsProjectSelectionMock.mockResolvedValue({
      selectedProjects: [],
    });
    listRepositoriesMock.mockResolvedValue([]);

    writeAppSetting(ANALYTICS_ENABLED_KEY, "true");

    writeAppSetting(
      "analytics.repository-catalog-refreshed-at.v1",
      "2026-07-26T12:00:00.000Z",
    );
    writeAppSetting(
      "analytics.repository-catalog-retry-at.v1",
      "1970-01-01T00:00:00.000Z",
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("recovers expired work without waiting for the worker", async () => {
    const queued = enqueueJob({
      payload: "{}",
      resourceId: "repo-1",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });

    claimNextJob(queued.type);
    vi.advanceTimersByTime(2 * 60 * 1_000 + 1);

    await runAnalyticsSchedulerTick();

    expect(getJob(queued.id)?.status).toBe("queued");
    expect(runNextRepositoryAnalyticsJob).not.toHaveBeenCalled();
  });

  it("does not discover or schedule repositories while analytics is disabled", async () => {
    writeAppSetting(ANALYTICS_ENABLED_KEY, "false");

    await runAnalyticsSchedulerTick();

    expect(getAzureDevOpsAccessTokenMock).not.toHaveBeenCalled();
    expect(loadAzureDevOpsProjectSelectionMock).not.toHaveBeenCalled();
    expect(listRepositoriesMock).not.toHaveBeenCalled();
    expect(enqueueRepositoryBootstrap).not.toHaveBeenCalled();
    expect(enqueueRepositorySync).not.toHaveBeenCalled();
  });

  it("schedules one full-history bootstrap for a new repository", async () => {
    getLocalSettingsDb()
      .insert(repositories)
      .values({
        id: "repo-1",
        name: "Repository",
        organizationUrl: "https://dev.azure.com/example",
        projectId: "project-1",
        projectName: "Project",
        nextPullRequestSyncAt: "2026-07-26T12:00:00.000Z",
      })
      .run();

    await runAnalyticsSchedulerTick();

    expect(enqueueRepositoryBootstrap).toHaveBeenCalledOnce();
    expect(enqueueRepositoryBootstrap).toHaveBeenCalledWith(
      "repo-1",
      expect.anything(),
    );
    expect(enqueueRepositorySync).not.toHaveBeenCalled();
  });

  it("schedules incremental work only after history is complete", async () => {
    getLocalSettingsDb()
      .insert(repositories)
      .values({
        historySyncCompletedAt: "2026-07-26T10:00:00.000Z",
        id: "repo-1",
        name: "Repository",
        organizationUrl: "https://dev.azure.com/example",
        projectId: "project-1",
        projectName: "Project",
        nextPullRequestSyncAt: "2026-07-26T12:00:00.000Z",
        pullRequestsSyncedThrough: "2026-07-26T10:00:00.000Z",
      })
      .run();

    await runAnalyticsSchedulerTick();

    expect(enqueueRepositorySync).toHaveBeenCalledOnce();
    expect(enqueueRepositorySync).toHaveBeenCalledWith(
      "repo-1",
      "scheduled",
      expect.anything(),
    );
    expect(enqueueRepositoryBootstrap).not.toHaveBeenCalled();
  });

  it("does not let a delayed bootstrap block another repository", async () => {
    getLocalSettingsDb()
      .insert(repositories)
      .values([
        {
          id: "repo-delayed",
          name: "Delayed",
          organizationUrl: "https://dev.azure.com/example",
          projectId: "project-1",
          projectName: "Project",
          nextPullRequestSyncAt: "2026-07-26T12:00:00.000Z",
          updatedAt: "2026-07-26T10:00:00.000Z",
        },
        {
          id: "repo-ready",
          name: "Ready",
          organizationUrl: "https://dev.azure.com/example",
          projectId: "project-1",
          projectName: "Project",
          nextPullRequestSyncAt: "2026-07-26T12:00:00.000Z",
          updatedAt: "2026-07-26T11:00:00.000Z",
        },
      ])
      .run();
    enqueueJob({
      payload: "{}",
      resourceId: "repo-delayed",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });

    await runAnalyticsSchedulerTick();

    expect(enqueueRepositoryBootstrap).toHaveBeenCalledOnce();
    expect(enqueueRepositoryBootstrap).toHaveBeenCalledWith(
      "repo-ready",
      expect.anything(),
    );
  });

  it("maintains local jobs without Azure DevOps configuration", async () => {
    const expired = enqueueJob({
      payload: "{}",
      resourceId: "repo-running",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });
    const historical = enqueueJob({
      payload: "{}",
      resourceId: "repo-completed",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });
    const runningExpired = claimNextJob(expired.type)!;
    const runningHistorical = claimNextJob(historical.type)!;

    completeJob(
      historical.id,
      runningHistorical.attemptCount,
    );
    vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1_000);
    hasAzureDevOpsConfigMock.mockReturnValue(false);

    await runAnalyticsSchedulerTick();

    expect(getJob(expired.id)).toMatchObject({
      attemptCount: runningExpired.attemptCount,
      status: "queued",
    });
    expect(getJob(historical.id)).toBeNull();
    expect(enqueueRepositoryBootstrap).not.toHaveBeenCalled();
    expect(enqueueRepositorySync).not.toHaveBeenCalled();
  });

  it("does not schedule from stale tracking data after catalog refresh fails", async () => {
    getLocalSettingsDb()
      .insert(repositories)
      .values({
        id: "repo-stale",
        name: "Stale",
        organizationUrl: "https://dev.azure.com/example",
        projectId: "project-old",
        projectName: "Old project",
        nextPullRequestSyncAt: "2026-07-26T12:00:00.000Z",
      })
      .run();
    writeAppSetting(
      "analytics.repository-catalog-refreshed-at.v1",
      "1970-01-01T00:00:00.000Z",
    );
    loadAzureDevOpsProjectSelectionMock.mockResolvedValueOnce({
      selectedProjects: [{ id: "project-current" }],
    });
    listRepositoriesMock.mockRejectedValueOnce(
      new Error("Catalog unavailable"),
    );

    await runAnalyticsSchedulerTick();

    expect(enqueueRepositoryBootstrap).not.toHaveBeenCalled();
    expect(enqueueRepositorySync).not.toHaveBeenCalled();
  });

  it("does not schedule from a stale catalog while a selection refresh is deferred", async () => {
    getLocalSettingsDb()
      .insert(repositories)
      .values({
        id: "repo-stale",
        name: "Stale",
        organizationUrl: "https://dev.azure.com/example",
        projectId: "project-old",
        projectName: "Old project",
        nextPullRequestSyncAt: "2026-07-26T12:00:00.000Z",
      })
      .run();
    loadAzureDevOpsProjectSelectionMock.mockResolvedValueOnce({
      selectedProjects: [{ id: "project-current" }],
    });
    listRepositoriesMock.mockRejectedValueOnce(
      new Error("Catalog unavailable"),
    );

    requestRepositoryCatalogRefresh();
    await runAnalyticsSchedulerTick();
    await runAnalyticsSchedulerTick();

    expect(loadAzureDevOpsProjectSelectionMock).toHaveBeenCalledOnce();
    expect(enqueueRepositoryBootstrap).not.toHaveBeenCalled();
    expect(enqueueRepositorySync).not.toHaveBeenCalled();
  });

  it("discards an in-flight catalog refresh after the selection changes", async () => {
    const staleRepository = { id: "repo-stale" };
    const currentRepository = { id: "repo-current" };
    const requestStarted = createDeferred<void>();
    const staleRepositories = createDeferred<unknown[]>();

    loadAzureDevOpsProjectSelectionMock
      .mockResolvedValueOnce({
        selectedProjects: [{ id: "project-stale" }],
      })
      .mockResolvedValueOnce({
        selectedProjects: [{ id: "project-current" }],
      });
    listRepositoriesMock
      .mockImplementationOnce(() => {
        requestStarted.resolve();
        return staleRepositories.promise;
      })
      .mockResolvedValueOnce([currentRepository]);

    requestRepositoryCatalogRefresh();
    const staleRefresh = runAnalyticsSchedulerTick();

    await requestStarted.promise;
    requestRepositoryCatalogRefresh();
    staleRepositories.resolve([staleRepository]);
    await staleRefresh;

    expect(saveRepository).not.toHaveBeenCalled();
    expect(enqueueRepositoryBootstrap).not.toHaveBeenCalled();
    expect(enqueueRepositorySync).not.toHaveBeenCalled();

    await runAnalyticsSchedulerTick();

    expect(saveRepository).toHaveBeenCalledOnce();
    expect(saveRepository).toHaveBeenCalledWith(
      currentRepository,
      expect.anything(),
    );
  });

  it("does not let a stale failure defer a newer catalog request", async () => {
    const currentRepository = { id: "repo-current" };
    const requestStarted = createDeferred<void>();
    const staleRepositories = createDeferred<unknown[]>();

    loadAzureDevOpsProjectSelectionMock
      .mockResolvedValueOnce({
        selectedProjects: [{ id: "project-stale" }],
      })
      .mockResolvedValueOnce({
        selectedProjects: [{ id: "project-current" }],
      });
    listRepositoriesMock
      .mockImplementationOnce(() => {
        requestStarted.resolve();
        return staleRepositories.promise;
      })
      .mockResolvedValueOnce([currentRepository]);

    requestRepositoryCatalogRefresh();
    const staleRefresh = runAnalyticsSchedulerTick();

    await requestStarted.promise;
    requestRepositoryCatalogRefresh();
    staleRepositories.reject(new Error("Stale catalog failed"));
    await staleRefresh;
    await runAnalyticsSchedulerTick();

    expect(saveRepository).toHaveBeenCalledOnce();
    expect(saveRepository).toHaveBeenCalledWith(
      currentRepository,
      expect.anything(),
    );
  });
});
