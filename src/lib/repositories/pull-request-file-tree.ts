export type PullRequestFileTreeEntry = {
  /** Known only for files whose diff is on the loaded page. */
  additions: number | null;
  anchorId: string;
  changeType: string;
  deletions: number | null;
  /**
   * The tree covers every changed file while diffs stay paged, so a file on
   * another page links to the page holding it instead of to a dead anchor.
   */
  href: string | null;
  path: string;
  threadCount: number;
};

export type PullRequestFileTreeNode =
  | {
      children: PullRequestFileTreeNode[];
      kind: "directory";
      name: string;
      path: string;
    }
  | {
      entry: PullRequestFileTreeEntry;
      kind: "file";
      name: string;
      path: string;
    };

type MutableDirectory = {
  children: Map<
    string,
    {
      name: string;
      value: MutableDirectory | PullRequestFileTreeEntry;
    }
  >;
};

function createDirectory(): MutableDirectory {
  return { children: new Map() };
}

function isDirectory(
  value: MutableDirectory | PullRequestFileTreeEntry,
): value is MutableDirectory {
  return "children" in value;
}

function toNodes(
  directory: MutableDirectory,
  prefix: string,
): PullRequestFileTreeNode[] {
  const nodes = [...directory.children.values()].map(
    ({ name, value }): PullRequestFileTreeNode => {
      const path = prefix ? `${prefix}/${name}` : name;

      if (!isDirectory(value)) {
        return { entry: value, kind: "file", name, path };
      }

      // A directory holding nothing but one directory adds a row without
      // adding information, so the chain collapses into a single `a/b/c` row.
      let collapsedName = name;
      let collapsedPath = path;
      let current = value;

      while (current.children.size === 1) {
        const { name: childName, value: childValue } = [
          ...current.children.values(),
        ][0]!;

        if (!isDirectory(childValue)) {
          break;
        }

        collapsedName = `${collapsedName}/${childName}`;
        collapsedPath = `${collapsedPath}/${childName}`;
        current = childValue;
      }

      return {
        children: toNodes(current, collapsedPath),
        kind: "directory",
        name: collapsedName,
        path: collapsedPath,
      };
    },
  );

  return nodes.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "directory" ? -1 : 1;
    }

    return left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

/**
 * Azure DevOps returns pull request changes as a flat list of absolute paths.
 * A long comparison is far easier to navigate as a directory tree, so the flat
 * list is folded back into one here.
 */
export function buildPullRequestFileTree(
  entries: readonly PullRequestFileTreeEntry[],
): PullRequestFileTreeNode[] {
  const root = createDirectory();

  for (const entry of entries) {
    const segments = entry.path.split("/").filter(Boolean);

    if (segments.length === 0) {
      continue;
    }

    const fileName = segments.pop()!;
    let cursor = root;

    for (const segment of segments) {
      const key = `directory:${segment}`;
      const existing = cursor.children.get(key)?.value;

      if (existing && isDirectory(existing)) {
        cursor = existing;
        continue;
      }

      const created = createDirectory();

      cursor.children.set(key, { name: segment, value: created });
      cursor = created;
    }

    cursor.children.set(`file:${fileName}`, {
      name: fileName,
      value: entry,
    });
  }

  return toNodes(root, "");
}

export function getPullRequestFileTreeDirectoryPaths(
  nodes: readonly PullRequestFileTreeNode[],
): string[] {
  return nodes.flatMap((node) =>
    node.kind === "directory"
      ? [node.path, ...getPullRequestFileTreeDirectoryPaths(node.children)]
      : [],
  );
}
