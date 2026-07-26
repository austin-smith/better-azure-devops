/**
 * Width of the pull request files view, split between the file tree and the
 * diffs.
 *
 * This lives apart from the component because two of the rules it encodes are
 * load bearing and easy to undo by accident, so they are worth asserting
 * directly rather than only through a rendered panel group.
 */

/**
 * The stored width is versioned because an earlier build wrote the two
 * percentages under swapped keys, so anything saved by it describes the wrong
 * panel and must not be restored.
 */
export const FILE_TREE_WIDTH_KEY = "pull-request-file-tree-width-2";
export const DEFAULT_TREE_PERCENTAGE = 24;
export const MIN_TREE_PERCENTAGE = 12;
export const MAX_TREE_PERCENTAGE = 50;

export type FilesLayout = { tree: number; diffs: number };

/**
 * A layout is matched to panels by key *order*, never by key name: the group
 * reads it with `Object.values` and writes results back over `Object.keys`,
 * both by index. Listing `diffs` first — the order this would otherwise be
 * written in, alphabetically — silently hands the tree the diff column's
 * percentage and inverts every drag.
 *
 * Every layout is therefore built through this one function, in the order the
 * panels are rendered.
 */
export function createLayout(treePercentage: number): FilesLayout {
  return { tree: treePercentage, diffs: 100 - treePercentage };
}

export const DEFAULT_LAYOUT = createLayout(DEFAULT_TREE_PERCENTAGE);

export function normalizeLayout(
  layout: Record<string, number>,
): FilesLayout | null {
  const tree = layout.tree;

  if (
    typeof tree !== "number" ||
    typeof layout.diffs !== "number" ||
    tree < MIN_TREE_PERCENTAGE ||
    tree > MAX_TREE_PERCENTAGE
  ) {
    return null;
  }

  // Rebuilt rather than passed through, so a stored object always comes back
  // in panel order regardless of the order its keys were serialized in.
  return createLayout(tree);
}

export function readStoredLayout(): FilesLayout | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(FILE_TREE_WIDTH_KEY);

    return stored ? normalizeLayout(JSON.parse(stored) as never) : null;
  } catch {
    return null;
  }
}

export function writeStoredLayout(layout: Record<string, number>) {
  const normalized = normalizeLayout(layout);

  if (!normalized) {
    return;
  }

  try {
    window.localStorage.setItem(
      FILE_TREE_WIDTH_KEY,
      JSON.stringify(normalized),
    );
  } catch {
    // A width preference should never block reviewing a pull request.
  }
}
