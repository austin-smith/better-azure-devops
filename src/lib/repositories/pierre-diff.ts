import type { FileDiffOptions, SelectedLineRange } from "@pierre/diffs";

export const REPOSITORY_COMMIT_DIFF_OPTIONS = {
  collapsedContextThreshold: 4,
  diffIndicators: "classic",
  diffStyle: "unified",
  disableFileHeader: true,
  enableLineSelection: true,
  expandUnchanged: false,
  expansionLineCount: 20,
  hunkSeparators: "line-info",
  lineDiffType: "word",
  lineHoverHighlight: "both",
  maxLineDiffLength: 1_000,
  overflow: "scroll",
  stickyHeader: false,
  theme: {
    dark: "pierre-dark",
    light: "pierre-light",
  },
  themeType: "system",
  tokenizeMaxLength: 500_000,
  tokenizeMaxLineLength: 5_000,
} as const satisfies FileDiffOptions<undefined>;

const LEGACY_LINE_SELECTION_HASH_PATTERN =
  /^#L([1-9]\d*)(?:-L([1-9]\d*))?$/;
const DIFF_LINE_SELECTION_HASH_PATTERN =
  /^#L([1-9]\d*)-(old|new)(?:-L([1-9]\d*)-(old|new))?$/;

function getSelectionSide(value: "old" | "new") {
  return value === "old"
    ? ("deletions" as const)
    : ("additions" as const);
}

function getHashSide(value: SelectedLineRange["side"]) {
  return value === "deletions" ? "old" : "new";
}

export function parseRepositoryDiffLineHash(
  hash: string,
): SelectedLineRange | null {
  const match = DIFF_LINE_SELECTION_HASH_PATTERN.exec(hash);

  if (match) {
    const start = Number(match[1]);
    const end = Number(match[3] ?? match[1]);

    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      return null;
    }

    const side = getSelectionSide(match[2] as "old" | "new");
    const endSide = getSelectionSide(
      (match[4] ?? match[2]) as "old" | "new",
    );

    return {
      end,
      endSide,
      side,
      start,
    };
  }

  const legacyMatch = LEGACY_LINE_SELECTION_HASH_PATTERN.exec(hash);

  if (!legacyMatch) {
    return null;
  }

  const firstLine = Number(legacyMatch[1]);
  const lastLine = Number(legacyMatch[2] ?? legacyMatch[1]);

  if (!Number.isSafeInteger(firstLine) || !Number.isSafeInteger(lastLine)) {
    return null;
  }

  return {
    endSide: "additions",
    end: Math.max(firstLine, lastLine),
    side: "additions",
    start: Math.min(firstLine, lastLine),
  };
}

export function getRepositoryDiffLineHash(selection: SelectedLineRange) {
  const side = selection.side ?? "additions";
  const endSide = selection.endSide ?? side;
  const sameSide = side === endSide;
  const start = sameSide
    ? Math.min(selection.start, selection.end)
    : selection.start;
  const end = sameSide
    ? Math.max(selection.start, selection.end)
    : selection.end;
  const startHash = `#L${start}-${getHashSide(side)}`;

  return start === end && sameSide
    ? startHash
    : `${startHash}-L${end}-${getHashSide(endSide)}`;
}
