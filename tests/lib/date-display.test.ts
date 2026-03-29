import { getDateDisplay, parseDateValue } from "@/lib/date-display";

describe("date-display", () => {
  const now = new Date("2025-01-10T12:00:00-08:00");

  it("parses valid ISO values", () => {
    expect(parseDateValue("2025-01-10T11:30:00.000Z")).toBeInstanceOf(Date);
    expect(parseDateValue("not-a-date")).toBeNull();
  });

  it("returns relative labels for recent dates", () => {
    expect(
      getDateDisplay("2025-01-10T11:59:30-08:00", { now }),
    ).toMatchObject({
      isRelative: true,
      label: "now",
      title: "Jan 10, 2025, 11:59 AM",
    });

    expect(
      getDateDisplay("2025-01-10T09:00:00-08:00", { now }),
    ).toMatchObject({
      isRelative: true,
      label: "3h ago",
    });
  });

  it("falls back to absolute formatting for older dates and unknown input", () => {
    expect(
      getDateDisplay("2025-01-01T12:00:00-08:00", { now, relativeUntilDays: 7 }),
    ).toMatchObject({
      isRelative: false,
      label: "Jan 1, 12:00 PM",
      title: "Jan 1, 2025, 12:00 PM",
    });

    expect(getDateDisplay("invalid", { now })).toEqual({
      isRelative: false,
      label: "Unknown",
      title: "Unknown",
    });
  });
});
