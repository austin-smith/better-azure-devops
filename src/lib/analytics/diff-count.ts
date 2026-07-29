import { parseDiffFromFile } from "@pierre/diffs";

export function countAnalyticsTextDiff(
  oldFile: { contents: string; name: string },
  newFile: { contents: string; name: string },
) {
  const metadata = parseDiffFromFile(oldFile, newFile);

  return {
    additions: metadata.hunks.reduce(
      (total, hunk) => total + hunk.additionLines,
      0,
    ),
    deletions: metadata.hunks.reduce(
      (total, hunk) => total + hunk.deletionLines,
      0,
    ),
  };
}
