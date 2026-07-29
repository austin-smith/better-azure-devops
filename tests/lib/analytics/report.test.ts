import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { getLocalSettingsDb } from "@/db";
import {
  pullRequestFileMetrics,
  pullRequestMetrics,
  pullRequests,
  repositories,
} from "@/db/schema";
import { ANALYTICS_MEASUREMENT_VERSION } from "@/lib/analytics/measurement-version";
import { loadRepositoryAnalyticsReport } from "@/lib/analytics/report";

vi.mock("server-only", () => ({}));

function useIsolatedDatabase() {
  process.env.LOCAL_SETTINGS_DATABASE_PATH =
    path.join(
      tmpdir(),
      `better-ado-report-${randomUUID()}.sqlite`,
    );
}

describe("repository analytics report", () => {
  beforeEach(() => {
    useIsolatedDatabase();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));

    const db = getLocalSettingsDb();

    db.insert(repositories)
      .values({
        defaultBranch: "refs/heads/main",
        id: "repo-1",
        name: "Repository",
        organizationUrl: "https://dev.azure.com/example",
        projectId: "project-1",
        projectName: "Project",
      })
      .run();
    db.insert(pullRequests)
      .values([
        {
          closedAt: "2026-07-20T10:00:00.000Z",
          creatorDisplayName: "Austin",
          creatorId: "identity-1",
          pullRequestId: 1,
          repositoryId: "repo-1",
          sourceRefName: "refs/heads/topic",
          targetRefName: "refs/heads/main",
          title: "Measured contribution",
        },
        {
          closedAt: "2026-07-20T11:00:00.000Z",
          creatorDisplayName: "Unknown contributor",
          creatorId: null,
          pullRequestId: 2,
          repositoryId: "repo-1",
          sourceRefName: "refs/heads/other",
          targetRefName: "refs/heads/main",
          title: "Unattributed contribution",
        },
        {
          closedAt: "2026-07-21T09:00:00.000Z",
          creatorDisplayName: "Bianca",
          creatorId: "identity-2",
          creatorImageUrl: "https://example.test/bianca.png",
          pullRequestId: 3,
          repositoryId: "repo-1",
          sourceRefName: "refs/heads/shared-hotspot",
          targetRefName: "refs/heads/main",
          title: "Second hotspot contributor",
        },
        {
          closedAt: "2026-07-22T09:00:00.000Z",
          creatorDisplayName: "Austin",
          creatorId: "identity-1",
          pullRequestId: 4,
          repositoryId: "repo-1",
          sourceRefName: "refs/heads/incomplete",
          targetRefName: "refs/heads/main",
          title: "Incomplete contribution",
        },
      ])
      .run();
    db.insert(pullRequestMetrics)
      .values([
        {
          additions: 110,
          deletions: 2,
          eligibleFileCount: 2,
          measuredAt: "2026-07-21T00:00:00.000Z",
          measuredFileCount: 2,
          measurementVersion: ANALYTICS_MEASUREMENT_VERSION,
          measurementStatus: "measured",
          pullRequestId: 1,
          repositoryId: "repo-1",
        },
        {
          additions: 3,
          deletions: 0,
          eligibleFileCount: 1,
          measuredAt: "2026-07-21T00:00:00.000Z",
          measuredFileCount: 1,
          measurementVersion: ANALYTICS_MEASUREMENT_VERSION,
          measurementStatus: "measured",
          pullRequestId: 2,
          repositoryId: "repo-1",
        },
        {
          additions: 5,
          deletions: 1,
          eligibleFileCount: 1,
          measuredAt: "2026-07-22T00:00:00.000Z",
          measuredFileCount: 1,
          measurementVersion: ANALYTICS_MEASUREMENT_VERSION,
          measurementStatus: "measured",
          pullRequestId: 3,
          repositoryId: "repo-1",
        },
        {
          additions: 2_000,
          deletions: 0,
          eligibleFileCount: 2,
          measuredAt: "2026-07-22T00:00:00.000Z",
          measuredFileCount: 1,
          measurementVersion: ANALYTICS_MEASUREMENT_VERSION,
          measurementStatus: "partial",
          pullRequestId: 4,
          repositoryId: "repo-1",
          unmeasuredFileCount: 1,
        },
      ])
      .run();
    db.insert(pullRequestFileMetrics)
      .values([
        {
          additions: 10,
          changeType: "edit",
          deletions: 2,
          measuredAt: "2026-07-21T00:00:00.000Z",
          measurementStatus: "measured",
          path: "/src/app.ts",
          pullRequestId: 1,
          repositoryId: "repo-1",
        },
        {
          additions: 100,
          changeType: "edit",
          deletions: 0,
          measuredAt: "2026-07-21T00:00:00.000Z",
          measurementStatus: "measured",
          path: "/src/client.g.cs",
          pullRequestId: 1,
          repositoryId: "repo-1",
        },
        {
          additions: 3,
          changeType: "add",
          deletions: 0,
          measuredAt: "2026-07-21T00:00:00.000Z",
          measurementStatus: "measured",
          path: "/src/other.ts",
          pullRequestId: 2,
          repositoryId: "repo-1",
        },
        {
          additions: 5,
          changeType: "edit",
          deletions: 1,
          measuredAt: "2026-07-22T00:00:00.000Z",
          measurementStatus: "measured",
          path: "/src/app.ts",
          pullRequestId: 3,
          repositoryId: "repo-1",
        },
        {
          additions: 2_000,
          changeType: "edit",
          deletions: 0,
          measuredAt: "2026-07-22T00:00:00.000Z",
          measurementStatus: "measured",
          path: "/src/incomplete.ts",
          pullRequestId: 4,
          repositoryId: "repo-1",
        },
        {
          changeType: "edit",
          measuredAt: "2026-07-22T00:00:00.000Z",
          measurementStatus: "unavailable",
          path: "/src/unavailable.ts",
          pullRequestId: 4,
          repositoryId: "repo-1",
        },
      ])
      .run();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("separates repository totals from stable-identity attribution", () => {
    const report = loadRepositoryAnalyticsReport({
      branch: "main",
      range: "90",
      repositoryId: "repo-1",
    });

    expect(report.totals).toMatchObject({
      additions: 118,
      churn: 121,
      deletions: 3,
      pullRequests: 4,
    });
    expect(report.contributors).toEqual([
      expect.objectContaining({
        additions: 110,
        deletions: 2,
        id: "identity-1",
        pullRequests: 2,
      }),
      expect.objectContaining({
        additions: 5,
        deletions: 1,
        id: "identity-2",
        pullRequests: 1,
      }),
    ]);
    expect(report.coverage.unattributedPullRequests).toBe(1);
    expect(report.coverage).toMatchObject({
      eligibleFiles: 6,
      incompletePullRequests: 1,
      measuredFiles: 5,
      measuredPullRequests: 3,
      unavailableFiles: 1,
    });
    expect(report.pullRequestSizes.buckets).toEqual({
      incomplete: 1,
      large: 0,
      medium: 1,
      small: 2,
      veryLarge: 0,
    });
    expect(report.pullRequestSizes.outliers).toHaveLength(0);
    expect(report.trend).toEqual([
      {
        additions: 118,
        churn: 121,
        deletions: 3,
        pullRequests: 4,
        week: "2026-07-20",
      },
    ]);
    expect(
      report.hotspots.find(
        (hotspot) => hotspot.path === "/src/incomplete.ts",
      ),
    ).toBeUndefined();
    expect(
      report.hotspots.find((hotspot) => hotspot.path === "/src/app.ts")
        ?.contributors,
    ).toEqual([
      {
        displayName: "Austin",
        id: "identity-1",
        imageUrl: null,
      },
      {
        displayName: "Bianca",
        id: "identity-2",
        imageUrl: "https://example.test/bianca.png",
      },
    ]);
  });
});
