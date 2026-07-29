// @vitest-environment jsdom

import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { RepositoryAnalytics } from "@/components/repositories/repository-analytics";
import type { RepositoryAnalyticsReport } from "@/lib/analytics/report";
import type { RepositoryAnalyticsJob } from "@/lib/analytics/refresh";

const refresh = vi.fn();

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/repos/project/repository/analytics",
  useRouter: () => ({
    push: vi.fn(),
    refresh,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

const activeJob: RepositoryAnalyticsJob = {
  attemptCount: 0,
  availableAt: "2026-07-26T12:00:00.000Z",
  completedAt: null,
  createdAt: "2026-07-26T12:00:00.000Z",
  errorMessage: null,
  id: "job-1",
  leaseExpiresAt: null,
  maxAttempts: 3,
  payload: "{}",
  priority: 0,
  progressCurrent: 0,
  progressTotal: 0,
  resourceId: "repository",
  resourceType: "repository",
  startedAt: null,
  status: "queued",
  type: "sync_repository_pull_requests",
  updatedAt: "2026-07-26T12:00:00.000Z",
};

const emptyReport: RepositoryAnalyticsReport = {
  branch: "refs/heads/main",
  contributors: [],
  coverage: {
    eligibleFiles: 0,
    incompletePullRequests: 0,
    measuredFiles: 0,
    measuredPullRequests: 0,
    pullRequests: 0,
    tooLargeFiles: 0,
    unattributedPullRequests: 0,
    unavailableFiles: 0,
    unsupportedPullRequests: 0,
  },
  generatedAt: "2026-07-26T12:00:00.000Z",
  hotspots: [],
  pullRequestSizes: {
    buckets: {
      incomplete: 0,
      large: 0,
      medium: 0,
      small: 0,
      veryLarge: 0,
    },
    outliers: [],
  },
  range: "30",
  totals: {
    additions: 0,
    churn: 0,
    deletions: 0,
    filesTouched: 0,
    mergeDays: 0,
    pullRequests: 0,
  },
  trend: [],
};

describe("RepositoryAnalytics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
    refresh.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("continues polling after a transient status request failure", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            job: {
              ...activeJob,
              completedAt: "2026-07-26T12:01:00.000Z",
              status: "completed",
            },
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        ),
      );

    render(
      <RepositoryAnalytics
        activeJob={activeJob}
        branch="refs/heads/main"
        lastSyncedAt={null}
        projectId="project"
        range="30"
        report={emptyReport}
        repositoryId="repository"
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("places the CSV download in the analytics toolbar", async () => {
    render(
      <RepositoryAnalytics
        activeJob={null}
        branch="refs/heads/main"
        lastSyncedAt="2026-07-26T12:00:00.000Z"
        projectId="project"
        range="30"
        report={{
          ...emptyReport,
          totals: {
            ...emptyReport.totals,
            pullRequests: 1,
          },
        }}
        repositoryId="repository"
      />,
    );

    const toolbar = screen
      .getByRole("heading", { name: "Analytics" })
      .closest("section");
    const timeWindow = screen.getByRole("combobox", {
      name: "Time window",
    });

    if (!toolbar) {
      throw new Error("Analytics toolbar was not rendered.");
    }

    expect(
      timeWindow.querySelector(".lucide-clock-3"),
    ).toBeInTheDocument();

    const csvLink = within(toolbar).getByRole("link", {
      name: "CSV",
    });

    expect(csvLink).toHaveAttribute(
      "href",
      "/api/repos/project/repository/analytics/export?branch=refs%2Fheads%2Fmain&range=30&format=csv",
    );
    expect(screen.queryByText("JSON")).not.toBeInTheDocument();

    fireEvent.focus(csvLink);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(screen.getByText("Download CSV")).toBeVisible();
  });
});
