import { format } from "date-fns";
import { getDateDisplay, parseDateValue } from "@/lib/date-display";

describe("date-display", () => {
  const now = new Date("2025-01-10T12:00:00-08:00");

  it("parses valid ISO values", () => {
    expect(parseDateValue("2025-01-10T11:30:00.000Z")).toBeInstanceOf(Date);
    expect(parseDateValue("not-a-date")).toBeNull();
  });

  it("returns relative labels for recent dates", () => {
    const recentValue = "2025-01-10T11:59:30-08:00";

    expect(
      getDateDisplay(recentValue, { now }),
    ).toMatchObject({
      isRelative: true,
      label: "now",
      title: format(new Date(recentValue), "MMM d, yyyy, h:mm a"),
    });

    expect(
      getDateDisplay("2025-01-10T09:00:00-08:00", { now }),
    ).toMatchObject({
      isRelative: true,
      label: "3h ago",
    });
  });

  it("falls back to absolute formatting for older dates and unknown input", () => {
    const olderValue = "2025-01-01T12:00:00-08:00";

    expect(
      getDateDisplay(olderValue, { now, relativeUntilDays: 7 }),
    ).toMatchObject({
      isRelative: false,
      label: format(new Date(olderValue), "MMM d, h:mm a"),
      title: format(new Date(olderValue), "MMM d, yyyy, h:mm a"),
    });

    expect(getDateDisplay("invalid", { now })).toEqual({
      isRelative: false,
      label: "Unknown",
      title: "Unknown",
    });
  });
});
