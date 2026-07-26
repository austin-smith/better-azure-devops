vi.mock("server-only", () => ({}));

import {
  MAX_RENDERED_REPOSITORY_DIFF_LINES,
  preloadRepositoryDiff,
} from "@/lib/repositories/pierre-diff-server";

describe("repository Pierre diff preloading", () => {
  it("preloads highlighted HTML, reports stats, and escapes source markup", async () => {
    const result = await preloadRepositoryDiff(
      {
        contents: "export const value = 1;\n",
        name: "/src/example.ts",
      },
      {
        contents:
          "export const value = 2;\n<script>window.pwned = true</script>\n",
        name: "/src/example.ts",
      },
    );

    expect(result).toMatchObject({
      additions: 2,
      deletions: 1,
      kind: "ready",
    });

    if (result.kind !== "ready") {
      throw new Error("Expected a renderable diff.");
    }

    expect(result.preloadedDiff.prerenderedHTML).not.toContain(
      "<script>window.pwned",
    );
    expect(result.preloadedDiff.prerenderedHTML).toContain("&#x3C;");
  });

  it("bounds rendered diff rows before producing SSR markup", async () => {
    const result = await preloadRepositoryDiff(
      {
        contents: "",
        name: "/large.txt",
      },
      {
        contents: Array.from(
          { length: MAX_RENDERED_REPOSITORY_DIFF_LINES + 1 },
          (_, index) => `line ${index + 1}`,
        ).join("\n"),
        name: "/large.txt",
      },
    );

    expect(result).toMatchObject({
      additions: MAX_RENDERED_REPOSITORY_DIFF_LINES + 1,
      kind: "too-large",
    });
    expect("preloadedDiff" in result).toBe(false);
  });
});
