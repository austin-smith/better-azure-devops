import "server-only";
import {
  parseDiffFromFile,
  type DiffLineAnnotation,
  type FileContents,
  type FileDiffOptions,
} from "@pierre/diffs";
import {
  preloadMultiFileDiff,
  type PreloadMultiFileDiffResult,
} from "@pierre/diffs/ssr";
import { REPOSITORY_COMMIT_DIFF_OPTIONS } from "@/lib/repositories/pierre-diff";

export type RepositoryPreloadedDiff<TAnnotation = undefined> =
  PreloadMultiFileDiffResult<TAnnotation>;
export const MAX_RENDERED_REPOSITORY_DIFF_LINES = 20_000;

export async function preloadRepositoryDiff<TAnnotation = undefined>(
  oldFile: FileContents,
  newFile: FileContents,
  annotations?: DiffLineAnnotation<TAnnotation>[],
) {
  const metadata = parseDiffFromFile(oldFile, newFile);
  const additions = metadata.hunks.reduce(
    (total, hunk) => total + hunk.additionLines,
    0,
  );
  const deletions = metadata.hunks.reduce(
    (total, hunk) => total + hunk.deletionLines,
    0,
  );

  if (
    metadata.unifiedLineCount >
    MAX_RENDERED_REPOSITORY_DIFF_LINES
  ) {
    return {
      additions,
      deletions,
      kind: "too-large" as const,
      lineCount: metadata.unifiedLineCount,
    };
  }

  return {
    additions,
    deletions,
    kind: "ready" as const,
    lineCount: metadata.unifiedLineCount,
    preloadedDiff: await preloadMultiFileDiff<TAnnotation>({
      annotations,
      newFile,
      oldFile,
      options:
        REPOSITORY_COMMIT_DIFF_OPTIONS as FileDiffOptions<TAnnotation>,
    }),
  };
}
