import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { jobs } from "@/db/schema";
import { getLocalSettingsDb } from "@/db";
import {
  claimNextJob,
  completeJob,
  deleteExpiredJobHistory,
  enqueueJob,
  getJob,
  getLatestJob,
  recoverExpiredJobs,
  renewJobLease,
  retryOrFailJob,
  runJobAttempt,
  updateJobProgress,
} from "@/lib/jobs";

vi.mock("server-only", () => ({}));

function useIsolatedDatabase() {
  process.env.LOCAL_SETTINGS_DATABASE_PATH =
    path.join(
      tmpdir(),
      `better-ado-jobs-${randomUUID()}.sqlite`,
    );
}

describe("jobs", () => {
  beforeEach(() => {
    useIsolatedDatabase();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deduplicates, claims, updates, and completes active work", () => {
    const input = {
      payload: JSON.stringify({ source: "test" }),
      resourceId: "repo-1",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    };
    const queued = enqueueJob(input);

    expect(enqueueJob(input).id).toBe(queued.id);

    const running = claimNextJob(input.type);

    expect(running).toMatchObject({
      attemptCount: 1,
      id: queued.id,
      status: "running",
    });

    updateJobProgress(queued.id, running!.attemptCount, {
      current: 2,
      total: 5,
    });

    expect(getJob(queued.id)).toMatchObject({
      progressCurrent: 2,
      progressTotal: 5,
    });

    completeJob(queued.id, running!.attemptCount);

    expect(getJob(queued.id)).toMatchObject({
      completedAt: "2026-07-26T12:00:00.000Z",
      status: "completed",
    });
  });

  it("retries with a delay, then retains terminal history for 30 days", () => {
    const queued = enqueueJob({
      maxAttempts: 2,
      payload: "{}",
      resourceId: "repo-1",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });

    const firstAttempt = claimNextJob(queued.type);
    retryOrFailJob(
      queued.id,
      firstAttempt!.attemptCount,
      "temporary",
      60_000,
    );

    expect(getJob(queued.id)).toMatchObject({
      availableAt: "2026-07-26T12:01:00.000Z",
      status: "queued",
    });
    expect(claimNextJob(queued.type)).toBeNull();

    vi.advanceTimersByTime(60_000);
    const secondAttempt = claimNextJob(queued.type);
    retryOrFailJob(
      queued.id,
      secondAttempt!.attemptCount,
      "permanent",
      60_000,
    );

    expect(getJob(queued.id)).toMatchObject({
      status: "failed",
    });
    expect(deleteExpiredJobHistory()).toBe(0);

    vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1_000);

    expect(deleteExpiredJobHistory()).toBe(1);
    expect(getJob(queued.id)).toBeNull();
  });

  it("stores jobs independently from analytics-specific tables", () => {
    enqueueJob({
      payload: "{}",
      resourceId: "project-1",
      resourceType: "project",
      type: "sync_work_items",
    });

    expect(getLocalSettingsDb().select().from(jobs).all()).toHaveLength(1);
  });

  it("runs higher-priority work first", () => {
    const scheduled = enqueueJob({
      payload: "{}",
      priority: 0,
      resourceId: "repo-1",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });
    const manual = enqueueJob({
      payload: "{}",
      priority: 100,
      resourceId: "repo-2",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });

    expect(claimNextJob(scheduled.type)?.id).toBe(manual.id);
  });

  it("promotes and replaces queued work for the same resource", () => {
    const scheduled = enqueueJob({
      payload: JSON.stringify({ origin: "scheduled" }),
      resourceId: "repo-1",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });
    const manual = enqueueJob({
      payload: JSON.stringify({ origin: "manual" }),
      priority: 100,
      replaceQueued: true,
      resourceId: "repo-1",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });

    expect(manual).toMatchObject({
      id: scheduled.id,
      priority: 100,
    });
    expect(JSON.parse(manual.payload)).toEqual({ origin: "manual" });
  });

  it("returns the latest terminal job for status reporting", () => {
    const queued = enqueueJob({
      maxAttempts: 1,
      payload: "{}",
      resourceId: "repo-1",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });

    const running = claimNextJob(queued.type);
    retryOrFailJob(
      queued.id,
      running!.attemptCount,
      "permanent",
      0,
    );

    expect(
      getLatestJob({
        resourceId: "repo-1",
        resourceType: "repository",
        type: queued.type,
      }),
    ).toMatchObject({
      errorMessage: "permanent",
      status: "failed",
    });
  });

  it("recovers work whose server lease expired", () => {
    const queued = enqueueJob({
      payload: "{}",
      resourceId: "repo-1",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });

    claimNextJob(queued.type);
    vi.advanceTimersByTime(11 * 60 * 1_000);

    expect(recoverExpiredJobs()).toBe(1);
    expect(getJob(queued.id)).toMatchObject({
      status: "queued",
    });
  });

  it("renews a running job lease while its attempt remains active", () => {
    const queued = enqueueJob({
      payload: "{}",
      resourceId: "repo-1",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });
    const running = claimNextJob(queued.type)!;
    const initialLease = running.leaseExpiresAt;

    vi.advanceTimersByTime(30_000);

    expect(renewJobLease(running.id, running.attemptCount)).toBe(1);
    expect(getJob(running.id)?.leaseExpiresAt).not.toBe(initialLease);
  });

  it("routes heartbeat storage failures through the attempt promise", async () => {
    const queued = enqueueJob({
      payload: "{}",
      resourceId: "repo-1",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });
    const running = claimNextJob(queued.type)!;
    const attempt = runJobAttempt(
      running,
      (signal) =>
        new Promise<never>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(signal.reason),
            { once: true },
          );
        }),
    );

    process.env.LOCAL_SETTINGS_DATABASE_PATH = tmpdir();
    const expectation = expect(attempt).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(30_000);

    await expectation;
  });

  it("prevents an expired attempt from updating a retried job", () => {
    const queued = enqueueJob({
      payload: "{}",
      resourceId: "repo-1",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });
    const firstAttempt = claimNextJob(queued.type)!;

    vi.advanceTimersByTime(2 * 60 * 1_000 + 1);
    recoverExpiredJobs();
    const secondAttempt = claimNextJob(queued.type)!;

    expect(
      updateJobProgress(firstAttempt.id, firstAttempt.attemptCount, {
        current: 99,
      }),
    ).toBe(0);
    expect(
      completeJob(firstAttempt.id, firstAttempt.attemptCount),
    ).toBeNull();
    expect(
      updateJobProgress(secondAttempt.id, secondAttempt.attemptCount, {
        current: 1,
        total: 2,
      }),
    ).toBe(1);
    expect(getJob(queued.id)).toMatchObject({
      attemptCount: 2,
      progressCurrent: 1,
      status: "running",
    });
  });

  it("fails an expired job after its final allowed attempt", () => {
    const queued = enqueueJob({
      maxAttempts: 1,
      payload: "{}",
      resourceId: "repo-1",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });

    claimNextJob(queued.type);
    vi.advanceTimersByTime(2 * 60 * 1_000 + 1);

    expect(recoverExpiredJobs()).toBe(1);
    expect(getJob(queued.id)).toMatchObject({
      completedAt: "2026-07-26T12:02:00.001Z",
      status: "failed",
    });
  });

  it("aborts a job attempt after its maximum runtime", async () => {
    const queued = enqueueJob({
      payload: "{}",
      resourceId: "repo-1",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });
    const running = claimNextJob(queued.type)!;
    const attempt = runJobAttempt(
      running,
      () => new Promise<never>(() => {}),
    );

    const expectation = expect(attempt).rejects.toThrow(
      "two-hour time limit",
    );

    await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1_000);
    await expectation;
  });

  it("does not recover running work before its lease expires", () => {
    const queued = enqueueJob({
      payload: "{}",
      resourceId: "repo-1",
      resourceType: "repository",
      type: "sync_repository_pull_requests",
    });

    claimNextJob(queued.type);

    expect(recoverExpiredJobs()).toBe(0);
    expect(getJob(queued.id)).toMatchObject({
      status: "running",
    });
  });
});
