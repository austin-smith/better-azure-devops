import { FileQuestionIcon, TrophyIcon } from "lucide-react";
import {
  compareWorkItemTypes,
  getDefaultWorkItemTypes,
  getWorkItemTypeMeta,
  normalizeWorkItemType,
  normalizeWorkItemTypes,
} from "@/lib/tasks/work-item-type";

describe("work-item-type", () => {
  it("normalizes supported values and preserves unknown types", () => {
    expect(normalizeWorkItemType(" bug ")).toBe("Bug");
    expect(normalizeWorkItemType("Custom Type")).toBe("Custom Type");
    expect(normalizeWorkItemType("")).toBeNull();
    expect(normalizeWorkItemType(null)).toBeNull();
  });

  it("dedupes and sorts supported types ahead of unknown types", () => {
    expect(
      normalizeWorkItemTypes([
        "feature",
        "Task",
        "custom",
        "Bug",
        "bug",
        "alpha 2",
        "alpha 10",
      ]),
    ).toEqual(["Bug", "Feature", "Task", "alpha 2", "alpha 10", "custom"]);
  });

  it("compares supported types by product order", () => {
    expect(compareWorkItemTypes("Feature", "Task")).toBeLessThan(0);
    expect(compareWorkItemTypes("custom 10", "custom 2")).toBeGreaterThan(0);
  });

  it("returns default supported types", () => {
    expect(getDefaultWorkItemTypes()).toEqual([
      "Bug",
      "Feature",
      "Task",
      "Test Case",
      "Test Plan",
      "Test Suite",
      "User Story",
    ]);
  });

  it("returns metadata for supported and unknown types", () => {
    expect(getWorkItemTypeMeta("feature")).toMatchObject({
      icon: TrophyIcon,
      isSupported: true,
      label: "Feature",
    });

    expect(getWorkItemTypeMeta("Migration")).toMatchObject({
      icon: FileQuestionIcon,
      isSupported: false,
      label: "Migration",
    });
  });
});
