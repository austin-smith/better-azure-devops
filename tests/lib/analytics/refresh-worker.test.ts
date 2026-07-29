import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { getLocalSettingsDb } from "@/db";
import { writeAppSetting } from "@/db/repositories/app-settings";
import {
  pullRequestFileMetrics,
  pullRequestMetrics,
  pullRequests,
  repositories,
} from "@/db/schema";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { AzureDevOpsError } from "@/lib/azure-devops/errors";
import { getRepositoryCommit } from "@/lib/azure-devops/git/commits";
import {
  getRepositoryPullRequest,
  listCompletedRepositoryPullRequests,
} from "@/lib/azure-devops/git/pull-requests";
import type { AzureGitPullRequest } from "@/lib/azure-devops/git/types";
import { measurePullRequestFiles } from "@/lib/analytics/measure";
import {
  enqueueRepositorySync,
  runNextRepositoryAnalyticsJob,
} from "@/lib/analytics/refresh";
import { ANALYTICS_MEASUREMENT_VERSION } from "@/lib/analytics/measurement-version";
import {
  ANALYTICS_ENABLED_KEY,
  ANALYTICS_HISTORY_WINDOW_DAYS_KEY,
} from "@/lib/analytics/settings";
import { TextResponseReadError } from "@/lib/azure-devops/text-response";
import {
  claimNextJob,
  getJob,
  retryOrFailJob,
} from "@/lib/jobs";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/azure-devops/access-token", () => ({
  getAzureDevOpsAccessToken: vi.fn(),
}));
vi.mock("@/lib/azure-devops/git/commits", () => ({
  getRepositoryCommit: vi.fn(),
}));
vi.mock("@/lib/azure-devops/git/pull-requests", () => ({
  getRepositoryPullRequest: vi.fn(),
  listCompletedRepositoryPullRequests: vi.fn(),
}));
vi.mock("@/lib/analytics/measure", () => ({
  measurePullRequestFiles: vi.fn(),
}));
vi.mock("@/lib/azure-devops/report-error", () => ({
  reportAzureDevOpsError: vi.fn(),
}));

const pullRequest: AzureGitPullRequest = {
  artifactId: null,
  closedDate: "2026-07-25T12:00:00.000Z",
  commits: [],
  createdBy: {
    displayName: "Contributor",
    id: "identity-1",
    imageUrl: null,
    isContainer: false,
  },
  creationDate: "2026-07-24T12:00:00.000Z",
  description: null,
  isDraft: false,
  labels: [],
  lastMergeCommitId: "merge-commit",
  lastMergeSourceCommitId: null,
  lastMergeTargetCommitId: null,
  mergeStrategy: "squash",
  mergeStatus: "succeeded",
  pullRequestId: 42,
  repository: {
    id: "repo-1",
    name: "Repository",
    projectId: "project-1",
    projectName: "Project",
  },
  reviewers: [],
  sourceRefName: "refs/heads/topic",
  sourceRepository: null,
  status: "completed",
  supportsIterations: true,
  targetRefName: "refs/heads/main",
  title: "Measured change",
  webUrl: null,
  workItemIds: [],
};

describe("repository analytics worker", () => {
  beforeEach(() => {
    process.env.LOCAL_SETTINGS_DATABASE_PATH =
      path.join(
        tmpdir(),
        `better-ado-worker-${randomUUID()}.sqlite`,
      );
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
    vi.clearAllMocks();
    writeAppSetting(ANALYTICS_ENABLED_KEY, "true");

    getLocalSettingsDb()
      .insert(repositories)
      .values({
        id: "repo-1",
        name: "Repository",
        organizationUrl: "https://dev.azure.com/example",
        projectId: "project-1",
        projectName: "Project",
      })
      .run();

    vi.mocked(getAzureDevOpsAccessToken).mockResolvedValue("token");
    vi.mocked(listCompletedRepositoryPullRequests).mockResolvedValue({
      items: [pullRequest],
      nextCursor: null,
    });
    vi.mocked(getRepositoryPullRequest).mockResolvedValue(pullRequest);
    vi.mocked(getRepositoryCommit).mockResolvedValue({
      author: {
        date: null,
        email: null,
        imageUrl: null,
        name: null,
      },
      changeCounts: {},
      comment: "",
      commitId: "merge-commit",
      committer: {
        date: null,
        email: null,
        imageUrl: null,
        name: null,
      },
      parents: ["first-parent"],
      push: null,
      remoteUrl: null,
      tooManyChanges: false,
      url: null,
    });
    vi.mocked(measurePullRequestFiles).mockResolvedValue([
      {
        additions: 3,
        changeType: "edit",
        deletions: 1,
        measurementStatus: "measured",
        originalPath: null,
        path: "/src/app.ts",
      },
      {
        additions: 0,
        changeType: "add",
        deletions: 0,
        measurementStatus: "binary",
        originalPath: null,
        path: "/assets/logo.png",
      },
      {
        additions: 0,
        changeType: "edit",
        deletions: 0,
        measurementStatus: "lfs",
        originalPath: null,
        path: "/assets/video.mp4",
      },
      {
        additions: 0,
        changeType: "edit",
        deletions: 0,
        measurementStatus: "submodule",
        originalPath: null,
        path: "/vendor/module",
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores pull requests and metrics using table-specific predicates", async () => {
    const queued = enqueueRepositorySync("repo-1", "manual");
    const completed = await runNextRepositoryAnalyticsJob();

    expect(completed).toMatchObject({
      id: queued.id,
      progressCurrent: 1,
      progressTotal: 1,
      status: "completed",
    });
    expect(listCompletedRepositoryPullRequests).toHaveBeenCalledWith(
      "token",
      "project-1",
      "repo-1",
      expect.objectContaining({
        maxClosedAt: "2026-07-26T12:00:00.000Z",
        minClosedAt: null,
      }),
    );
    expect(getLocalSettingsDb().select().from(pullRequests).all()).toHaveLength(
      1,
    );
    expect(
      getLocalSettingsDb().select().from(pullRequestMetrics).all(),
    ).toEqual([
      expect.objectContaining({
        additions: 3,
        deletions: 1,
        eligibleFileCount: 1,
        measuredFileCount: 1,
        measurementStatus: "measured",
        measurementVersion: ANALYTICS_MEASUREMENT_VERSION,
        unmeasuredFileCount: 0,
      }),
    ]);
    expect(
      getLocalSettingsDb().select().from(pullRequestFileMetrics).all(),
    ).toHaveLength(4);
    expect(
      getLocalSettingsDb().query.repositories.findFirst().sync(),
    ).toMatchObject({
      historySyncCompletedAt: "2026-07-26T12:00:00.000Z",
      pullRequestsSyncedThrough: "2026-07-26T12:00:00.000Z",
    });
  });

  it("leaves queued work untouched while analytics is disabled", async () => {
    const queued = enqueueRepositorySync("repo-1", "manual");
    writeAppSetting(ANALYTICS_ENABLED_KEY, "false");

    await expect(runNextRepositoryAnalyticsJob()).resolves.toBeNull();
    expect(getJob(queued.id)).toMatchObject({ status: "queued" });
    expect(getAzureDevOpsAccessToken).not.toHaveBeenCalled();
  });

  it("recomputes a queued bootstrap from the current history setting", async () => {
    enqueueRepositorySync("repo-1", "manual");
    writeAppSetting(
      ANALYTICS_HISTORY_WINDOW_DAYS_KEY,
      "30",
    );

    await runNextRepositoryAnalyticsJob();

    expect(listCompletedRepositoryPullRequests).toHaveBeenCalledWith(
      "token",
      "project-1",
      "repo-1",
      expect.objectContaining({
        maxClosedAt: "2026-07-26T12:00:00.000Z",
        minClosedAt: "2026-06-26T12:00:00.000Z",
      }),
    );
  });

  it("marks a pull request incomplete only for unavailable text content", async () => {
    vi.mocked(measurePullRequestFiles).mockResolvedValueOnce([
      {
        additions: 3,
        changeType: "edit",
        deletions: 1,
        measurementStatus: "measured",
        originalPath: null,
        path: "/src/app.ts",
      },
      {
        additions: 0,
        changeType: "edit",
        deletions: 0,
        measurementStatus: "unavailable",
        originalPath: null,
        path: "/src/missing.ts",
      },
    ]);

    enqueueRepositorySync("repo-1", "manual");
    await runNextRepositoryAnalyticsJob();

    expect(
      getLocalSettingsDb().select().from(pullRequestMetrics).get(),
    ).toMatchObject({
      additions: 3,
      deletions: 1,
      eligibleFileCount: 2,
      measuredFileCount: 1,
      measurementStatus: "partial",
      measurementVersion: ANALYTICS_MEASUREMENT_VERSION,
      unmeasuredFileCount: 1,
    });
  });

  it("keeps deterministic oversized-only measurements terminal", async () => {
    vi.mocked(measurePullRequestFiles).mockResolvedValueOnce([
      {
        additions: 0,
        changeType: "add",
        deletions: 0,
        measurementStatus: "too_large",
        originalPath: null,
        path: "/generated/large.txt",
      },
    ]);

    enqueueRepositorySync("repo-1", "manual");
    await runNextRepositoryAnalyticsJob();

    expect(
      getLocalSettingsDb().select().from(pullRequestMetrics).get(),
    ).toMatchObject({
      eligibleFileCount: 1,
      measuredFileCount: 0,
      measurementStatus: "partial",
      unmeasuredFileCount: 1,
    });

    vi.mocked(listCompletedRepositoryPullRequests).mockResolvedValueOnce({
      items: [],
      nextCursor: null,
    });
    enqueueRepositorySync("repo-1", "manual");
    await runNextRepositoryAnalyticsJob();

    expect(measurePullRequestFiles).toHaveBeenCalledOnce();
  });

  it("remeasures stored pull requests created by an older algorithm", async () => {
    vi.mocked(listCompletedRepositoryPullRequests).mockResolvedValueOnce({
      items: [],
      nextCursor: null,
    });
    getLocalSettingsDb()
      .insert(pullRequests)
      .values({
        closedAt: "2026-07-25T12:00:00.000Z",
        creatorDisplayName: "Contributor",
        creatorId: "identity-1",
        mergeCommitId: pullRequest.lastMergeCommitId,
        mergeStrategy: pullRequest.mergeStrategy,
        pullRequestId: pullRequest.pullRequestId,
        repositoryId: "repo-1",
        sourceRefName: pullRequest.sourceRefName,
        targetRefName: pullRequest.targetRefName,
        title: pullRequest.title,
      })
      .run();
    getLocalSettingsDb()
      .insert(pullRequestMetrics)
      .values({
        measuredAt: "2026-07-25T12:00:00.000Z",
        measurementStatus: "partial",
        measurementVersion: 0,
        pullRequestId: pullRequest.pullRequestId,
        repositoryId: "repo-1",
      })
      .run();

    const queued = enqueueRepositorySync("repo-1", "manual");
    const completed = await runNextRepositoryAnalyticsJob();

    expect(completed).toMatchObject({
      id: queued.id,
      progressCurrent: 1,
      progressTotal: 1,
      status: "completed",
    });
    expect(measurePullRequestFiles).toHaveBeenCalledOnce();
    expect(
      getLocalSettingsDb().select().from(pullRequestMetrics).get(),
    ).toMatchObject({
      measurementStatus: "measured",
      measurementVersion: ANALYTICS_MEASUREMENT_VERSION,
    });
  });

  it("preserves delayed retries when the scheduler sees the repository again", () => {
    const queued = enqueueRepositorySync("repo-1", "scheduled");
    const running = claimNextJob(queued.type);

    retryOrFailJob(
      queued.id,
      running!.attemptCount,
      "temporary",
      60_000,
    );
    enqueueRepositorySync("repo-1", "scheduled");

    expect(getJob(queued.id)).toMatchObject({
      availableAt: "2026-07-26T12:01:00.000Z",
      attemptCount: 1,
      status: "queued",
    });
  });

  it("stores a safe message when Azure DevOps returns private details", async () => {
    vi.mocked(
      listCompletedRepositoryPullRequests,
    ).mockRejectedValueOnce(
      new AzureDevOpsError(
        "Azure DevOps request failed (500): private upstream response",
        {
          code: "server",
          status: 500,
        },
      ),
    );

    const queued = enqueueRepositorySync("repo-1", "manual");
    await runNextRepositoryAnalyticsJob();

    expect(getJob(queued.id)).toMatchObject({
      errorMessage: "Azure DevOps could not complete the request.",
      status: "queued",
    });
  });

  it("stores file metrics in bounded batches for very large pull requests", async () => {
    const files = Array.from({ length: 2_000 }, (_, index) => ({
      additions: 1,
      changeType: "add",
      deletions: 0,
      measurementStatus: "measured" as const,
      originalPath: null,
      path: `/src/file-${index}.ts`,
    }));
    vi.mocked(measurePullRequestFiles).mockResolvedValueOnce(files);

    enqueueRepositorySync("repo-1", "manual");
    await runNextRepositoryAnalyticsJob();

    expect(
      getLocalSettingsDb()
        .select()
        .from(pullRequestFileMetrics)
        .all(),
    ).toHaveLength(files.length);
    expect(
      getLocalSettingsDb().select().from(pullRequestMetrics).get(),
    ).toMatchObject({
      additions: files.length,
      measuredFileCount: files.length,
      measurementStatus: "measured",
    });
  });

  it("does not persist stale results after a job attempt is aborted", async () => {
    vi.mocked(measurePullRequestFiles).mockImplementationOnce(
      async (
        _accessToken,
        _projectId,
        _repositoryId,
        options,
      ) =>
        await new Promise<never>((_resolve, reject) => {
          options.signal.addEventListener(
            "abort",
            () => reject(options.signal.reason),
            { once: true },
          );
        }),
    );

    const queued = enqueueRepositorySync("repo-1", "manual");
    const attempt = runNextRepositoryAnalyticsJob();

    await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1_000);
    await expect(attempt).resolves.toMatchObject({
      id: queued.id,
      status: "queued",
    });

    expect(
      getLocalSettingsDb().select().from(pullRequestMetrics).all(),
    ).toHaveLength(0);
    expect(
      getLocalSettingsDb().query.repositories.findFirst().sync(),
    ).toMatchObject({
      historySyncCompletedAt: null,
      lastPullRequestSyncAt: null,
    });
  });

  it("loads full details before classifying an ambiguous squash merge", async () => {
    vi.mocked(listCompletedRepositoryPullRequests).mockResolvedValueOnce({
      items: [
        {
          ...pullRequest,
          lastMergeTargetCommitId: null,
          mergeStrategy: null,
        },
      ],
      nextCursor: null,
    });
    vi.mocked(getRepositoryPullRequest).mockResolvedValueOnce({
      ...pullRequest,
      mergeStrategy: "squash",
    });

    enqueueRepositorySync("repo-1", "manual");
    await runNextRepositoryAnalyticsJob();

    expect(getRepositoryPullRequest).toHaveBeenCalledWith(
      "token",
      "project-1",
      "repo-1",
      pullRequest.pullRequestId,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(
      getLocalSettingsDb().select().from(pullRequestMetrics).get(),
    ).toMatchObject({
      measurementStatus: "measured",
    });
  });

  it("retries the job when a response body is interrupted", async () => {
    vi.mocked(measurePullRequestFiles).mockRejectedValueOnce(
      new TextResponseReadError(
        new TypeError("connection closed"),
      ),
    );

    const queued = enqueueRepositorySync("repo-1", "manual");
    await runNextRepositoryAnalyticsJob();

    expect(getJob(queued.id)).toMatchObject({
      status: "queued",
    });
    expect(
      getLocalSettingsDb().select().from(pullRequestMetrics).all(),
    ).toHaveLength(0);
  });
});
