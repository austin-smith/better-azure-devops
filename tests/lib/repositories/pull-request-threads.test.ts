import {
  buildPullRequestThreadSnippet,
  formatPullRequestThreadLineRange,
  getPullRequestThreadLineRange,
} from "@/lib/repositories/pull-request-threads";

function position(line: number, offset = 2) {
  return { line, offset };
}

const FILE = ["one", "two", "three", "four", "five", "six", "seven"].join("\n");

describe("getPullRequestThreadLineRange", () => {
  it("prefers the source branch position", () => {
    expect(
      getPullRequestThreadLineRange({
        leftFileEnd: position(99),
        leftFileStart: position(99),
        rightFileEnd: position(58),
        rightFileStart: position(56),
      }),
    ).toEqual({ end: 58, side: "right", start: 56 });
  });

  it("falls back to the target branch position for removed lines", () => {
    expect(
      getPullRequestThreadLineRange({
        leftFileEnd: position(12),
        leftFileStart: position(12),
        rightFileEnd: null,
        rightFileStart: null,
      }),
    ).toEqual({ end: 12, side: "left", start: 12 });
  });

  it("collapses an end position that does not advance the line", () => {
    expect(
      getPullRequestThreadLineRange({
        leftFileEnd: null,
        leftFileStart: null,
        rightFileEnd: position(56),
        rightFileStart: position(56),
      }),
    ).toEqual({ end: 56, side: "right", start: 56 });
  });

  it("preserves an inclusive end position at the first character", () => {
    expect(
      getPullRequestThreadLineRange({
        leftFileEnd: null,
        leftFileStart: null,
        rightFileEnd: position(57, 1),
        rightFileStart: position(56, 1),
      }),
    ).toEqual({ end: 57, side: "right", start: 56 });
  });

  it("returns nothing for a file level comment", () => {
    expect(
      getPullRequestThreadLineRange({
        leftFileEnd: null,
        leftFileStart: null,
        rightFileEnd: null,
        rightFileStart: null,
      }),
    ).toBeNull();
  });
});

describe("formatPullRequestThreadLineRange", () => {
  it("describes a multi line range on the source branch", () => {
    expect(
      formatPullRequestThreadLineRange({ end: 58, side: "right", start: 56 }),
    ).toBe("Comment on lines +56 to +58");
  });

  it("uses the singular form for one line", () => {
    expect(
      formatPullRequestThreadLineRange({ end: 56, side: "right", start: 56 }),
    ).toBe("Comment on line +56");
  });

  it("marks target branch lines as removed", () => {
    expect(
      formatPullRequestThreadLineRange({ end: 12, side: "left", start: 12 }),
    ).toBe("Comment on line −12");
  });
});

describe("buildPullRequestThreadSnippet", () => {
  it("includes context on both sides of the comment", () => {
    const snippet = buildPullRequestThreadSnippet(
      FILE,
      { end: 4, side: "right", start: 4 },
      2,
    );

    expect(snippet.map((line) => line.number)).toEqual([2, 3, 4, 5, 6]);
    expect(snippet.map((line) => line.content)).toEqual([
      "two",
      "three",
      "four",
      "five",
      "six",
    ]);
  });

  it("marks only the commented lines", () => {
    const snippet = buildPullRequestThreadSnippet(
      FILE,
      { end: 5, side: "right", start: 4 },
      1,
    );

    expect(
      snippet.filter((line) => line.isCommented).map((line) => line.number),
    ).toEqual([4, 5]);
  });

  it("clamps to the start of the file", () => {
    const snippet = buildPullRequestThreadSnippet(
      FILE,
      { end: 1, side: "right", start: 1 },
      3,
    );

    expect(snippet[0]?.number).toBe(1);
  });

  it("clamps to the end of the file", () => {
    const snippet = buildPullRequestThreadSnippet(
      FILE,
      { end: 7, side: "right", start: 7 },
      3,
    );

    expect(snippet.at(-1)?.number).toBe(7);
  });

  it("returns nothing when the line is outside the file", () => {
    expect(
      buildPullRequestThreadSnippet(
        FILE,
        { end: 900, side: "right", start: 900 },
        3,
      ),
    ).toEqual([]);
  });

  it("handles windows line endings", () => {
    const snippet = buildPullRequestThreadSnippet(
      "a\r\nb\r\nc",
      { end: 2, side: "right", start: 2 },
      1,
    );

    expect(snippet.map((line) => line.content)).toEqual(["a", "b", "c"]);
  });
});
