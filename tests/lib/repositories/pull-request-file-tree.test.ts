import {
  buildPullRequestFileTree,
  getPullRequestFileTreeDirectoryPaths,
  type PullRequestFileTreeEntry,
  type PullRequestFileTreeNode,
} from "@/lib/repositories/pull-request-file-tree";

function createEntry(path: string): PullRequestFileTreeEntry {
  return {
    additions: 1,
    anchorId: `file-${path}`,
    changeType: "edit",
    deletions: 0,
    path,
    threadCount: 0,
  };
}

function describeTree(nodes: PullRequestFileTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.kind === "directory"
      ? [`${node.name}/`, ...describeTree(node.children).map((l) => `  ${l}`)]
      : [node.name],
  );
}

describe("buildPullRequestFileTree", () => {
  it("groups files under their directories", () => {
    const tree = buildPullRequestFileTree([
      createEntry("/src/app/page.tsx"),
      createEntry("/src/app/layout.tsx"),
    ]);

    expect(describeTree(tree)).toEqual([
      "src/app/",
      "  layout.tsx",
      "  page.tsx",
    ]);
  });

  it("collapses directory chains that hold a single directory", () => {
    const tree = buildPullRequestFileTree([
      createEntry("/a/b/c/deep.ts"),
    ]);

    expect(describeTree(tree)).toEqual(["a/b/c/", "  deep.ts"]);
  });

  it("stops collapsing where a directory branches", () => {
    const tree = buildPullRequestFileTree([
      createEntry("/src/one/first.ts"),
      createEntry("/src/two/second.ts"),
    ]);

    expect(describeTree(tree)).toEqual([
      "src/",
      "  one/",
      "    first.ts",
      "  two/",
      "    second.ts",
    ]);
  });

  it("stops collapsing when a directory also holds a file", () => {
    const tree = buildPullRequestFileTree([
      createEntry("/src/index.ts"),
      createEntry("/src/nested/child.ts"),
    ]);

    expect(describeTree(tree)).toEqual([
      "src/",
      "  nested/",
      "    child.ts",
      "  index.ts",
    ]);
  });

  it("sorts directories before files and orders each naturally", () => {
    const tree = buildPullRequestFileTree([
      createEntry("/item10.ts"),
      createEntry("/item2.ts"),
      createEntry("/zzz/last.ts"),
    ]);

    expect(describeTree(tree)).toEqual([
      "zzz/",
      "  last.ts",
      "item2.ts",
      "item10.ts",
    ]);
  });

  it("keeps root level files without a directory", () => {
    const tree = buildPullRequestFileTree([createEntry("/README.md")]);

    expect(describeTree(tree)).toEqual(["README.md"]);
  });

  it("keeps a file and directory that share the same path segment", () => {
    const tree = buildPullRequestFileTree([
      createEntry("/foo"),
      createEntry("/foo/bar.ts"),
    ]);

    expect(describeTree(tree)).toEqual(["foo/", "  bar.ts", "foo"]);
  });

  it("preserves the anchor used to jump to a diff", () => {
    const tree = buildPullRequestFileTree([createEntry("/src/page.tsx")]);
    const directory = tree[0];

    expect(directory?.kind).toBe("directory");

    if (directory?.kind !== "directory") {
      return;
    }

    const file = directory.children[0];

    expect(file?.kind === "file" && file.entry.anchorId).toBe(
      "file-/src/page.tsx",
    );
  });

  it("ignores entries without a usable path", () => {
    expect(buildPullRequestFileTree([createEntry("/")])).toEqual([]);
  });

  it("lists every directory path so the tree can be collapsed at once", () => {
    const tree = buildPullRequestFileTree([
      createEntry("/src/one/first.ts"),
      createEntry("/src/two/second.ts"),
    ]);

    expect(getPullRequestFileTreeDirectoryPaths(tree)).toEqual([
      "src",
      "src/one",
      "src/two",
    ]);
  });
});
