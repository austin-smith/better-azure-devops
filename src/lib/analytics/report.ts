import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { getLocalSettingsDb } from "@/db";
import {
  pullRequestFileMetrics,
  pullRequestMetrics,
  pullRequests,
} from "@/db/schema";
import {
  getAnalyticsDateRange,
  type AnalyticsRange,
} from "@/lib/analytics/filters";
import { ANALYTICS_MEASUREMENT_VERSION } from "@/lib/analytics/measurement-version";
import { getAnalyticsTargetRefName } from "@/lib/analytics/refresh";

type PullRequestRow = typeof pullRequests.$inferSelect;
type MetricRow = typeof pullRequestMetrics.$inferSelect;
type FileRow = typeof pullRequestFileMetrics.$inferSelect;

function getUtcDay(value: string) {
  return value.slice(0, 10);
}

function getUtcWeek(value: string) {
  const date = new Date(value);
  const day = date.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return date.toISOString().slice(0, 10);
}

function buildFileMap(files: readonly FileRow[]) {
  const byPullRequest = new Map<number, FileRow[]>();

  for (const file of files) {
    const existing = byPullRequest.get(file.pullRequestId) ?? [];
    existing.push(file);
    byPullRequest.set(file.pullRequestId, existing);
  }

  return byPullRequest;
}

function buildMetricMap(metrics: readonly MetricRow[]) {
  return new Map(
    metrics.map((metric) => [metric.pullRequestId, metric]),
  );
}

function getMeasuredFiles(
  pullRequestId: number,
  fileMap: ReadonlyMap<number, FileRow[]>,
) {
  return (fileMap.get(pullRequestId) ?? []).filter(
    (file) => file.measurementStatus === "measured",
  );
}

function sumFileMetrics(files: readonly FileRow[]) {
  return files.reduce(
    (total, file) => ({
      additions: total.additions + file.additions,
      deletions: total.deletions + file.deletions,
    }),
    { additions: 0, deletions: 0 },
  );
}

function hasCompleteMeasurement(
  pullRequestId: number,
  metricMap: ReadonlyMap<number, MetricRow>,
) {
  const metric = metricMap.get(pullRequestId);

  return (
    metric?.measurementStatus === "measured" &&
    metric.measurementVersion === ANALYTICS_MEASUREMENT_VERSION
  );
}

function getCompleteMeasuredFiles(
  pullRequestId: number,
  metricMap: ReadonlyMap<number, MetricRow>,
  fileMap: ReadonlyMap<number, FileRow[]>,
) {
  return hasCompleteMeasurement(pullRequestId, metricMap)
    ? getMeasuredFiles(pullRequestId, fileMap)
    : [];
}

function buildContributors(
  pullRequests: readonly PullRequestRow[],
  metricMap: ReadonlyMap<number, MetricRow>,
  fileMap: ReadonlyMap<number, FileRow[]>,
) {
  const contributors = new Map<
    string,
    {
      additions: number;
      deletions: number;
      displayName: string;
      files: Set<string>;
      id: string;
      imageUrl: string | null;
      mergeDays: Set<string>;
      pullRequests: number;
    }
  >();

  for (const pullRequest of pullRequests) {
    if (!pullRequest.creatorId) {
      continue;
    }

    const contributor = contributors.get(pullRequest.creatorId) ?? {
      additions: 0,
      deletions: 0,
      displayName: pullRequest.creatorDisplayName,
      files: new Set<string>(),
      id: pullRequest.creatorId,
      imageUrl: pullRequest.creatorImageUrl,
      mergeDays: new Set<string>(),
      pullRequests: 0,
    };
    const files = getCompleteMeasuredFiles(
      pullRequest.pullRequestId,
      metricMap,
      fileMap,
    );
    const metrics = sumFileMetrics(files);

    contributor.additions += metrics.additions;
    contributor.deletions += metrics.deletions;
    contributor.pullRequests += 1;
    contributor.mergeDays.add(getUtcDay(pullRequest.closedAt));
    files.forEach((file) => contributor.files.add(file.path));
    contributors.set(pullRequest.creatorId, contributor);
  }

  return [...contributors.values()]
    .map((contributor) => ({
      additions: contributor.additions,
      churn: contributor.additions + contributor.deletions,
      deletions: contributor.deletions,
      displayName: contributor.displayName,
      filesTouched: contributor.files.size,
      id: contributor.id,
      imageUrl: contributor.imageUrl,
      mergeDays: contributor.mergeDays.size,
      pullRequests: contributor.pullRequests,
    }))
    .sort(
      (left, right) =>
        right.churn - left.churn ||
        right.pullRequests - left.pullRequests ||
        left.displayName.localeCompare(right.displayName),
    );
}

function buildTrend(
  pullRequests: readonly PullRequestRow[],
  metricMap: ReadonlyMap<number, MetricRow>,
  fileMap: ReadonlyMap<number, FileRow[]>,
) {
  const weeks = new Map<
    string,
    { additions: number; deletions: number; pullRequests: number }
  >();

  for (const pullRequest of pullRequests) {
    const week = getUtcWeek(pullRequest.closedAt);
    const current = weeks.get(week) ?? {
      additions: 0,
      deletions: 0,
      pullRequests: 0,
    };
    const metrics = sumFileMetrics(
      getCompleteMeasuredFiles(
        pullRequest.pullRequestId,
        metricMap,
        fileMap,
      ),
    );

    current.additions += metrics.additions;
    current.deletions += metrics.deletions;
    current.pullRequests += 1;
    weeks.set(week, current);
  }

  return [...weeks.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([week, metrics]) => ({
      ...metrics,
      churn: metrics.additions + metrics.deletions,
      week,
    }));
}

function buildHotspots(
  pullRequests: readonly PullRequestRow[],
  metricMap: ReadonlyMap<number, MetricRow>,
  fileMap: ReadonlyMap<number, FileRow[]>,
) {
  const hotspots = new Map<
    string,
    {
      additions: number;
      contributors: Map<
        string,
        {
          displayName: string;
          id: string;
          imageUrl: string | null;
        }
      >;
      deletions: number;
      pullRequests: number;
    }
  >();

  for (const pullRequest of pullRequests) {
    for (const file of getCompleteMeasuredFiles(
      pullRequest.pullRequestId,
      metricMap,
      fileMap,
    )) {
      const current = hotspots.get(file.path) ?? {
        additions: 0,
        contributors: new Map(),
        deletions: 0,
        pullRequests: 0,
      };

      current.additions += file.additions;
      if (pullRequest.creatorId) {
        current.contributors.set(pullRequest.creatorId, {
          displayName: pullRequest.creatorDisplayName,
          id: pullRequest.creatorId,
          imageUrl: pullRequest.creatorImageUrl,
        });
      }
      current.deletions += file.deletions;
      current.pullRequests += 1;
      hotspots.set(file.path, current);
    }
  }

  return [...hotspots.entries()]
    .map(([path, hotspot]) => ({
      additions: hotspot.additions,
      churn: hotspot.additions + hotspot.deletions,
      contributors: [...hotspot.contributors.values()].sort(
        (left, right) =>
          left.displayName.localeCompare(right.displayName) ||
          left.id.localeCompare(right.id),
      ),
      deletions: hotspot.deletions,
      path,
      pullRequests: hotspot.pullRequests,
    }))
    .sort((left, right) => right.churn - left.churn)
    .slice(0, 20);
}

function buildPullRequestSizes(
  pullRequests: readonly PullRequestRow[],
  metricMap: ReadonlyMap<number, MetricRow>,
  fileMap: ReadonlyMap<number, FileRow[]>,
) {
  const buckets = {
    incomplete: 0,
    large: 0,
    medium: 0,
    small: 0,
    veryLarge: 0,
  };
  const pullRequestMetrics = pullRequests.flatMap((pullRequest) => {
    const complete = hasCompleteMeasurement(
      pullRequest.pullRequestId,
      metricMap,
    );

    if (!complete) {
      buckets.incomplete += 1;
      return [];
    }

    const files = getMeasuredFiles(
      pullRequest.pullRequestId,
      fileMap,
    );
    const metrics = sumFileMetrics(files);
    const churn = metrics.additions + metrics.deletions;

    if (churn <= 100) {
      buckets.small += 1;
    } else if (churn <= 500) {
      buckets.medium += 1;
    } else if (churn <= 1_000) {
      buckets.large += 1;
    } else {
      buckets.veryLarge += 1;
    }

    return [
      {
        ...metrics,
        churn,
        closedAt: pullRequest.closedAt,
        contributorDisplayName: pullRequest.creatorDisplayName,
        pullRequestId: pullRequest.pullRequestId,
        title: pullRequest.title,
        webUrl: pullRequest.webUrl,
      },
    ];
  });

  return {
    buckets,
    outliers: pullRequestMetrics
      .filter((pullRequest) => pullRequest.churn > 1_000)
      .sort((left, right) => right.churn - left.churn)
      .slice(0, 10),
  };
}

export function loadRepositoryAnalyticsReport(input: {
  branch: string;
  range: AnalyticsRange;
  repositoryId: string;
}) {
  const db = getLocalSettingsDb();
  const targetRefName = getAnalyticsTargetRefName(input.branch);
  const dateRange = getAnalyticsDateRange(input.range);
  const conditions = [
    eq(pullRequests.repositoryId, input.repositoryId),
    eq(pullRequests.targetRefName, targetRefName),
    lte(pullRequests.closedAt, dateRange.maxClosedAt),
  ];

  if (dateRange.minClosedAt) {
    conditions.push(
      gte(pullRequests.closedAt, dateRange.minClosedAt),
    );
  }

  const selectedPullRequests = db
    .select()
    .from(pullRequests)
    .where(and(...conditions))
    .all();
  const files = db
    .select({
      additions: pullRequestFileMetrics.additions,
      changeType: pullRequestFileMetrics.changeType,
      deletions: pullRequestFileMetrics.deletions,
      measuredAt: pullRequestFileMetrics.measuredAt,
      measurementStatus:
        pullRequestFileMetrics.measurementStatus,
      originalPath: pullRequestFileMetrics.originalPath,
      path: pullRequestFileMetrics.path,
      pullRequestId: pullRequestFileMetrics.pullRequestId,
      repositoryId: pullRequestFileMetrics.repositoryId,
    })
    .from(pullRequestFileMetrics)
    .innerJoin(
      pullRequests,
      and(
        eq(
          pullRequests.repositoryId,
          pullRequestFileMetrics.repositoryId,
        ),
        eq(
          pullRequests.pullRequestId,
          pullRequestFileMetrics.pullRequestId,
        ),
      ),
    )
    .where(and(...conditions))
    .all();
  const metrics = db
    .select({
      additions: pullRequestMetrics.additions,
      deletions: pullRequestMetrics.deletions,
      eligibleFileCount: pullRequestMetrics.eligibleFileCount,
      measuredAt: pullRequestMetrics.measuredAt,
      measuredFileCount: pullRequestMetrics.measuredFileCount,
      measurementVersion: pullRequestMetrics.measurementVersion,
      measurementStatus: pullRequestMetrics.measurementStatus,
      pullRequestId: pullRequestMetrics.pullRequestId,
      repositoryId: pullRequestMetrics.repositoryId,
      unmeasuredFileCount: pullRequestMetrics.unmeasuredFileCount,
    })
    .from(pullRequestMetrics)
    .innerJoin(
      pullRequests,
      and(
        eq(
          pullRequests.repositoryId,
          pullRequestMetrics.repositoryId,
        ),
        eq(
          pullRequests.pullRequestId,
          pullRequestMetrics.pullRequestId,
        ),
      ),
    )
    .where(and(...conditions))
    .all();
  const fileMap = buildFileMap(files);
  const metricMap = buildMetricMap(metrics);
  const currentMetrics = metrics.filter(
    (metric) =>
      metric.measurementVersion === ANALYTICS_MEASUREMENT_VERSION,
  );
  const currentMetricPullRequestIds = new Set(
    currentMetrics.map((metric) => metric.pullRequestId),
  );
  const completePullRequestIds = new Set(
    selectedPullRequests
      .filter((pullRequest) =>
        hasCompleteMeasurement(
          pullRequest.pullRequestId,
          metricMap,
        ),
      )
      .map((pullRequest) => pullRequest.pullRequestId),
  );
  const measuredFiles = files.filter(
    (file) =>
      file.measurementStatus === "measured" &&
      completePullRequestIds.has(file.pullRequestId),
  );
  const totals = sumFileMetrics(measuredFiles);
  const measuredPullRequests = completePullRequestIds.size;
  const unsupportedPullRequests = currentMetrics.filter(
    (metric) => metric.measurementStatus === "unsupported",
  ).length;
  const unavailableFiles = files.filter(
    (file) =>
      file.measurementStatus === "unavailable" &&
      currentMetricPullRequestIds.has(file.pullRequestId),
  ).length;
  const tooLargeFiles = files.filter(
    (file) =>
      file.measurementStatus === "too_large" &&
      currentMetricPullRequestIds.has(file.pullRequestId),
  ).length;

  return {
    branch: input.branch,
    contributors: buildContributors(
      selectedPullRequests,
      metricMap,
      fileMap,
    ),
    coverage: {
      eligibleFiles: currentMetrics.reduce(
        (count, metric) => count + metric.eligibleFileCount,
        0,
      ),
      incompletePullRequests:
        selectedPullRequests.length - measuredPullRequests,
      measuredFiles: currentMetrics.reduce(
        (count, metric) => count + metric.measuredFileCount,
        0,
      ),
      measuredPullRequests,
      pullRequests: selectedPullRequests.length,
      tooLargeFiles,
      unavailableFiles,
      unsupportedPullRequests,
      unattributedPullRequests: selectedPullRequests.filter(
        (pullRequest) => !pullRequest.creatorId,
      ).length,
    },
    generatedAt: new Date().toISOString(),
    hotspots: buildHotspots(
      selectedPullRequests,
      metricMap,
      fileMap,
    ),
    pullRequestSizes: buildPullRequestSizes(
      selectedPullRequests,
      metricMap,
      fileMap,
    ),
    range: input.range,
    totals: {
      additions: totals.additions,
      churn: totals.additions + totals.deletions,
      deletions: totals.deletions,
      filesTouched: new Set(measuredFiles.map((file) => file.path)).size,
      mergeDays: new Set(
        selectedPullRequests.map((pullRequest) =>
          getUtcDay(pullRequest.closedAt),
        ),
      ).size,
      pullRequests: selectedPullRequests.length,
    },
    trend: buildTrend(
      selectedPullRequests,
      metricMap,
      fileMap,
    ),
  };
}

export type RepositoryAnalyticsReport = ReturnType<
  typeof loadRepositoryAnalyticsReport
>;
