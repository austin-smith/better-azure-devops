import {
  getTaskStateBadgeVariant,
  isBlockedTask,
  isStaleTask,
  isUnassignedTask,
} from "@/lib/tasks/state";
import { createTask } from "../../fixtures/tasks";

describe("task state helpers", () => {
  it("maps task states to badge variants", () => {
    expect(getTaskStateBadgeVariant("Closed")).toBe("secondary");
    expect(getTaskStateBadgeVariant("blocked")).toBe("destructive");
    expect(getTaskStateBadgeVariant("Active")).toBe("outline");
  });

  it("detects blocked and unassigned tasks", () => {
    expect(isBlockedTask(createTask({ state: "Blocked" }))).toBe(true);
    expect(isBlockedTask(createTask({ state: "Active" }))).toBe(false);
    expect(isUnassignedTask(createTask({ assignee: " Unassigned " }))).toBe(true);
    expect(isUnassignedTask(createTask({ assignee: "Ada Lovelace" }))).toBe(false);
  });

  it("marks stale tasks only when the updated date is old enough", () => {
    const now = new Date("2025-01-10T12:00:00.000Z");

    expect(
      isStaleTask(createTask({ updatedAt: "2025-01-02T12:00:00.000Z" }), now, 7),
    ).toBe(true);
    expect(
      isStaleTask(createTask({ updatedAt: "2025-01-04T12:00:00.000Z" }), now, 7),
    ).toBe(false);
    expect(isStaleTask(createTask({ updatedAt: "invalid" }), now, 7)).toBe(false);
  });
});
