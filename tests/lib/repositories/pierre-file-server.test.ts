vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";
import { MAX_RENDERED_REPOSITORY_LINES } from "@/lib/repositories/pierre-file";
import { preloadRepositoryFile } from "@/lib/repositories/pierre-file-server";

describe("preloadRepositoryFile", () => {
  it("preloads syntax-highlighted source without emitting active source markup", async () => {
    const result = await preloadRepositoryFile({
      contents: "const value = '<script>alert(1)</script>';\n",
      name: "source.ts",
    });

    expect(result.isTruncated).toBe(false);
    expect(result.fullContent).toBeNull();
    expect(result.lineCount).toBe(2);
    expect(result.preloadedFile.prerenderedHTML).not.toContain("<script>");
    expect(result.preloadedFile.prerenderedHTML).toContain("&#x3C;");
  });

  it("keeps full copy content while bounding rendered source lines", async () => {
    const contents = Array.from(
      { length: MAX_RENDERED_REPOSITORY_LINES + 1 },
      (_, index) => `line ${index + 1}`,
    ).join("\n");
    const result = await preloadRepositoryFile({
      contents,
      name: "large.txt",
    });

    expect(result.isTruncated).toBe(true);
    expect(result.lineCount).toBe(MAX_RENDERED_REPOSITORY_LINES + 1);
    expect(result.fullContent).toBe(contents);
    expect(result.preloadedFile.file.contents.split("\n")).toHaveLength(
      MAX_RENDERED_REPOSITORY_LINES,
    );
  });
});
