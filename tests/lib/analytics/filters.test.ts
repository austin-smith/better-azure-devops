import {
  getAnalyticsDateRange,
  getAnalyticsRangeLabel,
  parseAnalyticsRange,
} from "@/lib/analytics/filters";

describe("analytics filters", () => {
  it("defaults invalid ranges and labels supported windows", () => {
    expect(parseAnalyticsRange("nope")).toBe("90");
    expect(parseAnalyticsRange("365")).toBe("365");
    expect(getAnalyticsRangeLabel("all")).toBe("All time");
  });

  it("builds UTC API windows", () => {
    expect(
      getAnalyticsDateRange("30", new Date("2026-07-26T12:00:00.000Z")),
    ).toEqual({
      maxClosedAt: "2026-07-26T12:00:00.000Z",
      minClosedAt: "2026-06-26T12:00:00.000Z",
    });
    expect(
      getAnalyticsDateRange("all", new Date("2026-07-26T12:00:00.000Z")),
    ).toEqual({
      maxClosedAt: "2026-07-26T12:00:00.000Z",
      minClosedAt: null,
    });
  });
});
