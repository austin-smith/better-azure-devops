import "server-only";
import type { FileContents } from "@pierre/diffs";
import {
  preloadFile,
  type PreloadedFileResult,
} from "@pierre/diffs/ssr";
import {
  MAX_RENDERED_REPOSITORY_LINES,
  REPOSITORY_FILE_OPTIONS,
} from "@/lib/repositories/pierre-file";

export type RepositoryPreloadedFile = PreloadedFileResult<undefined>;

export async function preloadRepositoryFile(file: FileContents) {
  const lines = file.contents.split(/\r?\n/);
  const isTruncated = lines.length > MAX_RENDERED_REPOSITORY_LINES;
  const renderedFile = isTruncated
    ? {
        ...file,
        contents: lines
          .slice(0, MAX_RENDERED_REPOSITORY_LINES)
          .join("\n"),
      }
    : file;

  return {
    fullContent: isTruncated ? file.contents : null,
    isTruncated,
    lineCount: lines.length,
    preloadedFile: await preloadFile({
      file: renderedFile,
      options: REPOSITORY_FILE_OPTIONS,
    }),
  };
}
