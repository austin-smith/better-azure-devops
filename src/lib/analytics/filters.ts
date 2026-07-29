export const ANALYTICS_RANGES = ["30", "90", "180", "365", "all"] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export function parseAnalyticsRange(value: unknown): AnalyticsRange {
  return ANALYTICS_RANGES.includes(value as AnalyticsRange)
    ? (value as AnalyticsRange)
    : "90";
}

export function getAnalyticsDateRange(
  range: AnalyticsRange,
  referenceDate = new Date(),
) {
  const maxClosedAt = referenceDate.toISOString();

  if (range === "all") {
    return { maxClosedAt, minClosedAt: null };
  }

  const minDate = new Date(referenceDate);
  minDate.setUTCDate(minDate.getUTCDate() - Number(range));

  return {
    maxClosedAt,
    minClosedAt: minDate.toISOString(),
  };
}

export function getAnalyticsRangeLabel(range: AnalyticsRange) {
  return range === "all" ? "All time" : `Last ${range} days`;
}
