import type { AzureGitPullRequestThread } from "@/lib/azure-devops/git/types";

export type PullRequestThreadLineRange = {
  end: number;
  /**
   * `right` positions address the source branch content, `left` the target.
   * Only `right` ranges can be resolved against the merge source commit.
   */
  side: "left" | "right";
  start: number;
};

export type PullRequestThreadSnippetLine = {
  content: string;
  isCommented: boolean;
  number: number;
};

export function getPullRequestThreadLineRange(
  thread: Pick<
    AzureGitPullRequestThread,
    "leftFileEnd" | "leftFileStart" | "rightFileEnd" | "rightFileStart"
  >,
): PullRequestThreadLineRange | null {
  const side = thread.rightFileStart ? "right" : "left";
  const start = thread.rightFileStart ?? thread.leftFileStart;
  const end = thread.rightFileEnd ?? thread.leftFileEnd;

  if (!start) {
    return null;
  }

  const endLine =
    end && end.line > start.line
      ? end.line
      : start.line;

  return { end: endLine, side, start: start.line };
}

export function formatPullRequestThreadLineRange(
  range: PullRequestThreadLineRange,
) {
  const sign = range.side === "right" ? "+" : "−";
  const noun = range.end === range.start ? "line" : "lines";
  const bounds =
    range.end === range.start
      ? `${sign}${range.start}`
      : `${sign}${range.start} to ${sign}${range.end}`;

  return `Comment on ${noun} ${bounds}`;
}

/**
 * Builds the few lines of file content surrounding a review comment so a file
 * thread carries its own context instead of only a path.
 */
export function buildPullRequestThreadSnippet(
  content: string,
  range: PullRequestThreadLineRange,
  contextLines = 3,
): PullRequestThreadSnippetLine[] {
  const lines = content.split(/\r?\n/);

  if (range.start < 1 || range.start > lines.length) {
    return [];
  }

  const from = Math.max(1, range.start - contextLines);
  const to = Math.min(lines.length, range.end + contextLines);

  return lines.slice(from - 1, to).map((text, index) => {
    const number = from + index;

    return {
      content: text,
      isCommented: number >= range.start && number <= range.end,
      number,
    };
  });
}
