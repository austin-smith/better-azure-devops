import {
  getDefaultTaskListHref,
  getTaskDetailHref,
  getTaskListHref,
} from "@/lib/tasks/navigation";

describe("task navigation", () => {
  it("builds task detail links with serialized filters", () => {
    expect(
      getTaskDetailHref(42, {
        assignee: "Ada Lovelace",
        priorities: ["2", "1"],
        states: ["Blocked"],
      }),
    ).toBe("/tasks/42?assignee=Ada+Lovelace&state=Blocked&priority=1&priority=2");
  });

  it("returns the base task list path when no filters are set", () => {
    expect(getTaskListHref()).toBe("/tasks");
    expect(getDefaultTaskListHref()).toBe("/tasks");
  });
});
