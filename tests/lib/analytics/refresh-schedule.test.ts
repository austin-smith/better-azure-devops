import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { getLocalSettingsDb } from "@/db";
import { jobs, repositories } from "@/db/schema";
import { writeAppSetting } from "@/db/repositories/app-settings";
import {
  enqueueRepositoryBootstrap,
  enqueueRepositorySync,
} from "@/lib/analytics/refresh";
import { ANALYTICS_HISTORY_WINDOW_DAYS_KEY } from "@/lib/analytics/settings";

vi.mock("server-only", () => ({}));

function useIsolatedDatabase() {
  process.env.LOCAL_SETTINGS_DATABASE_PATH =
    path.join(
      tmpdir(),
      `better-ado-refresh-${randomUUID()}.sqlite`,
    );
}

function insertRepository(
  values: Partial<typeof repositories.$inferInsert> = {},
) {
  getLocalSettingsDb()
    .insert(repositories)
    .values({
      id: "repo-1",
      name: "Repository",
      organizationUrl: "https://dev.azure.com/example",
      projectId: "project-1",
      projectName: "Project",
      ...values,
    })
    .run();
}

describe("repository analytics sync scheduling", () => {
  beforeEach(() => {
    useIsolatedDatabase();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a new repository with one full-history bootstrap", () => {
    insertRepository();

    const job = enqueueRepositorySync("repo-1", "scheduled");

    expect(JSON.parse(job.payload)).toEqual({
      mode: "bootstrap",
      origin: "scheduled",
      version: 1,
      windowEnd: "2026-07-26T12:00:00.000Z",
    });
    expect(job.priority).toBe(50);
  });

  it("applies the configured history range to the bootstrap query", () => {
    writeAppSetting(ANALYTICS_HISTORY_WINDOW_DAYS_KEY, "30");
    insertRepository();

    const job = enqueueRepositorySync("repo-1", "scheduled");

    expect(JSON.parse(job.payload)).toEqual({
      mode: "bootstrap",
      origin: "scheduled",
      version: 1,
      windowEnd: "2026-07-26T12:00:00.000Z",
      windowStart: "2026-06-26T12:00:00.000Z",
    });
  });

  it("bootstraps the missing range when history is expanded", () => {
    writeAppSetting(ANALYTICS_HISTORY_WINDOW_DAYS_KEY, "365");
    insertRepository({
      historySyncCompletedAt: "2026-07-20T18:30:00.000Z",
      pullRequestsSyncedFrom: "2026-04-27T12:00:00.000Z",
      pullRequestsSyncedThrough: "2026-07-20T18:30:00.000Z",
    });

    const job = enqueueRepositorySync("repo-1", "scheduled");

    expect(JSON.parse(job.payload)).toMatchObject({
      mode: "bootstrap",
      windowStart: "2025-07-26T12:00:00.000Z",
    });
  });

  it("overlaps incremental refreshes by 24 hours", () => {
    insertRepository({
      historySyncCompletedAt: "2026-07-20T18:30:00.000Z",
      pullRequestsSyncedThrough: "2026-07-20T18:30:00.000Z",
    });

    const job = enqueueRepositorySync("repo-1", "manual");

    expect(JSON.parse(job.payload)).toEqual({
      mode: "incremental",
      origin: "manual",
      version: 1,
      windowEnd: "2026-07-26T12:00:00.000Z",
      windowStart: "2026-07-19T18:30:00.000Z",
    });
    expect(job.priority).toBe(100);
  });

  it("promotes a queued bootstrap when a manual sync is requested", () => {
    insertRepository();

    const bootstrap = enqueueRepositoryBootstrap("repo-1");
    const manual = enqueueRepositorySync("repo-1", "manual");

    expect(manual.id).toBe(bootstrap!.id);
    expect(manual.priority).toBe(100);
    expect(JSON.parse(manual.payload)).toMatchObject({
      mode: "bootstrap",
      origin: "manual",
    });
  });

  it("does not enqueue another bootstrap after history is complete", () => {
    insertRepository({
      historySyncCompletedAt: "2026-07-26T11:00:00.000Z",
      pullRequestsSyncedThrough: "2026-07-26T11:00:00.000Z",
    });

    expect(enqueueRepositoryBootstrap("repo-1")).toBeNull();
    expect(
      getLocalSettingsDb()
        .select()
        .from(jobs)
        .all(),
    ).toHaveLength(0);
  });
});
