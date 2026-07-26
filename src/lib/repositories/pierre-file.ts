import type { FileOptions, SelectedLineRange } from "@pierre/diffs";

export const MAX_RENDERED_REPOSITORY_LINES = 20_000;

export const REPOSITORY_FILE_OPTIONS = {
  disableFileHeader: true,
  enableLineSelection: true,
  lineHoverHighlight: "both",
  overflow: "scroll",
  theme: {
    dark: "pierre-dark",
    light: "pierre-light",
  },
  themeType: "system",
  tokenizeMaxLength: 500_000,
  tokenizeMaxLineLength: 5_000,
} as const satisfies FileOptions<undefined>;

const LINE_SELECTION_HASH_PATTERN =
  /^#L([1-9]\d*)(?:-L([1-9]\d*))?$/;

export function parseRepositoryFileLineHash(
  hash: string,
): SelectedLineRange | null {
  const match = LINE_SELECTION_HASH_PATTERN.exec(hash);

  if (!match) {
    return null;
  }

  const firstLine = Number(match[1]);
  const lastLine = Number(match[2] ?? match[1]);

  if (!Number.isSafeInteger(firstLine) || !Number.isSafeInteger(lastLine)) {
    return null;
  }

  return {
    end: Math.max(firstLine, lastLine),
    start: Math.min(firstLine, lastLine),
  };
}

export function getRepositoryFileLineHash(selection: SelectedLineRange) {
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);

  return start === end ? `#L${start}` : `#L${start}-L${end}`;
}
