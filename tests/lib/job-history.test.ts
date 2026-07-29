import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { getLocalSettingsDb } from "@/db";
import { jobs, repositories } from "@/db/schema";
import { loadJobHistory } from "@/lib/job-history";
import {
  getJobHistoryHref,
  parseJobHistorySearchParams,
} from "@/lib/job-history/filters";

vi.mock("server-only", () => ({}));

function useIsolatedDatabase() {
  process.env.LOCAL_SETTINGS_DATABASE_PATH =
    path.join(
      tmpdir(),
      `better-ado-job-history-${randomUUID()}.sqlite`,
    );
}

describe("job history", () => {
  beforeEach(() => {
    useIsolatedDatabase();

    const db = getLocalSettingsDb();

    db.insert(repositories)
      .values({
        id: "repo-1",
        name: "Auvi",
        organizationUrl: "https://dev.azure.com/example",
        projectId: "project-1",
        projectName: "Cook Command Center",
      })
      .run();
    db.insert(jobs)
      .values([
        {
          attemptCount: 1,
          completedAt: "2026-07-26T10:05:00.000Z",
          createdAt: "2026-07-26T10:00:00.000Z",
          id: "completed-job",
          payload: JSON.stringify({
            mode: "forward",
            origin: "manual",
          }),
          resourceId: "repo-1",
          resourceType: "repository",
          startedAt: "2026-07-26T10:01:00.000Z",
          status: "completed",
          type: "sync_repository_pull_requests",
          updatedAt: "2026-07-26T10:05:00.000Z",
        },
        {
          attemptCount: 3,
          completedAt: "2026-07-26T11:04:00.000Z",
          createdAt: "2026-07-26T11:00:00.000Z",
          errorMessage: "Azure DevOps request failed.",
          id: "failed-job",
          payload: JSON.stringify({
            mode: "bootstrap",
            origin: "scheduled",
            version: 1,
          }),
          resourceId: "repo-1",
          resourceType: "repository",
          startedAt: "2026-07-26T11:01:00.000Z",
          status: "failed",
          type: "sync_repository_pull_requests",
          updatedAt: "2026-07-26T11:04:00.000Z",
        },
        {
          createdAt: "2026-07-26T12:00:00.000Z",
          id: "queued-job",
          payload: "{}",
          resourceId: "project-1",
          resourceType: "project",
          status: "queued",
          type: "sync_work_items",
          updatedAt: "2026-07-26T12:00:00.000Z",
        },
      ])
      .run();
  });

  it("loads retained jobs with counts and resource presentation", () => {
    const history = loadJobHistory({ page: 1, status: "all" });

    expect(history.counts).toEqual({
      active: 1,
      all: 3,
      completed: 1,
      failed: 1,
    });
    expect(history.items.map((job) => job.id)).toEqual([
      "queued-job",
      "failed-job",
      "completed-job",
    ]);
    expect(
      history.items.find((job) => job.id === "failed-job"),
    ).toMatchObject({
      description: "Scheduled · Full history",
    });
    expect(
      history.items.find((job) => job.id === "completed-job"),
    ).toMatchObject({
      description: "Manual · Incremental",
      label: "Repository analytics sync",
      resource: {
        description: "Cook Command Center",
        href: "/repos/project-1/repo-1/analytics",
        label: "Auvi",
      },
    });
  });

  it("filters failed jobs without changing the global counts", () => {
    const history = loadJobHistory({ page: 1, status: "failed" });

    expect(history.total).toBe(1);
    expect(history.items).toEqual([
      expect.objectContaining({
        errorMessage: "Azure DevOps request failed.",
        id: "failed-job",
        status: "failed",
      }),
    ]);
    expect(history.counts.all).toBe(3);
  });

  it("normalizes filter URLs and invalid search parameters", () => {
    expect(
      parseJobHistorySearchParams({
        page: "-2",
        status: "unknown",
      }),
    ).toEqual({ page: 1, status: "all" });
    expect(
      parseJobHistorySearchParams({
        page: "3",
        status: "active",
      }),
    ).toEqual({ page: 3, status: "active" });
    expect(getJobHistoryHref({ status: "all" })).toBe("/jobs");
    expect(
      getJobHistoryHref({
        page: 2,
        status: "failed",
      }),
    ).toBe("/jobs?status=failed&page=2");
  });
});
