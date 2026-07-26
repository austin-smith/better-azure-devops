import {
  getRepositoryDiffLineHash,
  parseRepositoryDiffLineHash,
  REPOSITORY_COMMIT_DIFF_OPTIONS,
} from "@/lib/repositories/pierre-diff";

describe("repository Pierre diff configuration", () => {
  it("uses serializable production options for a responsive unified diff", () => {
    expect(REPOSITORY_COMMIT_DIFF_OPTIONS).toMatchObject({
      diffStyle: "unified",
      disableFileHeader: true,
      enableLineSelection: true,
      overflow: "scroll",
      theme: {
        dark: "pierre-dark",
        light: "pierre-light",
      },
      themeType: "system",
    });
    expect(
      JSON.parse(JSON.stringify(REPOSITORY_COMMIT_DIFF_OPTIONS)),
    ).toEqual(REPOSITORY_COMMIT_DIFF_OPTIONS);
  });

  it.each([
    [
      "#L12",
      {
        end: 12,
        endSide: "additions",
        side: "additions",
        start: 12,
      },
    ],
    [
      "#L20-L14",
      {
        end: 20,
        endSide: "additions",
        side: "additions",
        start: 14,
      },
    ],
    [
      "#L8-old",
      {
        end: 8,
        endSide: "deletions",
        side: "deletions",
        start: 8,
      },
    ],
    [
      "#L3-new-L9-new",
      {
        end: 9,
        endSide: "additions",
        side: "additions",
        start: 3,
      },
    ],
    [
      "#L11-old-L14-new",
      {
        end: 14,
        endSide: "additions",
        side: "deletions",
        start: 11,
      },
    ],
    ["#L0", null],
    ["#line-12", null],
    ["", null],
  ])("parses line selection hash %s", (hash, expected) => {
    expect(parseRepositoryDiffLineHash(hash)).toEqual(expected);
  });

  it("formats single-line and range selections", () => {
    expect(
      getRepositoryDiffLineHash({
        end: 7,
        endSide: "deletions",
        side: "deletions",
        start: 7,
      }),
    ).toBe("#L7-old");
    expect(
      getRepositoryDiffLineHash({
        end: 4,
        endSide: "additions",
        side: "additions",
        start: 9,
      }),
    ).toBe("#L4-new-L9-new");
    expect(
      getRepositoryDiffLineHash({
        end: 14,
        endSide: "additions",
        side: "deletions",
        start: 11,
      }),
    ).toBe("#L11-old-L14-new");
  });
});
