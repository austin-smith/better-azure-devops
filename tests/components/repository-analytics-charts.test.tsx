// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { RepositoryAnalyticsCharts } from "@/components/repositories/repository-analytics-charts";

class TestResizeObserver {
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  disconnect() {}

  observe(target: Element) {
    this.callback(
      [
        {
          borderBoxSize: [
            {
              blockSize: 256,
              inlineSize: 640,
            },
          ],
          contentBoxSize: [
            {
              blockSize: 256,
              inlineSize: 640,
            },
          ],
          contentRect: {
            bottom: 256,
            height: 256,
            left: 0,
            right: 640,
            toJSON: () => ({}),
            top: 0,
            width: 640,
            x: 0,
            y: 0,
          },
          devicePixelContentBoxSize: [],
          target,
        },
      ],
      this,
    );
  }

  unobserve() {}
}

describe("RepositoryAnalyticsCharts", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders accessible weekly footprint and pull-request size charts", async () => {
    render(
      <RepositoryAnalyticsCharts
        pullRequestSizes={{
          buckets: {
            incomplete: 1,
            large: 2,
            medium: 5,
            small: 8,
            veryLarge: 3,
          },
          outliers: [],
        }}
        trend={[
          {
            additions: 120,
            churn: 160,
            deletions: 40,
            pullRequests: 3,
            week: "2026-07-06",
          },
          {
            additions: 90,
            churn: 110,
            deletions: 20,
            pullRequests: 2,
            week: "2026-07-13",
          },
        ]}
      />,
    );

    const weeklyFootprintChart = await screen.findByRole("application", {
      name: "Weekly footprint chart",
    });

    expect(weeklyFootprintChart).toBeVisible();
    expect(
      screen.queryByTitle("Weekly footprint chart"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("application", {
        name: "Pull request size chart",
      }),
    ).toBeVisible();
    expect(
      screen.queryByTitle("Pull request size chart"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Added and deleted lines by merge week"),
    ).toBeVisible();
    expect(
      screen.getByText("Completed pull requests by measured churn"),
    ).toBeVisible();
    expect(screen.getByText("Lines added")).toBeVisible();
    expect(screen.getByText("Lines deleted")).toBeVisible();
    expect(screen.getByText("Incomplete")).toBeVisible();

    fireEvent.focus(weeklyFootprintChart);

    expect(await screen.findByText("Total churn")).toBeVisible();
    expect(screen.getByText("Pull requests")).toBeVisible();
  });
});
