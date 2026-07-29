"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { RepositoryAnalyticsReport } from "@/lib/analytics/report";

type RepositoryAnalyticsChartsProps = {
  pullRequestSizes: RepositoryAnalyticsReport["pullRequestSizes"];
  trend: RepositoryAnalyticsReport["trend"];
};

const numberFormatter = new Intl.NumberFormat("en-US");
const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const weeklyFootprintConfig = {
  additions: {
    color: "var(--chart-2)",
    label: "Lines added",
  },
  deletions: {
    color: "var(--chart-4)",
    label: "Lines deleted",
  },
} satisfies ChartConfig;

const pullRequestSizeConfig = {
  count: {
    color: "var(--chart-3)",
    label: "Pull requests",
  },
  incomplete: {
    color: "var(--muted-foreground)",
    label: "Incomplete",
  },
} satisfies ChartConfig;

function parseUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatShortWeek(value: string) {
  return shortDateFormatter.format(parseUtcDate(value));
}

function formatLongWeek(value: string) {
  return `Week of ${longDateFormatter.format(parseUtcDate(value))}`;
}

type WeeklyFootprintTooltipProps = Partial<
  Pick<
    TooltipContentProps<number, string>,
    "active" | "label" | "payload"
  >
> & {
  trend: RepositoryAnalyticsReport["trend"];
};

function WeeklyFootprintTooltip({
  active,
  label,
  payload,
  trend,
}: WeeklyFootprintTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = trend.find((entry) => entry.week === String(label));

  if (!point) {
    return null;
  }

  const rows = [
    {
      color: "var(--color-additions)",
      label: "Lines added",
      value: point.additions,
    },
    {
      color: "var(--color-deletions)",
      label: "Lines deleted",
      value: point.deletions,
    },
    {
      label: "Total churn",
      value: point.churn,
    },
    {
      label: "Pull requests",
      value: point.pullRequests,
    },
  ];

  return (
    <div className="grid min-w-40 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{formatLongWeek(point.week)}</div>
      <div className="grid gap-1.5">
        {rows.map((row) => (
          <div
            className="flex items-center justify-between gap-4"
            key={row.label}
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              {row.color ? (
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: row.color }}
                />
              ) : null}
              <span>{row.label}</span>
            </div>
            <span className="font-mono font-medium text-foreground tabular-nums">
              {numberFormatter.format(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyFootprintChart({
  trend,
}: {
  trend: RepositoryAnalyticsReport["trend"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly footprint</CardTitle>
        <CardDescription>
          Added and deleted lines by merge week
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="h-64 w-full"
          config={weeklyFootprintConfig}
        >
          <BarChart
            accessibilityLayer
            aria-label="Weekly footprint chart"
            data={trend}
            desc="Stacked bars showing lines added and deleted for each completed pull request merge week."
            margin={{ left: 0, right: 8 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="week"
              minTickGap={24}
              tickFormatter={formatShortWeek}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickFormatter={(value: number) =>
                compactNumberFormatter.format(value)
              }
              tickLine={false}
              width={40}
            />
            <ChartTooltip
              content={
                <WeeklyFootprintTooltip trend={trend} />
              }
              cursor={false}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="additions"
              fill="var(--color-additions)"
              radius={[3, 3, 0, 0]}
              stackId="churn"
            />
            <Bar
              dataKey="deletions"
              fill="var(--color-deletions)"
              radius={[3, 3, 0, 0]}
              stackId="churn"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function PullRequestSizeChart({
  sizes,
}: {
  sizes: RepositoryAnalyticsReport["pullRequestSizes"];
}) {
  const data = [
    {
      count: sizes.buckets.small,
      key: "small",
      label: "≤100 lines",
    },
    {
      count: sizes.buckets.medium,
      key: "medium",
      label: "101–500",
    },
    {
      count: sizes.buckets.large,
      key: "large",
      label: "501–1,000",
    },
    {
      count: sizes.buckets.veryLarge,
      key: "veryLarge",
      label: ">1,000",
    },
    {
      count: sizes.buckets.incomplete,
      key: "incomplete",
      label: "Incomplete",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pull request size</CardTitle>
        <CardDescription>
          Completed pull requests by measured churn
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="h-64 w-full"
          config={pullRequestSizeConfig}
        >
          <BarChart
            accessibilityLayer
            aria-label="Pull request size chart"
            data={data}
            desc="Horizontal bars showing the number of completed pull requests in each measured churn range."
            layout="vertical"
            margin={{ left: 8, right: 12 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis
              allowDecimals={false}
              axisLine={false}
              tickFormatter={(value: number) =>
                numberFormatter.format(value)
              }
              tickLine={false}
              type="number"
            />
            <YAxis
              axisLine={false}
              dataKey="label"
              tickLine={false}
              tickMargin={8}
              type="category"
              width={76}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideIndicator
                  labelFormatter={(_value, payload) =>
                    String(payload[0]?.payload.label ?? "")
                  }
                />
              }
              cursor={false}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((bucket) => (
                <Cell
                  fill={
                    bucket.key === "incomplete"
                      ? "var(--color-incomplete)"
                      : "var(--color-count)"
                  }
                  key={bucket.key}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function RepositoryAnalyticsCharts({
  pullRequestSizes,
  trend,
}: RepositoryAnalyticsChartsProps) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <WeeklyFootprintChart trend={trend} />
      <PullRequestSizeChart sizes={pullRequestSizes} />
    </div>
  );
}
