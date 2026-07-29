import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  value: text("value").notNull(),
});

export const repositories = sqliteTable(
  "repositories",
  {
    defaultBranch: text("default_branch"),
    id: text("id").primaryKey(),
    isDisabled: integer("is_disabled", { mode: "boolean" })
      .notNull()
      .default(false),
    isTracked: integer("is_tracked", { mode: "boolean" })
      .notNull()
      .default(true),
    historySyncCompletedAt: text("history_sync_completed_at"),
    lastPullRequestSyncAt: text("last_pull_request_sync_at"),
    name: text("name").notNull(),
    nextPullRequestSyncAt: text("next_pull_request_sync_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    organizationUrl: text("organization_url").notNull(),
    projectId: text("project_id").notNull(),
    projectName: text("project_name").notNull(),
    pullRequestsSyncedFrom: text("pull_requests_synced_from"),
    pullRequestsSyncedThrough: text("pull_requests_synced_through"),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    webUrl: text("web_url"),
  },
  (table) => [
    index("repositories_project_idx").on(table.projectId),
    index("repositories_sync_due_idx").on(
      table.isTracked,
      table.isDisabled,
      table.historySyncCompletedAt,
      table.nextPullRequestSyncAt,
    ),
    index("repositories_history_sync_idx").on(
      table.isTracked,
      table.isDisabled,
      table.historySyncCompletedAt,
      table.updatedAt,
    ),
  ],
);

export const pullRequests = sqliteTable(
  "pull_requests",
  {
    closedAt: text("closed_at").notNull(),
    creatorDisplayName: text("creator_display_name").notNull(),
    creatorId: text("creator_id"),
    creatorImageUrl: text("creator_image_url"),
    mergeCommitId: text("merge_commit_id"),
    mergeStrategy: text("merge_strategy"),
    pullRequestId: integer("pull_request_id").notNull(),
    repositoryId: text("repository_id").notNull(),
    sourceRefName: text("source_ref_name").notNull(),
    targetRefName: text("target_ref_name").notNull(),
    title: text("title").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    webUrl: text("web_url"),
  },
  (table) => [
    primaryKey({
      columns: [table.repositoryId, table.pullRequestId],
    }),
    foreignKey({
      columns: [table.repositoryId],
      foreignColumns: [repositories.id],
    }).onDelete("cascade"),
    index("pull_requests_repository_closed_idx").on(
      table.repositoryId,
      table.targetRefName,
      table.closedAt,
    ),
    index("pull_requests_creator_idx").on(table.creatorId),
  ],
);

export const pullRequestMetrics = sqliteTable(
  "pull_request_metrics",
  {
    additions: integer("additions").notNull().default(0),
    deletions: integer("deletions").notNull().default(0),
    eligibleFileCount: integer("eligible_file_count")
      .notNull()
      .default(0),
    measuredAt: text("measured_at").notNull(),
    measuredFileCount: integer("measured_file_count")
      .notNull()
      .default(0),
    measurementVersion: integer("measurement_version")
      .notNull()
      .default(0),
    measurementStatus: text("measurement_status", {
      enum: ["failed", "measured", "partial", "unsupported"],
    }).notNull(),
    pullRequestId: integer("pull_request_id").notNull(),
    repositoryId: text("repository_id").notNull(),
    unmeasuredFileCount: integer("unmeasured_file_count")
      .notNull()
      .default(0),
  },
  (table) => [
    primaryKey({
      columns: [table.repositoryId, table.pullRequestId],
    }),
    foreignKey({
      columns: [table.repositoryId, table.pullRequestId],
      foreignColumns: [
        pullRequests.repositoryId,
        pullRequests.pullRequestId,
      ],
    }).onDelete("cascade"),
    index("pull_request_metrics_status_idx").on(
      table.repositoryId,
      table.measurementStatus,
    ),
  ],
);

export const pullRequestFileMetrics = sqliteTable(
  "pull_request_file_metrics",
  {
    additions: integer("additions").notNull().default(0),
    changeType: text("change_type").notNull(),
    deletions: integer("deletions").notNull().default(0),
    measuredAt: text("measured_at").notNull(),
    measurementStatus: text("measurement_status", {
      enum: [
        "binary",
        "lfs",
        "measured",
        "submodule",
        "too_large",
        "unavailable",
      ],
    }).notNull(),
    originalPath: text("original_path"),
    path: text("path").notNull(),
    pullRequestId: integer("pull_request_id").notNull(),
    repositoryId: text("repository_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.repositoryId, table.pullRequestId, table.path],
    }),
    foreignKey({
      columns: [table.repositoryId, table.pullRequestId],
      foreignColumns: [
        pullRequests.repositoryId,
        pullRequests.pullRequestId,
      ],
    }).onDelete("cascade"),
    index("pull_request_file_metrics_pull_request_idx").on(
      table.repositoryId,
      table.pullRequestId,
    ),
    index("pull_request_file_metrics_path_idx").on(
      table.repositoryId,
      table.path,
    ),
  ],
);

export const jobs = sqliteTable(
  "jobs",
  {
    attemptCount: integer("attempt_count").notNull().default(0),
    availableAt: text("available_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    errorMessage: text("error_message"),
    id: text("id").primaryKey(),
    leaseExpiresAt: text("lease_expires_at"),
    maxAttempts: integer("max_attempts").notNull().default(3),
    payload: text("payload").notNull(),
    priority: integer("priority").notNull().default(0),
    progressCurrent: integer("progress_current").notNull().default(0),
    progressTotal: integer("progress_total").notNull().default(0),
    resourceId: text("resource_id").notNull(),
    resourceType: text("resource_type").notNull(),
    startedAt: text("started_at"),
    status: text("status", {
      enum: ["completed", "failed", "queued", "running"],
    })
      .notNull()
      .default("queued"),
    type: text("type").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("jobs_available_idx").on(
      table.status,
      table.priority,
      table.availableAt,
      table.createdAt,
    ),
    index("jobs_resource_idx").on(
      table.resourceType,
      table.resourceId,
      table.status,
    ),
  ],
);
