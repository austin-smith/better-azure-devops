import {
  applyTaskListFilters,
  areTaskListFiltersEqual,
  createTaskListSearchParams,
  getActiveTaskFilterPreset,
  getCompactTaskPathBreadcrumb,
  getTaskFilterOptions,
  getTaskListTitle,
  getTaskPathLeaf,
  isTaskListFiltered,
  normalizeTaskListFilters,
  parseTaskListFilters,
} from "@/lib/tasks/filters";
import { createTask } from "../../fixtures/tasks";

describe("task filters", () => {
  it("normalizes filter input values", () => {
    expect(
      normalizeTaskListFilters({
        areaPath: " Project \\ Area \\ Team ",
        assignee: " Ada ",
        iterationPath: " Project \\ Iteration \\ Sprint 1 ",
        priorities: ["2", "10", "2", "High", " "],
        query: "  fix login  ",
        states: ["active", "Blocked", " active "],
        types: [" task ", "Bug", "bug", "Custom"],
      }),
    ).toEqual({
      areaPath: "Project\\Area\\Team",
      assignee: "Ada",
      iterationPath: "Project\\Iteration\\Sprint 1",
      priorities: ["2", "10", "High"],
      query: "fix login",
      states: ["active", "Blocked"],
      types: ["Bug", "Task", "Custom"],
    });
  });

  it("parses search params and serializes them back in normalized order", () => {
    const filters = parseTaskListFilters({
      areaPath: "Project\\Area\\Platform",
      assignee: ["Ada Lovelace"],
      iterationPath: "Project\\Iteration\\Sprint 2",
      priority: ["2", "1"],
      q: "deploy",
      state: ["Blocked", "Active"],
      type: ["feature", "bug"],
    });

    expect(filters).toEqual({
      areaPath: "Project\\Area\\Platform",
      assignee: "Ada Lovelace",
      iterationPath: "Project\\Iteration\\Sprint 2",
      priorities: ["1", "2"],
      query: "deploy",
      states: ["Active", "Blocked"],
      types: ["Bug", "Feature"],
    });

    expect(createTaskListSearchParams(filters).toString()).toBe(
      "areaPath=Project%5CArea%5CPlatform&q=deploy&assignee=Ada+Lovelace&iterationPath=Project%5CIteration%5CSprint+2&state=Active&state=Blocked&priority=1&priority=2&type=Bug&type=Feature",
    );
  });

  it("treats equivalent filters as equal after normalization", () => {
    expect(
      areTaskListFiltersEqual(
        { states: ["active", "Blocked"], assignee: " Ada " },
        { states: ["Blocked", "active"], assignee: "Ada" },
      ),
    ).toBe(true);
  });

  it("recognizes presets and titles", () => {
    expect(getActiveTaskFilterPreset({ assignee: " me " })?.key).toBe("mine");
    expect(getTaskListTitle({ assignee: "me" })).toBe("Your Queue");
    expect(getTaskListTitle({ states: ["Active"] })).toBe("Filtered Work Items");
    expect(isTaskListFiltered({})).toBe(false);
    expect(isTaskListFiltered({ priorities: ["1"] })).toBe(true);
  });

  it("builds filter options from tasks and selected values", () => {
    const options = getTaskFilterOptions(
      [
        createTask({
          assignee: "Ada Lovelace",
          priority: "3",
          state: "Blocked",
          type: "Feature",
        }),
        createTask({
          assignee: "Unassigned",
          id: 102,
          priority: "1",
          state: "Active",
          type: "Bug",
        }),
      ],
      { assignee: "Grace Hopper", priorities: ["2"], types: ["Custom"] },
    );

    expect(options).toEqual({
      assignees: ["Ada Lovelace", "Grace Hopper"],
      priorities: ["1", "2", "3"],
      states: ["Active", "Blocked"],
      types: ["Bug", "Feature", "Custom"],
    });
  });

  it("applies path, assignee, type, priority, and query filters", () => {
    const matchingTask = createTask({
      areaPath: "Project\\Area\\Platform",
      assignee: "Ada Lovelace",
      id: 204,
      iterationPath: "Project\\Iteration\\Sprint 2",
      priority: "1",
      state: "Blocked",
      title: "Deployment notifications",
      type: "Feature",
    });
    const tasks = [
      matchingTask,
      createTask({
        areaPath: "Project\\Area\\Other",
        id: 205,
        iterationPath: "Project\\Iteration\\Sprint 2",
        priority: "1",
        state: "Blocked",
        type: "Feature",
      }),
      createTask({
        areaPath: "Project\\Area\\Platform",
        assignee: "Grace Hopper",
        id: 206,
        iterationPath: "Project\\Iteration\\Sprint 2",
        priority: "1",
        state: "Blocked",
        type: "Feature",
      }),
    ];

    expect(
      applyTaskListFilters(tasks, {
        areaPath: "Project\\Area",
        assignee: "Ada Lovelace",
        iterationPath: "Project\\Iteration\\Sprint 2",
        priorities: ["1"],
        query: "deployment notification 204",
        states: ["blocked"],
        types: ["feature"],
      }),
    ).toEqual([matchingTask]);
  });

  it("requires explicit scoping when filtering by the special me assignee", () => {
    const tasks = [createTask()];

    expect(applyTaskListFilters(tasks, { assignee: "me" })).toEqual([]);
    expect(
      applyTaskListFilters(tasks, { assignee: "me" }, { assigneeAlreadyScopedToMe: true }),
    ).toEqual(tasks);
  });

  it("formats task paths for compact display", () => {
    expect(getTaskPathLeaf("Project\\Area\\Team")).toBe("Team");
    expect(getCompactTaskPathBreadcrumb("Project\\Area\\Platform\\Backend")).toBe(
      "Project / ... / Platform / Backend",
    );
    expect(getCompactTaskPathBreadcrumb("Project\\Area\\Team")).toBe(
      "Project / Area / Team",
    );
    expect(getTaskPathLeaf(null)).toBe("");
  });
});
