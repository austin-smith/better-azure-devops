// @vitest-environment jsdom

import {
  DEFAULT_LAYOUT,
  FILE_TREE_WIDTH_KEY,
  createLayout,
  normalizeLayout,
  readStoredLayout,
  writeStoredLayout,
} from "@/lib/repositories/pull-request-files-layout";

/**
 * The panel group matches a layout to its panels by key order rather than by
 * key name, so these assertions are about the order of the keys as much as the
 * values behind them. Writing the keys alphabetically hands the tree the diff
 * column's width and inverts every drag, which is not visible in the rendered
 * markup and only shows up once someone drags the separator.
 */
describe("createLayout", () => {
  it("lists the panels in the order they are rendered", () => {
    expect(Object.keys(createLayout(24))).toEqual(["tree", "diffs"]);
  });

  it("gives the remaining width to the diffs", () => {
    expect(createLayout(24)).toEqual({ diffs: 76, tree: 24 });
  });

  it("builds the default layout from the default tree width", () => {
    expect(Object.keys(DEFAULT_LAYOUT)).toEqual(["tree", "diffs"]);
  });
});

describe("normalizeLayout", () => {
  it("returns panel order even when given the keys in another order", () => {
    const stored = JSON.parse('{"diffs":70,"tree":30}') as Record<
      string,
      number
    >;

    expect(Object.keys(stored)).toEqual(["diffs", "tree"]);
    expect(Object.keys(normalizeLayout(stored) ?? {})).toEqual([
      "tree",
      "diffs",
    ]);
  });

  it("rejects a tree width under the minimum", () => {
    expect(normalizeLayout({ diffs: 95, tree: 5 })).toBeNull();
  });

  it("rejects a tree width over the maximum", () => {
    expect(normalizeLayout({ diffs: 20, tree: 80 })).toBeNull();
  });

  it("rejects a layout missing a panel", () => {
    expect(normalizeLayout({ tree: 24 })).toBeNull();
  });
});

describe("stored layout", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("restores a width that was saved", () => {
    writeStoredLayout({ diffs: 70, tree: 30 });

    expect(readStoredLayout()).toEqual({ diffs: 70, tree: 30 });
  });

  it("restores it in panel order regardless of how it was serialized", () => {
    window.localStorage.setItem(
      FILE_TREE_WIDTH_KEY,
      '{"diffs":70,"tree":30}',
    );

    expect(Object.keys(readStoredLayout() ?? {})).toEqual(["tree", "diffs"]);
  });

  it("ignores a width outside the allowed range", () => {
    window.localStorage.setItem(FILE_TREE_WIDTH_KEY, '{"diffs":20,"tree":80}');

    expect(readStoredLayout()).toBeNull();
  });

  it("ignores content that is not a layout", () => {
    window.localStorage.setItem(FILE_TREE_WIDTH_KEY, "not json");

    expect(readStoredLayout()).toBeNull();
  });

  it("does not save a width outside the allowed range", () => {
    writeStoredLayout({ diffs: 20, tree: 80 });

    expect(window.localStorage.getItem(FILE_TREE_WIDTH_KEY)).toBeNull();
  });
});
