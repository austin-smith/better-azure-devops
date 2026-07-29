// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { JobHistory } from "@/components/jobs/job-history";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { JobHistoryPage } from "@/lib/job-history/types";

const { navigationState, refreshMock, replaceMock } = vi.hoisted(() => ({
  navigationState: {
    pathname: "/jobs",
    searchParams: new URLSearchParams(),
  },
  refreshMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => navigationState.searchParams,
  useRouter: () => ({
    refresh: refreshMock,
    replace: replaceMock,
  }),
}));

const history: JobHistoryPage = {
  counts: {
    active: 1,
    all: 2,
    completed: 0,
    failed: 1,
  },
  items: [
    {
      attemptCount: 2,
      availableAt: "2026-07-26T12:00:00.000Z",
      completedAt: null,
      createdAt: "2026-07-26T11:00:00.000Z",
      description: "Scheduled · Full history",
      errorMessage: "Azure DevOps request failed.",
      id: "failed-job",
      label: "Repository analytics sync",
      leaseExpiresAt: null,
      maxAttempts: 2,
      progressCurrent: 4,
      progressTotal: 10,
      resource: {
        description: "Cook Command Center",
        href: "/repos/project-1/repo-1/analytics",
        label: "Auvi",
      },
      resourceId: "repo-1",
      resourceType: "repository",
      startedAt: "2026-07-26T11:01:00.000Z",
      status: "failed",
      type: "sync_repository_pull_requests",
      updatedAt: "2026-07-26T11:04:00.000Z",
    },
  ],
  page: 1,
  pageCount: 1,
  status: "all",
  total: 1,
};

describe("JobHistory", () => {
  beforeEach(() => {
    navigationState.searchParams = new URLSearchParams();
    refreshMock.mockReset();
    replaceMock.mockReset();
  });

  it("renders operational details and repository navigation", () => {
    render(
      <TooltipProvider>
        <JobHistory
          generatedAt="2026-07-26T12:00:00.000Z"
          history={history}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("Repository analytics sync")).toBeVisible();
    expect(screen.getByText("Scheduled · Full history")).toBeVisible();
    expect(screen.getByText("Azure DevOps request failed.")).toBeVisible();
    expect(screen.getByText("4 / 10")).toBeVisible();
    expect(screen.getByText("2 / 2")).toBeVisible();
    expect(screen.getByRole("link", { name: "Auvi" })).toHaveAttribute(
      "href",
      "/repos/project-1/repo-1/analytics",
    );
  });

  it("updates the status filter and supports manual refresh", () => {
    render(
      <TooltipProvider>
        <JobHistory
          generatedAt="2026-07-26T12:00:00.000Z"
          history={history}
        />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Active1" }));

    expect(replaceMock).toHaveBeenCalledWith("/jobs?status=active");

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh job history" }),
    );

    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("shows an expired running lease as stalled", () => {
    const stalledHistory: JobHistoryPage = {
      ...history,
      items: [
        {
          ...history.items[0],
          completedAt: null,
          errorMessage: null,
          leaseExpiresAt: "2026-07-26T11:59:00.000Z",
          status: "running",
          updatedAt: "2026-07-26T11:57:00.000Z",
        },
      ],
    };

    render(
      <TooltipProvider>
        <JobHistory
          generatedAt="2026-07-26T12:00:00.000Z"
          history={stalledHistory}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("Stalled")).toBeVisible();
    expect(screen.getByText(/Last heartbeat/)).toBeVisible();
  });
});
